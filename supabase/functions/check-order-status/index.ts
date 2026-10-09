// Supabase Edge Function: check-order-status
// Merchant Gateway Dedicated Order ID Status Check & Safe Reconcile Endpoint
// 1. Authenticates caller via Supabase Bearer JWT.
// 2. Enforces Rate Limiting (10 requests/minute per merchant).
// 3. Validates and sanitizes order_id input.
// 4. Authoritatively verifies merchant ownership (only payouts belonging to this merchant).
//    - Returns ONLY "Transaction not found." on non-ownership / non-existence (Zero Data Leakage).
// 5. Short-circuits terminal states:
//    - SUCCESS: idempotent response, no duplicate refund or ledger entry.
//    - FAILED / REVERSED: idempotent response, already refunded.
// 6. Queries real PayNit status API server-side with 15s timeout:
//    - POST https://api.paynit.in/v1/status.php
// 7. Handles provider outcome:
//    - Timeout / 5xx / Network Error / Unknown -> Keeps PROCESSING, NEVER auto-refunds.
//    - Definitive Failure (FAILED / REJECTED / DECLINED) -> Invokes merchant_finalize_payout_failure_rpc
//      to refund exact locked float (amount + fee) and append refund ledger entries.
//    - Exactly one refund per payout.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-idempotency-key',
  'Access-Control-Max-Age': '86400',
};

// Activation boundary for automated status-check wallet refunds (ISO 8601).
// Payouts created BEFORE this timestamp are treated as HISTORICAL transactions
// and will NEVER be refunded or modified by this automated check.
const STATUS_REFUND_ACTIVATION_BOUNDARY = '2026-10-07T10:45:00.000Z';
function calculateMerchantPayoutFee(amount: number): number {
  const num = Math.round(Number(amount) * 100) / 100;
  if (isNaN(num) || num <= 0) return 0;
  if (num < 500) return 2.50;
  if (num < 1000) return 5.00;
  return 10.00;
}

// In-memory rate limiting map (sliding 60s window per merchant)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

interface RefundReconciliationResult {
  success: boolean;
  status: 'FAILED';
  refunded: boolean;
  already_refunded: boolean;
  is_historical?: boolean;
  no_deduction?: boolean;
  refund_amount: number;
  order_id: string;
  rejection_reason: string;
  message: string;
  refund_status?: 'REFUNDED' | 'NOT_APPLICABLE';
}

