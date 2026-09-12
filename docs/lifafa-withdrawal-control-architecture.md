# Lifafa-Level Withdrawal Block / Unblock Architecture

## 1. Overview & Policy Semantics

This document outlines the architectural specification and implementation design for **Lifafa-Level Withdrawal Block / Unblock** (Migration 025).

The feature allows administrators to control whether funds claimed from a specific Lifafa can be withdrawn from the platform, while guaranteeing:
- Zero retroactive destruction of user rewards or wallet balances.
- Zero modification to existing financial wallet ledgers, deposit systems, PayRupee payout logic, platform fees (₹3.58), or Duel gaming logic.
- Real-time exclusion of restricted funds from user withdrawable balances.
- Full server-authoritative enforcement inside PostgreSQL under row-level locking.

### Core Distinctions
* **`ALLOWED` (Default)**: Winnings claimed from this Lifafa are fully eligible for withdrawal through standard platform rules.
* **`BLOCKED`**: Winnings claimed from this Lifafa remain safely credited to the recipient's wallet balance and can be utilized across platform features (e.g. ticket conversions, games), but **cannot** be withdrawn to bank/UPI accounts until the Lifafa is unblocked by an administrator.

---

## 2. Database Schema (Migration 025)

### 2.1 Lifafas Table Extension
```sql
ALTER TABLE public.lifafas 
ADD COLUMN IF NOT EXISTS withdrawal_status TEXT NOT NULL DEFAULT 'ALLOWED';

ALTER TABLE public.lifafas 
ADD CONSTRAINT chk_lifafas_withdrawal_status 
CHECK (withdrawal_status IN ('ALLOWED', 'BLOCKED'));

CREATE INDEX IF NOT EXISTS idx_lifafas_withdrawal_status 
ON public.lifafas (withdrawal_status);
```

### 2.2 Lifafa Claims Table Extension
```sql
ALTER TABLE public.lifafa_claims 
ADD COLUMN IF NOT EXISTS withdrawn_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00;

ALTER TABLE public.lifafa_claims 
ADD CONSTRAINT chk_lifafa_claims_withdrawn_amount 
CHECK (withdrawn_amount >= 0 AND withdrawn_amount <= amount);

CREATE INDEX IF NOT EXISTS idx_lifafa_claims_user_withdrawn 
ON public.lifafa_claims (user_id, withdrawn_amount, amount);
```

### 2.3 Withdrawal Source Allocations Table
An immutable tracking table recording exactly which Lifafa claim provided funds for each withdrawal request:
```sql
CREATE TABLE IF NOT EXISTS public.withdrawal_source_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id UUID NOT NULL REFERENCES public.withdrawals(id) ON DELETE CASCADE,
  claim_id UUID REFERENCES public.lifafa_claims(id) ON DELETE SET NULL,
  lifafa_id UUID REFERENCES public.lifafas(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  allocated_amount NUMERIC(12, 2) NOT NULL CHECK (allocated_amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 3. Mathematical Accounting Model

For any user with balance in `wallets`:
1. **Available Balance**: Total liquid funds held in the wallet (`wallet.available_balance`).
2. **Blocked Balance**: The sum of all remaining unwithdrawn funds from currently blocked Lifafas:
   $$\text{Blocked Balance} = \sum_{\substack{\text{claim} \in \text{Claims}(u) \\ \text{lifafa.status} = \text{'BLOCKED'}}} \max(0, \text{claim.amount} - \text{claim.withdrawn\_amount})$$
3. **Withdrawable Balance**: The effective liquid funds eligible for disbursement:
   $$\text{Withdrawable Balance} = \max(0, \text{Available Balance} - \text{Blocked Balance})$$

### Invariants:
* $\text{Withdrawable Balance} \le \text{Available Balance} \le \text{Total Earned}$
* $\text{claim.withdrawn\_amount} \le \text{claim.amount}$
* A Lifafa status toggle from `BLOCKED` to `ALLOWED` immediately releases $\text{claim.amount} - \text{claim.withdrawn\_amount}$ into the withdrawable pool.

---

## 4. Server-Authoritative RPC Functions

### 4.1 `admin_set_lifafa_withdrawal_status_rpc`
* **Security**: `SECURITY DEFINER`, search path pinned to `public, pg_temp`.
* **Authorization**: Strict check against `public.is_admin_user_v2(auth.uid())`.
* **Validation**: Mandatory reason string (minimum 3 characters) required when blocking.
* **Idempotency**: If `old_status == new_status`, returns `{ success: true, idempotent: true }` without writing audit logs.
* **Audit Logging**: Inserts record into `admin_audit_logs` with action `LIFAFA_WITHDRAWAL_BLOCKED` or `LIFAFA_WITHDRAWAL_ALLOWED`.

### 4.2 `get_user_withdrawable_balance_rpc`
* Returns `{ available_balance, blocked_balance, withdrawable_balance }` for authenticated user `auth.uid()`.

### 4.3 `request_withdrawal_rpc` (Upgraded)
* Serializes user withdrawals using `SELECT FOR UPDATE` on `wallets`.
* Computes `v_withdrawable_balance` directly on the server.
* Enforces `(p_amount + v_platform_fee) <= v_withdrawable_balance`.
* Performs FIFO source allocation against unblocked `lifafa_claims` under `FOR UPDATE` lock.
* Preserves ₹3.58 fixed platform fee and PayRupee payout record dispatch.

### 4.4 `admin_update_withdrawal_rpc` (Upgraded)
* When an admin marks a withdrawal `REJECTED`, allocated amounts are automatically refunded to `lifafa_claims.withdrawn_amount` via `withdrawal_source_allocations`.

---

## 5. Security & Isolation Matrix

| Component | Security Mechanism | Status |
| :--- | :--- | :--- |
| **RLS on `lifafas.withdrawal_status`** | Direct client updates prohibited; only service role / admin RPC permitted | **ENFORCED** |
| **RLS on `withdrawal_source_allocations`** | Users can only view their own allocations; Admin has full view | **ENFORCED** |
| **PayRupee Payout Isolation** | Payout provider endpoints and metadata untouched | **ENFORCED** |
| **Concurrency Protection** | PostgreSQL row-level locks on `wallets` and `lifafa_claims` | **ENFORCED** |
| **Zero Secret Leakage** | Client bundles contain no service-role keys, PayRupee keys, or bot tokens | **VERIFIED** |
