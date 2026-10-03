-- ==============================================================================
-- Migration: 037_merchant_gateway_paynit_upi_and_imps_migration.sql
-- Description: Merchant Gateway PayNit Migration — Unified UPI + IMPS Payouts
--              Enforces Flat ₹2.50 Payout Fee, Dual-Rail UPI/IMPS Support,
--              Merchant Isolation, and Strict Vault Protection.
-- Status: DRAFT / PENDING MANUAL REVIEW — DO NOT EXECUTE AUTOMATICALLY
-- ==============================================================================

-- 1. UPGRADE public.merchant_payouts SCHEMA FOR DUAL UPI + IMPS SUPPORT
ALTER TABLE public.merchant_payouts
    ADD COLUMN IF NOT EXISTS payout_method TEXT NOT NULL DEFAULT 'IMPS' CHECK (payout_method IN ('UPI', 'IMPS')),
    ADD COLUMN IF NOT EXISTS upi_id TEXT;

-- Make bank-specific columns nullable to support UPI payouts
ALTER TABLE public.merchant_payouts
    ALTER COLUMN bank_account_number_masked DROP NOT NULL,
    ALTER COLUMN ifsc_code DROP NOT NULL,
    ALTER COLUMN account_holder_name DROP NOT NULL,
    ALTER COLUMN payout_provider SET DEFAULT 'PAYNIT';

-- Enforce strict field constraints depending on payout_method
ALTER TABLE public.merchant_payouts
    DROP CONSTRAINT IF EXISTS chk_merchant_payout_method_fields;

ALTER TABLE public.merchant_payouts
    ADD CONSTRAINT chk_merchant_payout_method_fields CHECK (
        (payout_method = 'UPI' AND upi_id IS NOT NULL) OR
        (payout_method = 'IMPS' AND bank_account_number_masked IS NOT NULL AND ifsc_code IS NOT NULL AND account_holder_name IS NOT NULL)
    );

CREATE INDEX IF NOT EXISTS idx_mch_payouts_method ON public.merchant_payouts(payout_method);

-- 2. UPDATE PLATFORM SETTINGS: ENFORCE FLAT ₹2.50 PAYOUT FEE
INSERT INTO public.platform_settings (key, value, description)
VALUES
    ('MERCHANT_PAYOUT_FEE', '2.50', 'Flat ₹2.50 platform fee per payout for Merchant Gateway (both UPI and IMPS)'),
    ('MERCHANT_PAYOUT_PROVIDER', 'PAYNIT', 'Active outbound payout provider for Merchant Gateway (PayNit)')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = TIMEZONE('utc'::text, NOW());

