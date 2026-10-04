-- ==============================================================================
-- Migration: 052_remove_merchant_consumer_wallet_sync.sql
-- Description: Permanently drop the dangerous consumer-to-merchant wallet balance
--              synchronization trigger and stored procedure introduced in Migration 044.
-- Authoritative Model: Merchant Wallets (merchant_wallets) and Consumer Wallets (wallets)
--                      are completely isolated financial entities.
-- Safety: Idempotent and non-destructive.
-- ==============================================================================

-- 1. Safely drop the active trigger from public.wallets
DROP TRIGGER IF EXISTS trg_sync_user_wallet_to_merchant_wallet ON public.wallets;

-- 2. Safely drop the trigger execution function
DROP FUNCTION IF EXISTS public.sync_user_wallet_to_merchant_wallet();

-- 3. Safety Assertion: Verify no remaining triggers link wallets to merchant_wallets
DO $$
DECLARE
    v_cnt integer;
BEGIN
    SELECT COUNT(*) INTO v_cnt
    FROM information_schema.triggers
    WHERE event_object_table = 'wallets'
      AND trigger_name = 'trg_sync_user_wallet_to_merchant_wallet';

    IF v_cnt > 0 THEN
        RAISE EXCEPTION 'CRITICAL: Failed to drop trg_sync_user_wallet_to_merchant_wallet';
    END IF;
    RAISE NOTICE 'SUCCESS: Consumer-to-merchant wallet sync trigger permanently removed.';
END $$;