async function hashSecret(secret: string): Promise<string> {
  const data = new TextEncoder().encode(secret);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function reconcileFailedPayoutWithRefund(
  adminClient: any,
  merchantId: string,
  payout: any,
  rejectionReason: string,
  paynitData: any
): Promise<RefundReconciliationResult> {
  const payoutId = payout.id;
  const payoutAmount = Number(payout.amount || 0);
  const feeAmount = Number(payout.fee_amount != null ? payout.fee_amount : calculateMerchantPayoutFee(payoutAmount));
  const totalDeducted = Number(payout.total_deducted != null ? payout.total_deducted : (payoutAmount + feeAmount));

  // 1. BOUNDARY CHECK: Only NEW payouts created on or after activation boundary are eligible for automated refund
  const payoutCreatedAt = payout.created_at ? new Date(payout.created_at).getTime() : 0;
  const boundaryTime = new Date(STATUS_REFUND_ACTIVATION_BOUNDARY).getTime();
  const isHistoricalPayout = payoutCreatedAt < boundaryTime;

  if (isHistoricalPayout) {
    // Financial Safety: DO NOT modify wallet balances, DO NOT insert refund transactions
    return {
      success: false,
      status: 'FAILED',
      refunded: false,
      already_refunded: false,
      is_historical: true,
      refund_amount: 0,
      order_id: payout.order_id,
      rejection_reason: rejectionReason,
      message: 'Payment Failed',
      refund_status: 'NOT_APPLICABLE',
    };
  }

  // 2. DOUBLE-REFUND PROTECTION & IDEMPOTENCY CHECK
  const currentDbStatus = String(payout.status || '').toUpperCase();

  // Check existing refund ledger entries
  const { data: existingRefundLedgers } = await adminClient
    .from('merchant_ledger_entries')
    .select('id, entry_type')
    .eq('merchant_id', merchantId)
    .eq('reference_id', String(payoutId))
    .in('entry_type', ['PAYOUT_REFUND', 'PAYOUT_FEE_REFUND'])
    .limit(1);

  // Check existing wallet refund transactions
  const { data: existingWalletRefunds } = await adminClient
    .from('wallet_transactions')
    .select('id, type')
    .eq('reference_id', String(payoutId))
    .in('type', ['WITHDRAWAL_REVERSAL', 'REFUND'])
    .limit(1);

  const hasAlreadyRefunded =
    currentDbStatus === 'FAILED' ||
    currentDbStatus === 'REVERSED' ||
    (existingRefundLedgers && existingRefundLedgers.length > 0) ||
    (existingWalletRefunds && existingWalletRefunds.length > 0);

  if (hasAlreadyRefunded) {
    return {
      success: false,
      status: 'FAILED',
      already_refunded: true,
      refunded: false,
      refund_amount: totalDeducted,
      order_id: payout.order_id,
      rejection_reason: payout.rejection_reason || rejectionReason,
      message: `Payment Failed — ₹${totalDeducted.toFixed(2)} refunded to your wallet.`,
      refund_status: 'REFUNDED',
    };
  }

  // 3. ACTUAL DEDUCTION VERIFICATION: Verify wallet funds were ACTUALLY debited/locked
  const { data: existingDebits } = await adminClient
    .from('merchant_ledger_entries')
    .select('id, amount, entry_type')
    .eq('merchant_id', merchantId)
    .eq('reference_id', String(payoutId))
    .in('entry_type', ['PAYOUT_LOCK', 'PAYOUT_FEE_LOCK', 'PAYOUT'])
    .limit(1);

  const { data: existingWalletDebits } = await adminClient
    .from('wallet_transactions')
    .select('id, amount, type')
    .eq('reference_id', String(payoutId))
    .in('type', ['WITHDRAWAL', 'FEE'])
    .limit(1);

  const wasMoneyDeducted =
    totalDeducted > 0 &&
    ((existingDebits && existingDebits.length > 0) ||
     (existingWalletDebits && existingWalletDebits.length > 0) ||
     currentDbStatus === 'PENDING' ||
     currentDbStatus === 'PROCESSING');

  if (!wasMoneyDeducted) {
    // If no deduction was made, update status to FAILED but refund ₹0
    await adminClient
      .from('merchant_payouts')
      .update({
        status: 'FAILED',
        rejection_reason: rejectionReason,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', payoutId);

    return {
      success: false,
      status: 'FAILED',
      refunded: false,
      already_refunded: false,
      no_deduction: true,
      refund_amount: 0,
      order_id: payout.order_id,
      rejection_reason: rejectionReason,
      message: 'Payment Failed — no wallet deduction was found, so no refund was issued.',
      refund_status: 'NOT_APPLICABLE',
    };
  }

  // 4. ATTEMPT DATABASE RPC (if user has executed migration 066)
  try {
    const { data: rpcRes, error: rpcErr } = await adminClient.rpc('merchant_reconcile_payout_status_v2_rpc', {
      p_merchant_id: merchantId,
      p_order_id: payout.order_id,
      p_target_status: 'FAILED',
      p_rejection_reason: rejectionReason,
      p_raw_payload: paynitData,
      p_activation_boundary: STATUS_REFUND_ACTIVATION_BOUNDARY,
    });

    if (!rpcErr && rpcRes && rpcRes.success) {
      const isHist = Boolean(rpcRes.is_historical);
      const isNoDed = Boolean(rpcRes.no_deduction);
      const isRef = Boolean(rpcRes.refunded);
      const isAlrRef = Boolean(rpcRes.already_refunded);

      let msg = 'Payment Failed';
      let refStatus: 'REFUNDED' | 'NOT_APPLICABLE' = 'NOT_APPLICABLE';
      if (isRef || isAlrRef) {
        msg = `Payment Failed — ₹${totalDeducted.toFixed(2)} refunded to your wallet.`;
        refStatus = 'REFUNDED';
      } else if (isNoDed) {
        msg = 'Payment Failed — no wallet deduction was found, so no refund was issued.';
      }

      return {
        success: false,
        status: 'FAILED',
        refunded: isRef,
        already_refunded: isAlrRef,
        is_historical: isHist,
        no_deduction: isNoDed,
        refund_amount: Number(rpcRes.refund_amount || 0),
        order_id: payout.order_id,
        rejection_reason: rejectionReason,
        message: msg,
        refund_status: refStatus,
      };
    }
  } catch (rpcCallErr: any) {
    console.warn('Notice: merchant_reconcile_payout_status_v2_rpc not available or threw:', rpcCallErr?.message);
  }

  // 5. DIRECT SERVICE-ROLE DUAL-WALLET CREDITING (Primary, robust & immediate execution)
  // ATOMIC CONCURRENCY GUARD: Transition status to FAILED first with conditional update
  // Only EXACTLY ONE concurrent execution can succeed in transitioning status!
  const { data: updatedPayouts, error: updatePayoutErr } = await adminClient
    .from('merchant_payouts')
    .update({
      status: 'FAILED',
      rejection_reason: rejectionReason,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', payoutId)
    .neq('status', 'FAILED')
    .neq('status', 'REVERSED')
    .neq('status', 'SUCCESS')
    .select('id, status');

  if (updatePayoutErr || !updatedPayouts || updatedPayouts.length === 0) {
    // Concurrency Collision: Another concurrent request already transitioned this payout
    return {
      success: false,
      status: 'FAILED',
      already_refunded: true,
      refunded: false,
      refund_amount: totalDeducted,
      order_id: payout.order_id,
      rejection_reason: payout.rejection_reason || rejectionReason,
      message: `Payment Failed — ₹${totalDeducted.toFixed(2)} refunded to your wallet.`,
      refund_status: 'REFUNDED',
    };
  }

  // Retrieve merchant owner user_id
  const { data: merchantRec } = await adminClient
    .from('merchants')
    .select('id, user_id')
    .eq('id', merchantId)
    .single();

  if (!merchantRec || !merchantRec.user_id) {
    throw new Error('Merchant record or owner user ID not found');
  }

  const userId = merchantRec.user_id;

  // A. Credit public.wallets (authoritative user wallet displayed on website & dashboard)
  const { data: userWallet } = await adminClient
    .from('wallets')
    .select('id, available_balance, total_withdrawn')
    .eq('user_id', userId)
    .single();

  if (!userWallet) {
    throw new Error('Authoritative user wallet not found');
  }

  const userBalBefore = Number(userWallet.available_balance || 0);
  const userBalMid = userBalBefore + payoutAmount;
  const userBalAfter = userBalBefore + totalDeducted;
  const currentWithdrawn = Number(userWallet.total_withdrawn || 0);
  const newWithdrawn = Math.max(0, currentWithdrawn - payoutAmount);

  await adminClient
    .from('wallets')
    .update({
      available_balance: userBalAfter,
      total_withdrawn: newWithdrawn,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userWallet.id);

  // B. Credit public.merchant_wallets (tracks Gateway float & locked payout balance)
  const { data: mchWallet } = await adminClient
    .from('merchant_wallets')
    .select('id, available_balance, locked_payout_balance')
    .eq('merchant_id', merchantId)
    .maybeSingle();

  let mchBalBefore = userBalBefore;
  let mchBalMid = userBalMid;
  let mchBalAfter = userBalAfter;

  if (mchWallet) {
    mchBalBefore = Number(mchWallet.available_balance || 0);
    mchBalMid = mchBalBefore + payoutAmount;
    mchBalAfter = mchBalBefore + totalDeducted;
    const currLocked = Number(mchWallet.locked_payout_balance || 0);
    const newLocked = Math.max(0, currLocked - totalDeducted);

    await adminClient
      .from('merchant_wallets')
      .update({
        available_balance: mchBalAfter,
        locked_payout_balance: newLocked,
        updated_at: new Date().toISOString(),
      })
      .eq('id', mchWallet.id);
  }

  // C. Double-Entry Audit in public.merchant_ledger_entries
  const timestampMs = Date.now();
  if (mchWallet) {
    const ledgerRows = [
      {
        merchant_id: merchantId,
        wallet_id: mchWallet.id,
        amount: payoutAmount,
        fee_amount: 0.00,
        entry_type: 'PAYOUT_REFUND',
        reference_type: 'PAYOUT',
        reference_id: String(payoutId),
        idempotency_key: `mch_py_ref_amt_${payoutId}_${timestampMs}`,
        balance_before: mchBalBefore,
        balance_after: mchBalMid,
        metadata: {
          reason: rejectionReason,
          order_id: payout.order_id,
          provider_order_id: payout.provider_order_id,
          refund_type: 'PRINCIPAL',
          source: 'merchant_status_check',
        },
      },
      {
        merchant_id: merchantId,
        wallet_id: mchWallet.id,
        amount: feeAmount,
        fee_amount: 0.00,
        entry_type: 'PAYOUT_FEE_REFUND',
        reference_type: 'PAYOUT',
        reference_id: String(payoutId),
        idempotency_key: `mch_py_ref_fee_${payoutId}_${timestampMs}`,
        balance_before: mchBalMid,
        balance_after: mchBalAfter,
        metadata: {
          reason: rejectionReason,
          order_id: payout.order_id,
          fee_refunded: feeAmount,
          refund_type: 'FEE',
          source: 'merchant_status_check',
        },
      },
    ];
    await adminClient.from('merchant_ledger_entries').insert(ledgerRows);
  }

  // D. Double-Entry Audit in public.wallet_transactions
  const walletTxRows = [
    {
      user_id: userId,
      wallet_id: userWallet.id,
      amount: payoutAmount,
      type: 'WITHDRAWAL_REVERSAL',
      status: 'SUCCESS',
      reference_type: 'MERCHANT_PAYOUT',
      reference_id: String(payoutId),
      idempotency_key: `tx_mch_ref_amt_${payoutId}_${timestampMs}`,
      balance_before: userBalBefore,
      balance_after: userBalMid,
      metadata: {
        merchant_id: merchantId,
        order_id: payout.order_id,
        reason: rejectionReason,
        source: 'merchant_status_check',
      },
    },
    {
      user_id: userId,
      wallet_id: userWallet.id,
      amount: feeAmount,
      type: 'REFUND',
      status: 'SUCCESS',
      reference_type: 'MERCHANT_PAYOUT_FEE',
      reference_id: String(payoutId),
      idempotency_key: `tx_mch_ref_fee_${payoutId}_${timestampMs}`,
      balance_before: userBalMid,
      balance_after: userBalAfter,
      metadata: {
        merchant_id: merchantId,
        order_id: payout.order_id,
        fee: feeAmount,
        reason: rejectionReason,
        source: 'merchant_status_check',
      },
    },
  ];
  await adminClient.from('wallet_transactions').insert(walletTxRows);

  // E. Insert provider event log
  await adminClient
    .from('merchant_payout_events')
    .insert({
      provider_event_id: `evt_status_fail_${payoutId}_${timestampMs}`,
      payout_id: payoutId,
      event_type: 'payout.failed_refunded',
      raw_payload: paynitData,
    })
    .catch((evtErr: any) => console.warn('payout event insert warning:', evtErr?.message));

  return {
    success: false,
    status: 'FAILED',
    refunded: true,
    already_refunded: false,
    refund_amount: totalDeducted,
    order_id: payout.order_id,
    rejection_reason: rejectionReason,
    message: `Payment Failed — ₹${totalDeducted.toFixed(2)} refunded to your wallet.`,
    refund_status: 'REFUNDED',
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const paynitApiKey = Deno.env.get('PAYNIT_API_KEY') || '';
    const paynitApiSecret = Deno.env.get('PAYNIT_API_SECRET') || '';
    let paynitBaseUrl = (Deno.env.get('PAYNIT_BASE_URL') || 'https://api.paynit.in')
      .trim()
      .replace(/\/+$/, '')
      .replace(/\/api\/v1\/?$/, '')
      .replace(/\/v1\/?$/, '')
      .replace(/\/api\/?$/, '');
    if (!paynitBaseUrl.startsWith('http')) {
      paynitBaseUrl = 'https://api.paynit.in';
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, message: 'Server configuration error: missing database credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!paynitApiKey || !paynitApiSecret) {
      return new Response(
        JSON.stringify({ success: false, message: 'PayNit provider credentials not configured on server' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // 1. Authenticate Caller (Dual Auth: API Key OR Bearer Session)
    let merchantId: string | null = null;
    const clientIdHeader = req.headers.get('X-Client-Id') || req.headers.get('x-client-id');
    const clientSecretHeader = req.headers.get('X-Client-Secret') || req.headers.get('x-client-secret');
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');

    const clientIp = (
      req.headers.get('x-forwarded-for')?.split(',')[0] ||
      req.headers.get('cf-connecting-ip') ||
      '127.0.0.1'
    ).trim();

    if (clientIdHeader && clientSecretHeader) {
      // API Key Authentication Path
      const secretHash = await hashSecret(clientSecretHeader.trim());

      const { data: keyRecord, error: keyErr } = await adminClient
        .from('merchant_api_keys')
        .select('merchant_id, client_secret_hash, is_active')
        .eq('client_id', clientIdHeader.trim())
        .maybeSingle();

      if (keyErr || !keyRecord || !keyRecord.is_active || keyRecord.client_secret_hash !== secretHash) {
        return new Response(
          JSON.stringify({ success: false, message: 'Invalid API credentials' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      merchantId = keyRecord.merchant_id;

      // Verify merchant is ACTIVE and has PAID setup fee
      const { data: mchAuthRecord } = await adminClient
        .from('merchants')
        .select('id, status, setup_fee_status')
        .eq('id', merchantId)
        .maybeSingle();

      if (!mchAuthRecord || mchAuthRecord.status !== 'ACTIVE' || mchAuthRecord.setup_fee_status !== 'PAID') {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Merchant Gateway is not active. Account must be approved with PAID setup fee prior to API dispatch.',
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // IP Whitelist Check
      const { data: whitelist } = await adminClient
        .from('merchant_ip_whitelist')
        .select('ip_address')
        .eq('merchant_id', merchantId);

      if (whitelist && whitelist.length > 0) {
        const allowed = whitelist.some((entry: any) => String(entry.ip_address).trim() === clientIp);
        if (!allowed) {
          return new Response(
            JSON.stringify({ success: false, message: `Forbidden: Client IP ${clientIp} is not authorized for this merchant` }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Update last_used_at on API key
      await adminClient
        .from('merchant_api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('client_id', clientIdHeader.trim());

    } else if (authHeader && /^Bearer\s+/i.test(authHeader)) {
      // Browser Bearer JWT Authentication Path
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      const { data: { user }, error: userErr } = await adminClient.auth.getUser(token);

      if (userErr || !user) {
        return new Response(
          JSON.stringify({ success: false, message: 'Invalid API credentials' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: merchantRecord } = await adminClient
        .from('merchants')
        .select('id, user_id, status, setup_fee_status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!merchantRecord || merchantRecord.status !== 'ACTIVE' || merchantRecord.setup_fee_status !== 'PAID') {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'No active approved merchant account associated with this session. Setup fee must be PAID and account approved by admin.',
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      merchantId = merchantRecord.id;
    } else {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid API credentials' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!merchantId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid API credentials' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Rate Limiting (10 requests/minute per merchant)
    const now = Date.now();
    const rateKey = `mch_rate_${merchantId}`;
    const rateInfo = rateLimitMap.get(rateKey);
    if (rateInfo && rateInfo.resetAt > now) {
      if (rateInfo.count >= 10) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Too many status check requests. Please wait a minute before checking again.',
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      rateInfo.count += 1;
    } else {
      rateLimitMap.set(rateKey, { count: 1, resetAt: now + 60000 });
    }

    // 3. Parse and Validate Request Payload
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid JSON request payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawOrderId = body?.order_id || body?.orderId;
    if (!rawOrderId || typeof rawOrderId !== 'string') {
      return new Response(
        JSON.stringify({ success: false, message: 'Order ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanOrderId = rawOrderId.trim();
    if (cleanOrderId.length < 3 || cleanOrderId.length > 100 || !/^[a-zA-Z0-9_\-\.:]{3,100}$/.test(cleanOrderId)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid Order ID format. Please check the ID and try again.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanOrderId);

    // 4. Authoritative Ownership Verification (Gateway payout MUST belong to THIS merchant)
    let mQuery = adminClient
      .from('merchant_payouts')
      .select('id, merchant_id, amount, fee_amount, total_deducted, status, order_id, provider_order_id, provider_reference_id, rejection_reason, created_at, upi_id, payout_method')
      .eq('merchant_id', merchantId);

    if (isUuid) {
      mQuery = mQuery.or(`order_id.eq.${cleanOrderId},provider_order_id.eq.${cleanOrderId},provider_reference_id.eq.${cleanOrderId},id.eq.${cleanOrderId},order_id.ilike.${cleanOrderId},provider_reference_id.ilike.${cleanOrderId}`);
    } else {
      mQuery = mQuery.or(`order_id.eq.${cleanOrderId},provider_order_id.eq.${cleanOrderId},provider_reference_id.eq.${cleanOrderId},order_id.ilike.${cleanOrderId},provider_reference_id.ilike.${cleanOrderId}`);
    }

    const { data: payouts, error: pErr } = await mQuery.order('created_at', { ascending: false }).limit(1);
    const payout = payouts && payouts.length > 0 ? payouts[0] : null;

    // Strict Data Isolation / Anti-Enumeration Protection:
    // If not found or belongs to another merchant, return ONLY "Transaction not found." with ZERO data leakage
    if (pErr || !payout) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Transaction not found',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payoutId = payout.id;
    const currentDbStatus = String(payout.status || '').toUpperCase();
    const payoutAmount = Number(payout.amount);
    const feeAmount = Number(payout.fee_amount != null ? payout.fee_amount : calculateMerchantPayoutFee(payoutAmount));
    const totalDeducted = Number(payout.total_deducted != null ? payout.total_deducted : (payoutAmount + feeAmount));

    // Determine historical vs new transaction boundary
    const payoutCreatedAt = payout.created_at ? new Date(payout.created_at).getTime() : 0;
    const boundaryTime = new Date(STATUS_REFUND_ACTIVATION_BOUNDARY).getTime();
    const isHistoricalPayout = payoutCreatedAt < boundaryTime;

    // 5. Short-Circuit Terminal States (Idempotency & Double-Refund Protection)
    if (currentDbStatus === 'SUCCESS') {
      return new Response(
        JSON.stringify({
          success: true,
          order_id: payout.order_id,
          status: 'SUCCESS',
          message: 'Payment Completed',
          amount: payoutAmount,
          payout_method: payout.payout_method || 'UPI',
          upi_id: payout.upi_id || '',
          utr: payout.provider_reference_id || payout.provider_order_id || '',
          fee: feeAmount,
          total_deducted: totalDeducted,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (currentDbStatus === 'FAILED' || currentDbStatus === 'REVERSED') {
      if (isHistoricalPayout) {
        return new Response(
          JSON.stringify({
            success: false,
            order_id: payout.order_id,
            status: 'FAILED',
            message: 'Payment Failed',
            refund_status: 'NOT_APPLICABLE',
            is_historical: true,
            refunded: false,
            already_refunded: false,
            refund_amount: 0,
            rejection_reason: payout.rejection_reason || 'Payment failed at banking provider',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          order_id: payout.order_id,
          status: 'FAILED',
          message: `Payment Failed — ₹${totalDeducted.toFixed(2)} refunded to your wallet.`,
          refund_status: 'REFUNDED',
          already_refunded: true,
          refunded: false,
          refund_amount: totalDeducted,
          rejection_reason: payout.rejection_reason || 'Payment failed at banking provider',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Query Real PayNit Provider Status API Server-Side
    const paynitPortalCookie = Deno.env.get('PAYNIT_PORTAL_COOKIE') || Deno.env.get('PAYNIT_SID') || '';
    const paynitLookupId = (cleanOrderId.toUpperCase().startsWith('PN'))
      ? cleanOrderId
      : (payout.provider_reference_id || payout.provider_order_id || payout.order_id || cleanOrderId);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let paynitRes: Response | null = null;
    let paynitData: any = {};
    let queryCompleted = false;

    // A. If portal session cookie is configured, attempt portal refresh endpoint
    if (paynitPortalCookie) {
      try {
        const portalRes = await fetch('https://portal.paynit.in/user/api/refresh_txn.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `PAYNIT_SID=${paynitPortalCookie}`,
            'User-Agent': 'Createlifafa-Gateway/1.0',
            'Origin': 'https://portal.paynit.in',
            'Referer': 'https://portal.paynit.in/user/payout_history.php',
          },
          body: JSON.stringify({ order_id: paynitLookupId }),
          signal: controller.signal,
          redirect: 'manual',
        });

        if (portalRes.status === 200) {
          const contentType = portalRes.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const portalJson = await portalRes.json().catch(() => null);
            if (portalJson && typeof portalJson === 'object' && (portalJson.status !== undefined || portalJson.success !== undefined)) {
              paynitData = portalJson;
              paynitRes = portalRes;
              queryCompleted = true;
            }
          }
        }
      } catch (_portalErr) {
        // Portal request failed or timed out; seamlessly proceed to official API
      }
    }

    // B. Query official server-to-server PayNit status API
    if (!queryCompleted) {
      try {
        const paynitAuthHeader = `Bearer ${paynitApiKey}:${paynitApiSecret}`;
        let statusUrl = `${paynitBaseUrl}/v1/status.php`;
        paynitRes = await fetch(statusUrl, {
          method: 'POST',
          headers: {
            Authorization: paynitAuthHeader,
            'Content-Type': 'application/json',
            Origin: 'https://createlifafa.xyz',
          },
          body: JSON.stringify({ order_id: paynitLookupId }),
          signal: controller.signal,
        });

        if (paynitRes.status === 404) {
          statusUrl = `${paynitBaseUrl}/status.php`;
          paynitRes = await fetch(statusUrl, {
            method: 'POST',
            headers: {
              Authorization: paynitAuthHeader,
              'Content-Type': 'application/json',
              Origin: 'https://createlifafa.xyz',
            },
            body: JSON.stringify({ order_id: paynitLookupId }),
            signal: controller.signal,
          });
        }

        clearTimeout(timeoutId);
        paynitData = await paynitRes.json().catch(() => ({}));
      } catch (_networkErr) {
        clearTimeout(timeoutId);
        // FINANCIAL SAFETY RULE: On timeout, network failure, or abort, NEVER auto-refund!
        return new Response(
          JSON.stringify({
            success: true,
            order_id: payout.order_id,
            status: 'PROCESSING',
            message: 'Payment is still processing. No refund has been issued.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      clearTimeout(timeoutId);
    }

    // 7. Evaluate Provider Outcome
    const statusCode = paynitRes ? paynitRes.status : 500;
    if (statusCode >= 500) {
      // Upstream 5xx: State is uncertain -> DO NOT refund
      return new Response(
        JSON.stringify({
          success: true,
          order_id: payout.order_id,
          status: 'PROCESSING',
          message: 'Payment is still processing. No refund has been issued.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawStatus = String(
      paynitData.status ||
      paynitData.transaction?.status ||
      paynitData.data?.status ||
      ''
    ).toLowerCase().trim();

    const rawMessage = String(
      paynitData.message ||
      paynitData.msg ||
      paynitData.error ||
      paynitData.data?.message ||
      ''
    ).trim();

    const rawUtr = String(
      paynitData.utr ||
      paynitData.rrn ||
      paynitData.bank_ref_no ||
      paynitData.reference_id ||
      paynitData.data?.utr ||
      paynitData.transaction?.utr ||
      ''
    ).trim();

    // Preserve existing valid UTR if current response omits it (Never overwrite with empty)
    const effectiveUtr = rawUtr || payout.provider_reference_id || payout.provider_order_id || '';

    // If provider returned a new valid UTR, persist it to database
    if (rawUtr && rawUtr !== payout.provider_reference_id) {
      await adminClient
        .from('merchant_payouts')
        .update({
          provider_reference_id: rawUtr,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payoutId);
    }

    const isSuccess = rawStatus === 'success' || rawStatus === 'processed' || rawStatus === 'completed';
    const isProcessing = rawStatus === 'processing' || rawStatus === 'pending' || rawStatus === 'queued' || rawStatus === 'in_process';
    const isDefinitiveFailure =
      rawStatus === 'failed' ||
      rawStatus === 'rejected' ||
      rawStatus === 'declined' ||
      rawStatus === 'reversed' ||
      rawStatus === 'cancelled' ||
      rawStatus === 'canceled' ||
      (statusCode === 400 && paynitData.success === false && rawStatus === '');

    // 8. Handle SUCCESS -> Finalize State Idempotently (NEVER REFUND)
    if (isSuccess) {
      await adminClient
        .from('merchant_payouts')
        .update({
          status: 'SUCCESS',
          provider_reference_id: effectiveUtr,
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', payoutId);

      // Release locked float in merchant_wallets without adding to available balance
      const { data: mWallet } = await adminClient
        .from('merchant_wallets')
        .select('id, locked_payout_balance')
        .eq('merchant_id', merchantId)
        .maybeSingle();

      if (mWallet) {
        await adminClient
          .from('merchant_wallets')
          .update({
            locked_payout_balance: Math.max(0, Number(mWallet.locked_payout_balance || 0) - totalDeducted),
            updated_at: new Date().toISOString(),
          })
          .eq('id', mWallet.id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          order_id: payout.order_id,
          status: 'SUCCESS',
          message: 'Payment Completed',
          amount: payoutAmount,
          payout_method: payout.payout_method || 'UPI',
          upi_id: payout.upi_id || '',
          utr: effectiveUtr,
          fee: feeAmount,
          total_deducted: totalDeducted,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 9. Handle PROCESSING / PENDING -> Retain Processing State (NEVER REFUND)
    if (isProcessing) {
      return new Response(
        JSON.stringify({
          success: true,
          order_id: payout.order_id,
          status: 'PROCESSING',
          message: 'Payment is still processing. No refund has been issued.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 10. Handle DEFINITIVE FAILED -> Safe Authoritative Wallet Refund (Maximum Once, New Transactions Only)
    if (isDefinitiveFailure) {
      const rejectionReason = rawMessage || 'Payment failed at banking provider';
      try {
        const refundResult = await reconcileFailedPayoutWithRefund(
          adminClient,
          merchantId,
          payout,
          rejectionReason,
          paynitData
        );

        return new Response(
          JSON.stringify(refundResult),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (refundErr: any) {
        console.error('Safe refund reconciliation exception:', refundErr);
        return new Response(
          JSON.stringify({
            success: false,
            order_id: payout.order_id,
            status: 'FAILED',
            message: 'Payment Failed',
            error: refundErr?.message || 'Failed to complete wallet refund reconciliation',
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 11. Ambiguous / Unknown / Malformed Provider Response -> NEVER REFUND
    return new Response(
      JSON.stringify({
        success: true,
        order_id: payout.order_id,
        status: 'PROCESSING',
        message: 'Payment is still processing. No refund has been issued.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('check-order-status error:', err);
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error while checking status' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