-- 3. UPGRADED MERCHANT PAYOUT INITIATION RPC (FLAT ₹2.50 FEE, UPI + IMPS SUPPORT)
CREATE OR REPLACE FUNCTION public.merchant_initiate_payout_rpc(
    p_merchant_id UUID,
    p_order_id TEXT,
    p_amount NUMERIC(12, 2),
    p_payout_method TEXT DEFAULT 'IMPS',
    p_upi_id TEXT DEFAULT NULL,
    p_account_holder_name TEXT DEFAULT NULL,
    p_bank_account_number TEXT DEFAULT NULL,
    p_ifsc_code TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
    v_method TEXT := UPPER(TRIM(COALESCE(p_payout_method, 'IMPS')));
    v_existing_status TEXT;
    v_wallet RECORD;
    v_min_payout NUMERIC(12, 2);
    v_max_payout NUMERIC(12, 2);
    v_fee NUMERIC(12, 2) := 2.50; -- MANDATORY FLAT ₹2.50 FEE EVERYWHERE
    v_total_deducted NUMERIC(12, 2);
    v_payout_id UUID;
    v_provider_order_id TEXT;
    v_masked_acc TEXT := NULL;
    v_encrypted_acc TEXT := NULL;
    v_clean_upi TEXT := NULL;
    v_idem_key TEXT;
    v_bal_before NUMERIC(12, 2);
    v_bal_mid NUMERIC(12, 2);
    v_bal_after NUMERIC(12, 2);
BEGIN
    -- A. Validate Method
    IF v_method NOT IN ('UPI', 'IMPS') THEN
        RAISE EXCEPTION 'Invalid payout method: %. Must be either UPI or IMPS.', v_method;
    END IF;

    -- B. Authorization check: Target merchant must be ACTIVE and have PAID setup fee
    IF NOT EXISTS (
        SELECT 1 FROM public.merchants
        WHERE id = p_merchant_id 
          AND status = 'ACTIVE' 
          AND setup_fee_status = 'PAID'
    ) THEN
        RAISE EXCEPTION 'Access denied: merchant account is not active or setup fee is unpaid/pending approval';
    END IF;

    -- C. Merchant Isolation: If caller is authenticated user, verify ownership
    IF NOT v_is_service_role THEN
        IF v_caller_uid IS NULL THEN
            RAISE EXCEPTION 'Authentication required';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM public.merchants
            WHERE id = p_merchant_id AND user_id = v_caller_uid
        ) THEN
            RAISE EXCEPTION 'Access denied: caller does not own this merchant account';
        END IF;
    END IF;

    -- D. Input Validation
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Payout amount must be greater than zero';
    END IF;

    SELECT COALESCE(value::NUMERIC, 1.00) INTO v_min_payout
    FROM public.platform_settings WHERE key = 'MERCHANT_MIN_PAYOUT_AMOUNT';
    IF v_min_payout IS NULL THEN v_min_payout := 1.00; END IF;

    SELECT COALESCE(value::NUMERIC, 1000.00) INTO v_max_payout
    FROM public.platform_settings WHERE key = 'MERCHANT_MAX_PAYOUT_AMOUNT';
    IF v_max_payout IS NULL THEN v_max_payout := 1000.00; END IF;

    IF p_amount < v_min_payout THEN
        RAISE EXCEPTION 'Payout amount % is below minimum allowed %', p_amount, v_min_payout;
    END IF;
    IF p_amount > v_max_payout THEN
        RAISE EXCEPTION 'Payout amount % exceeds maximum allowed %', p_amount, v_max_payout;
    END IF;

    -- E. Method-Specific Destination Field Validation
    IF v_method = 'UPI' THEN
        IF p_upi_id IS NULL OR LENGTH(TRIM(p_upi_id)) < 3 THEN
            RAISE EXCEPTION 'A valid UPI ID is required for UPI payout';
        END IF;
        v_clean_upi := LOWER(TRIM(p_upi_id));
        IF NOT (v_clean_upi ~ '^[\w.\-_]{2,256}@[a-zA-Z]{2,64}$') THEN
            RAISE EXCEPTION 'Invalid UPI ID format. Expected format: username@bank';
        END IF;
    ELSIF v_method = 'IMPS' THEN
        IF p_bank_account_number IS NULL OR LENGTH(TRIM(p_bank_account_number)) < 4 THEN
            RAISE EXCEPTION 'A valid bank account number (min 4 digits) is required for IMPS payout';
        END IF;
        IF p_ifsc_code IS NULL OR NOT (UPPER(TRIM(p_ifsc_code)) ~ '^[A-Z]{4}0[A-Z0-9]{6}$') THEN
            RAISE EXCEPTION 'A valid 11-character IFSC code is required for IMPS payout';
        END IF;
        IF p_account_holder_name IS NULL OR LENGTH(TRIM(p_account_holder_name)) < 2 THEN
            RAISE EXCEPTION 'Beneficiary account holder name is required for IMPS payout';
        END IF;

        v_encrypted_acc := public.encrypt_merchant_bank_account(TRIM(p_bank_account_number));
        v_masked_acc := '•••• •••• ' || RIGHT(TRIM(p_bank_account_number), 4);
    END IF;

    -- F. Mandatory Authoritative Fee Calculation: Flat ₹2.50
    v_total_deducted := p_amount + v_fee;

    -- G. Idempotency Check (Merchant-Scoped)
    v_idem_key := COALESCE(p_idempotency_key, 'mch_py_' || p_merchant_id::text || '_' || p_order_id);
    SELECT id, provider_order_id, status INTO v_payout_id, v_provider_order_id, v_existing_status
    FROM public.merchant_payouts
    WHERE idempotency_key = v_idem_key OR (merchant_id = p_merchant_id AND order_id = p_order_id);

    IF v_payout_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'payout_id', v_payout_id,
            'provider_order_id', v_provider_order_id,
            'status', v_existing_status,
            'idempotent', true,
            'amount', p_amount,
            'fee', v_fee,
            'total_deducted', v_total_deducted,
            'payout_method', v_method
        );
    END IF;

    -- H. Pessimistic Float Lock on Merchant Wallet
    SELECT * INTO v_wallet
    FROM public.merchant_wallets
    WHERE merchant_id = p_merchant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Merchant wallet not found';
    END IF;

    IF v_wallet.available_balance < v_total_deducted THEN
        RAISE EXCEPTION 'Insufficient merchant float balance. Required: %, Available: %',
            v_total_deducted, v_wallet.available_balance;
    END IF;

    -- I. Generate IDs
    v_payout_id := gen_random_uuid();
    v_provider_order_id := 'PN_' || UPPER(SUBSTRING(REPLACE(v_payout_id::text, '-', ''), 1, 12));

    -- J. Lock Balance
    v_bal_before := v_wallet.available_balance;
    v_bal_mid := v_bal_before - p_amount;
    v_bal_after := v_bal_mid - v_fee;

    UPDATE public.merchant_wallets
    SET available_balance = available_balance - v_total_deducted,
        locked_payout_balance = locked_payout_balance + v_total_deducted,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_wallet.id;

    -- K. Insert merchant_payouts Record
    INSERT INTO public.merchant_payouts (
        id,
        merchant_id,
        order_id,
        provider_order_id,
        payout_method,
        upi_id,
        amount,
        fee_amount,
        total_deducted,
        account_holder_name,
        bank_account_number_masked,
        ifsc_code,
        status,
        payout_provider,
        idempotency_key
    ) VALUES (
        v_payout_id,
        p_merchant_id,
        p_order_id,
        v_provider_order_id,
        v_method,
        v_clean_upi,
        p_amount,
        v_fee,
        v_total_deducted,
        TRIM(p_account_holder_name),
        v_masked_acc,
        UPPER(TRIM(p_ifsc_code)),
        'PENDING',
        'PAYNIT',
        v_idem_key
    );

    -- L. If IMPS: Store Vault-Encrypted Bank Credentials
    IF v_method = 'IMPS' AND v_encrypted_acc IS NOT NULL THEN
        INSERT INTO public.merchant_payout_bank_credentials (
            payout_id,
            encrypted_account_number
        ) VALUES (
            v_payout_id,
            v_encrypted_acc
        );
    END IF;

    -- M. Write Immutable Ledger Entries
    INSERT INTO public.merchant_ledger_entries (
        merchant_id,
        wallet_id,
        amount,
        fee_amount,
        entry_type,
        reference_type,
        reference_id,
        idempotency_key,
        balance_before,
        balance_after,
        metadata
    ) VALUES (
        p_merchant_id,
        v_wallet.id,
        -p_amount,
        0.00,
        'PAYOUT_LOCK',
        'PAYOUT',
        v_payout_id::text,
        v_idem_key || '_lock_principal',
        v_bal_before,
        v_bal_mid,
        jsonb_build_object('order_id', p_order_id, 'provider_order_id', v_provider_order_id, 'method', v_method)
    );

    INSERT INTO public.merchant_ledger_entries (
        merchant_id,
        wallet_id,
        amount,
        fee_amount,
        entry_type,
        reference_type,
        reference_id,
        idempotency_key,
        balance_before,
        balance_after,
        metadata
    ) VALUES (
        p_merchant_id,
        v_wallet.id,
        -v_fee,
        v_fee,
        'PAYOUT_FEE_LOCK',
        'PAYOUT',
        v_payout_id::text,
        v_idem_key || '_lock_fee',
        v_bal_mid,
        v_bal_after,
        jsonb_build_object('order_id', p_order_id, 'provider_order_id', v_provider_order_id, 'method', v_method)
    );

    RETURN jsonb_build_object(
        'success', true,
        'payout_id', v_payout_id,
        'provider_order_id', v_provider_order_id,
        'amount', p_amount,
        'fee', v_fee,
        'total_deducted', v_total_deducted,
        'status', 'PENDING',
        'payout_method', v_method
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

-- 4. BACKWARD-COMPATIBLE OVERLOAD (7-PARAM SIGNATURE)
CREATE OR REPLACE FUNCTION public.merchant_initiate_payout_rpc(
    p_merchant_id UUID,
    p_order_id TEXT,
    p_amount NUMERIC(12, 2),
    p_account_holder_name TEXT,
    p_bank_account_number TEXT,
    p_ifsc_code TEXT,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
    RETURN public.merchant_initiate_payout_rpc(
        p_merchant_id := p_merchant_id,
        p_order_id := p_order_id,
        p_amount := p_amount,
        p_payout_method := 'IMPS',
        p_upi_id := NULL,
        p_account_holder_name := p_account_holder_name,
        p_bank_account_number := p_bank_account_number,
        p_ifsc_code := p_ifsc_code,
        p_idempotency_key := p_idempotency_key
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

-- 5. PERMISSIONS
REVOKE ALL ON FUNCTION public.merchant_initiate_payout_rpc(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_initiate_payout_rpc(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.merchant_initiate_payout_rpc(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_initiate_payout_rpc(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
