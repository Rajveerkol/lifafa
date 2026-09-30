-- ==============================================================================
-- Migration: 033_cascade_delete_lifafas.sql
-- Description:
--   1. Fix foreign key constraints on lifafa_claims and withdrawal_source_allocations
--      to ON DELETE CASCADE so deleting a Lifafa automatically cascades and removes
--      associated claims and source allocations.
--   2. Refund any reserved balance of deleted active lifafas back to creator wallets.
--   3. Delete all legacy/test Lifafas except 'Primes Looter' (code: LF-307B3C).
-- Target: Supabase SQL Editor / Management API
-- ==============================================================================

-- 1. FIX FOREIGN KEYS TO CASCADE DELETE
ALTER TABLE public.lifafa_claims
    DROP CONSTRAINT IF EXISTS lifafa_claims_lifafa_id_fkey,
    ADD CONSTRAINT lifafa_claims_lifafa_id_fkey
        FOREIGN KEY (lifafa_id) REFERENCES public.lifafas(id) ON DELETE CASCADE;

ALTER TABLE public.lifafa_claims
    DROP CONSTRAINT IF EXISTS lifafa_claims_allocation_id_fkey,
    ADD CONSTRAINT lifafa_claims_allocation_id_fkey
        FOREIGN KEY (allocation_id) REFERENCES public.lifafa_allocations(id) ON DELETE CASCADE;

ALTER TABLE public.withdrawal_source_allocations
    DROP CONSTRAINT IF EXISTS withdrawal_source_allocations_lifafa_id_fkey,
    ADD CONSTRAINT withdrawal_source_allocations_lifafa_id_fkey
        FOREIGN KEY (lifafa_id) REFERENCES public.lifafas(id) ON DELETE CASCADE;

ALTER TABLE public.withdrawal_source_allocations
    DROP CONSTRAINT IF EXISTS withdrawal_source_allocations_claim_id_fkey,
    ADD CONSTRAINT withdrawal_source_allocations_claim_id_fkey
        FOREIGN KEY (claim_id) REFERENCES public.lifafa_claims(id) ON DELETE CASCADE;

-- 2. REFUND RESERVED BALANCE FOR DELETED ACTIVE LIFAFAS BACK TO CREATOR WALLETS
UPDATE public.wallets w
SET available_balance = available_balance + del.refund_amt,
    reserved_balance = GREATEST(0.00, reserved_balance - del.refund_amt),
    updated_at = TIMEZONE('utc'::text, NOW())
FROM (
    SELECT creator_id, SUM(remaining_amount) as refund_amt
    FROM public.lifafas
    WHERE code <> 'LF-307B3C' AND status = 'ACTIVE' AND remaining_amount > 0
    GROUP BY creator_id
) del
WHERE w.user_id = del.creator_id;

-- 3. DELETE ALL LIFAFAS EXCEPT PRIMES LOOTER (LF-307B3C)
DELETE FROM public.lifafas
WHERE code <> 'LF-307B3C';
