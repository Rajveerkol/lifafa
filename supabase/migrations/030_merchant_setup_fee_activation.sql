-- ==============================================================================
-- Migration: 030_merchant_setup_fee_activation.sql
-- Description: Strict ₹999 Merchant Gateway Setup Fee & Administrative Approval Flow
--              1. Adds setup fee tracking columns to public.merchants:
--                 - setup_fee_status ('PAYMENT_REQUIRED', 'PAYMENT_PENDING', 'PAID', 'FAILED')
--                 - setup_fee_amount (NUMERIC DEFAULT 999.00)
--                 - setup_fee_reference (TEXT)
--                 - setup_fee_paid_at (TIMESTAMPTZ)
--                 - setup_fee_payment_method (TEXT)
--              2. Updates status CHECK constraint on public.merchants to:
--                 ('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED') with DEFAULT 'PENDING_APPROVAL'.
--              3. Updates handle_new_merchant() trigger to initialize new registrations
--                 with status = 'PENDING_APPROVAL' and setup_fee_status = 'PAYMENT_REQUIRED'.
--              4. Grandfathers existing ACTIVE merchants to setup_fee_status = 'PAID'.
--              5. Hardens is_merchant() to require status = 'ACTIVE' AND setup_fee_status = 'PAID'.
--              6. Hardens all merchant RPCs to require status = 'ACTIVE' AND setup_fee_status = 'PAID':
--                 - merchant_initiate_payout_rpc
--                 - merchant_submit_deposit_rpc
--                 - merchant_generate_api_key_rpc
--                 - merchant_list_api_keys_rpc
--                 - merchant_add_ip_whitelist_rpc
--              7. Implements provider-agnostic setup fee submission RPC:
--                 - merchant_submit_setup_fee_payment_rpc
--              8. Implements administrative setup fee and approval RPCs:
--                 - admin_record_merchant_setup_fee_rpc
--                 - admin_approve_merchant_rpc (Strictly gated on setup_fee_status = 'PAID')
--                 - admin_reject_merchant_rpc
--              9. Revokes direct client UPDATE on sensitive columns of public.merchants.
-- Target: Supabase SQL Editor (Manual Execution after Review - DO NOT AUTO-APPLY)
-- ==============================================================================

-- 1. EXTEND MERCHANTS STATUS & ADD SETUP FEE COLUMNS
DO $$
BEGIN
    -- Drop existing check constraint on status
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'merchants_status_check' AND conrelid = 'public.merchants'::regclass
    ) THEN
        ALTER TABLE public.merchants DROP CONSTRAINT merchants_status_check;
    END IF;
END $$;

ALTER TABLE public.merchants 
    ADD CONSTRAINT merchants_status_check 
    CHECK (status IN ('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED'));

ALTER TABLE public.merchants 
    ALTER COLUMN status SET DEFAULT 'PENDING_APPROVAL';

ALTER TABLE public.merchants 
    ADD COLUMN IF NOT EXISTS setup_fee_status TEXT NOT NULL DEFAULT 'PAYMENT_REQUIRED'
    CHECK (setup_fee_status IN ('PAYMENT_REQUIRED', 'PAYMENT_PENDING', 'PAID', 'FAILED'));

ALTER TABLE public.merchants 
    ADD COLUMN IF NOT EXISTS setup_fee_amount NUMERIC(12, 2) NOT NULL DEFAULT 999.00 
    CHECK (setup_fee_amount >= 0);

ALTER TABLE public.merchants 
    ADD COLUMN IF NOT EXISTS setup_fee_reference TEXT;

ALTER TABLE public.merchants 
    ADD COLUMN IF NOT EXISTS setup_fee_paid_at TIMESTAMPTZ;

ALTER TABLE public.merchants 
    ADD COLUMN IF NOT EXISTS setup_fee_payment_method TEXT;

CREATE INDEX IF NOT EXISTS idx_merchants_setup_fee_status ON public.merchants(setup_fee_status);

-- Grandfather existing active merchants to setup_fee_status = 'PAID'
UPDATE public.merchants
SET setup_fee_status = 'PAID',
    setup_fee_paid_at = COALESCE(setup_fee_paid_at, created_at),
    setup_fee_payment_method = COALESCE(setup_fee_payment_method, 'GRANDFATHERED')
