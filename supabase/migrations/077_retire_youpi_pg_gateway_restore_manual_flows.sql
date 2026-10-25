-- ==============================================================================
-- MIGRATION 077: Retire YouPI-PG Gateway & Verify Restored Manual Deposit/Payout Flows
-- STATUS: NOT EXECUTED (FOR REVIEW ONLY - DO NOT APPLY WITHOUT AUTHORIZATION)
-- Target: Supabase SQL Editor / Migration Pipeline
-- ==============================================================================
-- 1. Safely removes the dedicated "youpi" schema and its internal tables/functions:
--      - youpi.receiving_accounts
--      - youpi.payment_observations
--      - youpi.gmail_sync_state
--      - youpi.acquire_payment_slot_rpc
--      - youpi.process_bank_observation_rpc
--      - youpi.release_expired_slots_rpc
-- 2. Safely removes public gateway RPC wrappers (create_youpi_deposit_order_rpc, credit_verified_youpi_deposit_rpc).
-- 3. ABSOLUTE PRESERVATION OF FINANCIAL DATA:
--      - public.wallets is NEVER touched or dropped.
--      - public.merchant_wallets is NEVER touched or dropped.
--      - public.wallet_transactions (ledger) is NEVER touched or dropped.
--      - public.deposit_requests is completely preserved with all existing records intact.
--      - public.withdrawals is completely preserved with all existing records intact.
--      - public.lifafas & public.lifafa_claims are completely preserved.
-- 4. Verifies authoritative manual RPCs remain available and active:
--      - public.submit_deposit_request_rpc (Manual deposit submission with UTR & 2% fee)
--      - public.admin_review_deposit_rpc (Admin deposit approval with double-entry ledger credit)
--      - public.request_withdrawal_rpc (Manual withdrawal submission with balance reservation)
--      - public.admin_update_withdrawal_rpc (Admin manual payout approval with UTR or rejection with refund)
--      - public.claim_lifafa_rpc (Atomic claim allocation with PENDING manual withdrawal creation)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. RETIRE AND DROP ISOLATED "youpi" SCHEMA
-- ------------------------------------------------------------------------------
-- Dropping with CASCADE removes youpi tables, triggers, indexes, and RPCs safely
-- without impacting any public schema objects or ledger records.
DROP SCHEMA IF EXISTS youpi CASCADE;

-- ------------------------------------------------------------------------------
-- 2. DROP PUBLIC YOUPI-PG FUNCTION WRAPPERS
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_youpi_deposit_order_rpc(NUMERIC, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_youpi_deposit_order_rpc(NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.credit_verified_youpi_deposit_rpc(TEXT, TEXT, NUMERIC, TEXT, TEXT, INTEGER, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.credit_verified_youpi_deposit_rpc(UUID, TEXT, NUMERIC, TEXT, TEXT, INTEGER, TEXT, JSONB);

-- ------------------------------------------------------------------------------
-- 3. VERIFICATION QUERIES (READ-ONLY AUDIT FOR REVIEWER)
-- ------------------------------------------------------------------------------
-- Run the following queries to verify the database state after applying:

-- A. Verify that schema "youpi" is gone:
-- SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'youpi';
-- Expected result: 0 rows

-- B. Verify that all core public tables are fully populated and intact:
-- SELECT 'public.wallets' AS tbl, count(*) FROM public.wallets
-- UNION ALL
-- SELECT 'public.merchant_wallets' AS tbl, count(*) FROM public.merchant_wallets
-- UNION ALL
-- SELECT 'public.wallet_transactions' AS tbl, count(*) FROM public.wallet_transactions
-- UNION ALL
-- SELECT 'public.deposit_requests' AS tbl, count(*) FROM public.deposit_requests
-- UNION ALL
-- SELECT 'public.withdrawals' AS tbl, count(*) FROM public.withdrawals
-- UNION ALL
-- SELECT 'public.lifafas' AS tbl, count(*) FROM public.lifafas
-- UNION ALL
-- SELECT 'public.lifafa_claims' AS tbl, count(*) FROM public.lifafa_claims;

-- C. Verify that authoritative manual deposit and payout RPCs exist and are active:
-- SELECT routine_schema, routine_name, routine_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name IN (
--     'submit_deposit_request_rpc',
--     'admin_review_deposit_rpc',
--     'request_withdrawal_rpc',
--     'admin_update_withdrawal_rpc',
--     'claim_lifafa_rpc'
--   );
-- Expected result: 5 rows corresponding to the five core financial procedures.