WHERE status = 'ACTIVE' AND setup_fee_status = 'PAYMENT_REQUIRED';

-- 2. UPDATE handle_new_merchant() TRIGGER FUNCTION
-- Sets status = 'PENDING_APPROVAL' and setup_fee_status = 'PAYMENT_REQUIRED' upon signup
CREATE OR REPLACE FUNCTION public.handle_new_merchant()
RETURNS TRIGGER AS $$
DECLARE
    v_merchant_id UUID;
    v_merchant_code TEXT;
    v_business_name TEXT;
    v_mobile TEXT;
BEGIN
    -- Strict Isolation Guard: Only execute for users registered as MERCHANT
    IF (NEW.raw_user_meta_data->>'account_type') <> 'MERCHANT' THEN
        RETURN NEW;
    END IF;

    v_business_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'business_name',
        'Merchant Business'
    );
    v_mobile := COALESCE(
        NEW.raw_user_meta_data->>'mobile_number',
        NEW.phone,
        SUBSTRING(NEW.email FROM '^([0-9]+)@'),
        '0000000000'
    );
    v_merchant_code := 'MCH-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8));

    -- 1. Insert into public.merchants strictly with status = 'PENDING_APPROVAL' and setup_fee_status = 'PAYMENT_REQUIRED'
    INSERT INTO public.merchants (
        user_id,
        merchant_code,
        business_name,
        mobile_number,
        status,
        setup_fee_status,
        setup_fee_amount
    ) VALUES (
        NEW.id,
        v_merchant_code,
        v_business_name,
        v_mobile,
        'PENDING_APPROVAL',
        'PAYMENT_REQUIRED',
        999.00
    )
    ON CONFLICT (user_id) DO NOTHING
    RETURNING id INTO v_merchant_id;

    IF v_merchant_id IS NULL THEN
        SELECT id INTO v_merchant_id FROM public.merchants WHERE user_id = NEW.id;
    END IF;

    -- 2. Insert into public.merchant_wallets
    IF v_merchant_id IS NOT NULL THEN
        INSERT INTO public.merchant_wallets (
            merchant_id,
            available_balance,
            locked_payout_balance,
            total_deposited,
            total_paid_out,
            total_fees_paid
        ) VALUES (
            v_merchant_id,
            0.00,
            0.00,
            0.00,
            0.00,
            0.00
        )
        ON CONFLICT (merchant_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

-- 3. HARDEN is_merchant() HELPER FUNCTION
CREATE OR REPLACE FUNCTION public.is_merchant(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    IF check_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.merchants
        WHERE user_id = check_user_id 
          AND status = 'ACTIVE' 
          AND setup_fee_status = 'PAID'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 4. HARDEN merchant_initiate_payout_rpc
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
DECLARE
    v_caller_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
    v_existing_status TEXT;
    v_wallet RECORD;
    v_min_payout NUMERIC(12, 2);
    v_max_payout NUMERIC(12, 2);
    v_fee NUMERIC(12, 2);
    v_total_deducted NUMERIC(12, 2);
    v_payout_id UUID;
    v_provider_order_id TEXT;
    v_masked_acc TEXT;
    v_encrypted_acc TEXT;
    v_idem_key TEXT;
    v_bal_before NUMERIC(12, 2);
    v_bal_mid NUMERIC(12, 2);
    v_bal_after NUMERIC(12, 2);
BEGIN
    -- 1. Authorization check: target merchant must be ACTIVE and have PAID setup fee
    -- Unconditional verification of target merchant state (strictly enforced even for service_role)
    IF NOT EXISTS (
        SELECT 1 FROM public.merchants
        WHERE id = p_merchant_id 
          AND status = 'ACTIVE' 
          AND setup_fee_status = 'PAID'
    ) THEN
        RAISE EXCEPTION 'Access denied: merchant account is not active or ₹999 setup fee is unpaid/pending approval';
    END IF;

    -- If caller is authenticated user, also verify account ownership
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

    -- 2. Input validation
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Payout amount must be greater than zero';
    END IF;

    -- Configurable Limits from platform_settings
    SELECT COALESCE(value::NUMERIC, 10.00) INTO v_min_payout
    FROM public.platform_settings WHERE key = 'MERCHANT_MIN_PAYOUT_AMOUNT';
    IF v_min_payout IS NULL THEN v_min_payout := 10.00; END IF;

    SELECT COALESCE(value::NUMERIC, 1000.00) INTO v_max_payout
    FROM public.platform_settings WHERE key = 'MERCHANT_MAX_PAYOUT_AMOUNT';
    IF v_max_payout IS NULL THEN v_max_payout := 1000.00; END IF;

    IF p_amount < v_min_payout THEN
        RAISE EXCEPTION 'Payout amount % is below minimum allowed %', p_amount, v_min_payout;
    END IF;
    IF p_amount > v_max_payout THEN
        RAISE EXCEPTION 'Payout amount % exceeds maximum allowed %', p_amount, v_max_payout;
    END IF;

    IF p_bank_account_number IS NULL OR LENGTH(TRIM(p_bank_account_number)) < 4 THEN
        RAISE EXCEPTION 'A valid bank account number is required';
    END IF;

    IF p_ifsc_code IS NULL OR NOT (UPPER(TRIM(p_ifsc_code)) ~ '^[A-Z]{4}0[A-Z0-9]{6}$') THEN
        RAISE EXCEPTION 'A valid 11-character IFSC code is required';
    END IF;

    IF p_account_holder_name IS NULL OR LENGTH(TRIM(p_account_holder_name)) < 2 THEN
        RAISE EXCEPTION 'Account holder name is required';
    END IF;

    -- 3. Exact Tiered Payout Fee Calculation
    IF p_amount <= 100.00 THEN
        v_fee := 3.70;
    ELSE
        v_fee := 3.80;
    END IF;
    v_total_deducted := p_amount + v_fee;

    -- 4. Idempotency Check
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
            'idempotent', true
        );
    END IF;

    -- 5. Pessimistic float lock on merchant wallet
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

    -- 6. Encrypt bank account number using dedicated Vault helper
    v_encrypted_acc := public.encrypt_merchant_bank_account(p_bank_account_number);
    v_masked_acc := '•••• •••• ' || RIGHT(TRIM(p_bank_account_number), 4);

    -- 7. Generate payout UUID and deterministic provider order ID
    v_payout_id := gen_random_uuid();
    v_provider_order_id := 'PR_' || UPPER(SUBSTRING(REPLACE(v_payout_id::text, '-', ''), 1, 12));

    -- 8. Deduct available_balance and increase locked_payout_balance
    v_bal_before := v_wallet.available_balance;
    v_bal_mid := v_bal_before - p_amount;
    v_bal_after := v_bal_mid - v_fee;

    UPDATE public.merchant_wallets
    SET available_balance = available_balance - v_total_deducted,
        locked_payout_balance = locked_payout_balance + v_total_deducted,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_wallet.id;

    -- 9. Insert merchant_payouts record
    INSERT INTO public.merchant_payouts (
        id,
        merchant_id,
        order_id,
        provider_order_id,
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
        p_amount,
        v_fee,
        v_total_deducted,
        TRIM(p_account_holder_name),
        v_masked_acc,
        UPPER(TRIM(p_ifsc_code)),
        'PENDING',
        'PAYRUPEE',
        v_idem_key
    );

    -- 10. Insert merchant_payout_bank_credentials
    INSERT INTO public.merchant_payout_bank_credentials (
        payout_id,
        encrypted_account_number
    ) VALUES (
        v_payout_id,
        v_encrypted_acc
    );

    -- 11. Write immutable audit ledger entries
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
        jsonb_build_object('order_id', p_order_id, 'provider_order_id', v_provider_order_id)
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
        jsonb_build_object('order_id', p_order_id, 'provider_order_id', v_provider_order_id)
    );

    RETURN jsonb_build_object(
        'success', true,
        'payout_id', v_payout_id,
        'provider_order_id', v_provider_order_id,
        'amount', p_amount,
        'fee', v_fee,
        'total_deducted', v_total_deducted,
        'status', 'PENDING'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public.merchant_initiate_payout_rpc(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_initiate_payout_rpc(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 5. HARDEN merchant_submit_deposit_rpc
CREATE OR REPLACE FUNCTION public.merchant_submit_deposit_rpc(
    p_merchant_id UUID,
    p_gross_amount NUMERIC(12, 2),
    p_utr_number TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
    v_fee_pct NUMERIC(12, 2) := 2.00;
    v_fee_amount NUMERIC(12, 2);
    v_net_credited NUMERIC(12, 2);
    v_deposit_id UUID;
    v_clean_utr TEXT;
BEGIN
    -- 1. Authorization: Target merchant must be active and have PAID setup fee
    -- Unconditional verification of target merchant state (strictly enforced even for service_role)
    IF NOT EXISTS (
        SELECT 1 FROM public.merchants
        WHERE id = p_merchant_id 
          AND status = 'ACTIVE' 
          AND setup_fee_status = 'PAID'
    ) THEN
        RAISE EXCEPTION 'Access denied: merchant account is not active or ₹999 setup fee is unpaid/pending approval';
    END IF;

    -- If caller is authenticated user, verify ownership
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

    -- 2. Validation
    IF p_gross_amount IS NULL OR p_gross_amount <= 0 THEN
        RAISE EXCEPTION 'Deposit gross amount must be greater than zero';
    END IF;

    v_clean_utr := UPPER(TRIM(COALESCE(p_utr_number, '')));
    IF LENGTH(v_clean_utr) < 6 THEN
        RAISE EXCEPTION 'A valid UPI UTR or Transaction Reference Number is required';
    END IF;

    -- Check duplicate UTR
    IF EXISTS (SELECT 1 FROM public.merchant_deposits WHERE utr_number = v_clean_utr) THEN
        RAISE EXCEPTION 'Deposit request with this UTR number already exists';
    END IF;

    -- 3. Calculate 2% deposit fee server-side
    SELECT COALESCE(value::NUMERIC, 2.00) INTO v_fee_pct
    FROM public.platform_settings WHERE key = 'MERCHANT_DEPOSIT_FEE_PERCENT';
    IF v_fee_pct IS NULL THEN v_fee_pct := 2.00; END IF;

    v_fee_amount := ROUND(p_gross_amount * (v_fee_pct / 100.0), 2);
    v_net_credited := p_gross_amount - v_fee_amount;

    IF v_net_credited <= 0 THEN
        RAISE EXCEPTION 'Calculated net credited amount % is invalid for gross %', v_net_credited, p_gross_amount;
    END IF;

    v_deposit_id := gen_random_uuid();

    -- 4. Insert strictly with status = 'PENDING'
    INSERT INTO public.merchant_deposits (
        id,
        merchant_id,
        gross_amount,
        deposit_fee,
        net_credited,
        utr_number,
        status,
        admin_notes,
        reviewed_by,
        reviewed_at
    ) VALUES (
        v_deposit_id,
        p_merchant_id,
        p_gross_amount,
        v_fee_amount,
        v_net_credited,
        v_clean_utr,
        'PENDING',
        NULL,
        NULL,
        NULL
    );

    RETURN jsonb_build_object(
        'success', true,
        'deposit_id', v_deposit_id,
        'gross_amount', p_gross_amount,
        'deposit_fee', v_fee_amount,
        'net_credited', v_net_credited,
        'utr_number', v_clean_utr,
        'status', 'PENDING'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.merchant_submit_deposit_rpc(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_submit_deposit_rpc(UUID, NUMERIC, TEXT) TO authenticated, service_role;

-- 6. HARDEN merchant_generate_api_key_rpc
CREATE OR REPLACE FUNCTION public.merchant_generate_api_key_rpc(
    p_merchant_id UUID,
    p_key_name TEXT DEFAULT 'Primary API Key'
)
RETURNS JSONB AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
    v_key_id UUID;
    v_client_id TEXT;
    v_raw_secret TEXT;
    v_secret_hash TEXT;
BEGIN
    -- Verify target merchant is active and has PAID setup fee (strictly enforced even for service_role)
    IF NOT EXISTS (
        SELECT 1 FROM public.merchants
        WHERE id = p_merchant_id 
          AND status = 'ACTIVE' 
          AND setup_fee_status = 'PAID'
    ) THEN
        RAISE EXCEPTION 'Access denied: merchant account is not active or ₹999 setup fee is unpaid/pending approval';
    END IF;

    -- If caller is authenticated user, verify ownership
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

    -- Generate cryptographically secure random credentials
    v_client_id := 'pk_live_' || encode(extensions.gen_random_bytes(16), 'hex');
    v_raw_secret := 'sk_live_' || encode(extensions.gen_random_bytes(24), 'hex');
    v_secret_hash := encode(extensions.digest(v_raw_secret, 'sha256'), 'hex');
    v_key_id := gen_random_uuid();

    INSERT INTO public.merchant_api_keys (
        id,
        merchant_id,
        key_name,
        client_id,
        client_secret_hash,
        is_active
    ) VALUES (
        v_key_id,
        p_merchant_id,
        COALESCE(NULLIF(TRIM(p_key_name), ''), 'Primary API Key'),
        v_client_id,
        v_secret_hash,
        TRUE
    );

    RETURN jsonb_build_object(
        'success', true,
        'key_id', v_key_id,
        'client_id', v_client_id,
        'client_secret', v_raw_secret,
        'key_name', COALESCE(NULLIF(TRIM(p_key_name), ''), 'Primary API Key')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public.merchant_generate_api_key_rpc(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_generate_api_key_rpc(UUID, TEXT) TO authenticated, service_role;

-- 7. HARDEN merchant_list_api_keys_rpc
CREATE OR REPLACE FUNCTION public.merchant_list_api_keys_rpc(p_merchant_id UUID)
RETURNS TABLE (
    id UUID,
    merchant_id UUID,
    key_name TEXT,
    client_id TEXT,
    is_active BOOLEAN,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
) AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
BEGIN
    -- Unconditional verification of target merchant state (strictly enforced even for service_role)
    IF NOT EXISTS (
        SELECT 1 FROM public.merchants
        WHERE id = p_merchant_id 
          AND status = 'ACTIVE' 
          AND setup_fee_status = 'PAID'
    ) THEN
        RAISE EXCEPTION 'Access denied: merchant account is not active or ₹999 setup fee is unpaid/pending approval';
    END IF;

    IF NOT v_is_service_role THEN
        IF v_caller_uid IS NULL THEN
            RAISE EXCEPTION 'Authentication required';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM public.merchants
            WHERE public.merchants.id = p_merchant_id
              AND public.merchants.user_id = v_caller_uid
        ) AND NOT public.is_admin(v_caller_uid) THEN
            RAISE EXCEPTION 'Access denied: caller does not own this merchant account';
        END IF;
    END IF;

    RETURN QUERY
    SELECT 
        k.id,
        k.merchant_id,
        k.key_name,
        k.client_id,
        k.is_active,
        k.last_used_at,
        k.created_at
    FROM public.merchant_api_keys k
    WHERE k.merchant_id = p_merchant_id
    ORDER BY k.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.merchant_list_api_keys_rpc(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_list_api_keys_rpc(UUID) TO authenticated, service_role;

-- 8. HARDEN merchant_add_ip_whitelist_rpc
CREATE OR REPLACE FUNCTION public.merchant_add_ip_whitelist_rpc(
    p_merchant_id UUID,
    p_ip_address TEXT,
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
    v_parsed_ip INET;
    v_entry_id UUID;
BEGIN
    -- Authorization: Target merchant must be active and have PAID setup fee
    -- Unconditional verification of target merchant state (strictly enforced even for service_role)
    IF NOT EXISTS (
        SELECT 1 FROM public.merchants
        WHERE id = p_merchant_id 
          AND status = 'ACTIVE' 
          AND setup_fee_status = 'PAID'
    ) THEN
        RAISE EXCEPTION 'Access denied: merchant account is not active or ₹999 setup fee is unpaid/pending approval';
    END IF;

    -- If caller is authenticated user, verify ownership
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

    BEGIN
        v_parsed_ip := TRIM(p_ip_address)::INET;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid IP address or CIDR format: %', p_ip_address;
    END;

    v_entry_id := gen_random_uuid();

    INSERT INTO public.merchant_ip_whitelist (
        id,
        merchant_id,
        ip_address,
        description
    ) VALUES (
        v_entry_id,
        p_merchant_id,
        v_parsed_ip,
        NULLIF(TRIM(p_description), '')
    )
    ON CONFLICT (merchant_id, ip_address) DO UPDATE SET
        description = COALESCE(EXCLUDED.description, public.merchant_ip_whitelist.description);

    RETURN jsonb_build_object(
        'success', true,
        'id', v_entry_id,
        'ip_address', host(v_parsed_ip),
        'description', p_description
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.merchant_add_ip_whitelist_rpc(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_add_ip_whitelist_rpc(UUID, TEXT, TEXT) TO authenticated, service_role;

-- 9. PROVIDER-AGNOSTIC SETUP FEE SUBMISSION RPC
-- Strictly records payment reference as a pending claim.
-- Merchant CANNOT self-authorize as PAID. Status is set strictly to 'PAYMENT_PENDING'.
-- Only admin_record_merchant_setup_fee_rpc or a verified provider webhook using service_role can set setup_fee_status = 'PAID'.
CREATE OR REPLACE FUNCTION public.merchant_submit_setup_fee_payment_rpc(
    p_merchant_id UUID,
    p_payment_reference TEXT,
    p_payment_method TEXT DEFAULT 'DIRECT_CLAIM'
)
RETURNS JSONB AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
    v_merchant RECORD;
    v_ref TEXT;
BEGIN
    -- 1. Authorization: Verify caller owns this merchant or is admin/service_role
    IF NOT v_is_service_role THEN
        IF v_caller_uid IS NULL THEN
            RAISE EXCEPTION 'Authentication required';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM public.merchants
            WHERE id = p_merchant_id AND user_id = v_caller_uid
        ) AND NOT public.is_admin(v_caller_uid) THEN
            RAISE EXCEPTION 'Access denied: caller does not own this merchant account';
        END IF;
    END IF;

    -- 2. Lock merchant row
    SELECT * INTO v_merchant
    FROM public.merchants
    WHERE id = p_merchant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Merchant account not found';
    END IF;

    IF v_merchant.setup_fee_status = 'PAID' THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Setup fee has already been paid and verified',
            'setup_fee_status', 'PAID',
            'status', v_merchant.status
        );
    END IF;

    v_ref := TRIM(COALESCE(p_payment_reference, ''));
    IF LENGTH(v_ref) < 4 THEN
        RAISE EXCEPTION 'A valid payment reference or UTR is required';
    END IF;

    -- 3. Update setup fee status strictly to PAYMENT_PENDING.
    -- Merchant-submitted reference is a claim awaiting admin / provider verification.
    -- Merchant status remains PENDING_APPROVAL.
    UPDATE public.merchants
    SET setup_fee_status = 'PAYMENT_PENDING',
        setup_fee_reference = v_ref,
        setup_fee_payment_method = COALESCE(NULLIF(TRIM(p_payment_method), ''), 'DIRECT_CLAIM'),
        status = 'PENDING_APPROVAL',
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = p_merchant_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Payment reference submitted for verification. An administrator will verify the payment before activation.',
        'setup_fee_status', 'PAYMENT_PENDING',
        'status', 'PENDING_APPROVAL',
        'setup_fee_reference', v_ref
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.merchant_submit_setup_fee_payment_rpc(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_submit_setup_fee_payment_rpc(UUID, TEXT, TEXT) TO authenticated, service_role;

-- 10. ADMIN APPROVE MERCHANT RPC (STRICTLY CHECKS setup_fee_status = 'PAID')
CREATE OR REPLACE FUNCTION public.admin_approve_merchant_rpc(
    p_merchant_id UUID,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_admin_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
    v_merchant RECORD;
BEGIN
    -- 1. Authorization: Admin or service_role only
    IF NOT v_is_service_role THEN
        IF v_admin_uid IS NULL OR NOT public.is_admin(v_admin_uid) THEN
            RAISE EXCEPTION 'Access denied: administrator privileges required';
        END IF;
    END IF;

    -- 2. Lock merchant row
    SELECT * INTO v_merchant
    FROM public.merchants
    WHERE id = p_merchant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Merchant account not found';
    END IF;

    -- 3. Strict Check: CANNOT approve unless setup_fee_status = 'PAID'
    IF v_merchant.setup_fee_status <> 'PAID' THEN
        RAISE EXCEPTION 'Cannot approve merchant gateway: ₹999 setup fee has not been paid (current status: %)', v_merchant.setup_fee_status;
    END IF;

    IF v_merchant.status = 'ACTIVE' THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Merchant gateway is already active',
            'merchant_id', p_merchant_id,
            'status', 'ACTIVE',
            'setup_fee_status', 'PAID'
        );
    END IF;

    -- 4. Activate merchant
    UPDATE public.merchants
    SET status = 'ACTIVE',
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = p_merchant_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Merchant gateway activated successfully',
        'merchant_id', p_merchant_id,
        'status', 'ACTIVE',
        'setup_fee_status', 'PAID'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.admin_approve_merchant_rpc(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_approve_merchant_rpc(UUID, TEXT) TO authenticated, service_role;

-- 11. ADMIN OVERRIDE / RECORD SETUP FEE STATUS RPC
CREATE OR REPLACE FUNCTION public.admin_record_merchant_setup_fee_rpc(
    p_merchant_id UUID,
    p_setup_fee_status TEXT,
    p_payment_reference TEXT DEFAULT NULL,
    p_payment_method TEXT DEFAULT 'ADMIN_MANUAL'
)
RETURNS JSONB AS $$
DECLARE
    v_admin_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
    v_clean_status TEXT;
BEGIN
    IF NOT v_is_service_role THEN
        IF v_admin_uid IS NULL OR NOT public.is_admin(v_admin_uid) THEN
            RAISE EXCEPTION 'Access denied: administrator privileges required';
        END IF;
    END IF;

    v_clean_status := UPPER(TRIM(COALESCE(p_setup_fee_status, '')));
    IF v_clean_status NOT IN ('PAYMENT_REQUIRED', 'PAYMENT_PENDING', 'PAID', 'FAILED') THEN
        RAISE EXCEPTION 'Invalid setup fee status: %. Must be PAYMENT_REQUIRED, PAYMENT_PENDING, PAID, or FAILED', p_setup_fee_status;
    END IF;

    UPDATE public.merchants
    SET setup_fee_status = v_clean_status,
        setup_fee_reference = CASE WHEN v_clean_status = 'PAID' THEN COALESCE(p_payment_reference, setup_fee_reference, 'ADMIN_MANUAL_' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8))) ELSE p_payment_reference END,
        setup_fee_paid_at = CASE WHEN v_clean_status = 'PAID' THEN COALESCE(setup_fee_paid_at, TIMEZONE('utc'::text, NOW())) ELSE NULL END,
        setup_fee_payment_method = p_payment_method,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = p_merchant_id;

    RETURN jsonb_build_object(
        'success', true,
        'merchant_id', p_merchant_id,
        'setup_fee_status', v_clean_status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.admin_record_merchant_setup_fee_rpc(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_record_merchant_setup_fee_rpc(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 12. ADMIN REJECT / SUSPEND MERCHANT RPC
CREATE OR REPLACE FUNCTION public.admin_reject_merchant_rpc(
    p_merchant_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_admin_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
BEGIN
    IF NOT v_is_service_role THEN
        IF v_admin_uid IS NULL OR NOT public.is_admin(v_admin_uid) THEN
            RAISE EXCEPTION 'Access denied: administrator privileges required';
        END IF;
    END IF;

    UPDATE public.merchants
    SET status = 'SUSPENDED',
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = p_merchant_id;

    RETURN jsonb_build_object(
        'success', true,
        'merchant_id', p_merchant_id,
        'status', 'SUSPENDED'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.admin_reject_merchant_rpc(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reject_merchant_rpc(UUID, TEXT) TO authenticated, service_role;

-- 13. CLIENT MUTATION SECURITY: REVOKE DIRECT UPDATE ON SENSITIVE COLUMNS
REVOKE UPDATE ON public.merchants FROM authenticated, anon, PUBLIC;
GRANT UPDATE (business_name) ON public.merchants TO authenticated;
GRANT ALL ON public.merchants TO service_role;

-- Reinforce RLS: Replace legacy update policy to strictly enforce ownership
DROP POLICY IF EXISTS "Merchants can update own profile" ON public.merchants;
DROP POLICY IF EXISTS "Merchants can update own profile business_name" ON public.merchants;
CREATE POLICY "Merchants can update own profile business_name"
    ON public.merchants FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
