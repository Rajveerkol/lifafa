// Supabase Edge Function: merchant-paynit-payout
// Dedicated Multi-Merchant Payout Gateway Outbound Dispatch via PayNit (UPI ONLY).
// 1. Authenticates via API Key (X-Client-Id + X-Client-Secret) OR Supabase Bearer JWT.
// 2. Checks client IP against merchant_ip_whitelist.
// 3. Enforces Payout Method: UPI ONLY (rejects IMPS / bank account attempts).
// 4. Invokes merchant_initiate_payout_rpc for atomic float deduction & authoritative ₹2.50 fee.
// 5. Dispatches server-side HTTP POST to PayNit API (https://api.paynit.in/v1/payout.php).
// 6. PayNit Authentication: Bearer PAYNIT_API_KEY:PAYNIT_API_SECRET (Server-side ONLY).
// 7. Handles Real PayNit Response:
//    a. SUCCESS / processed -> Finalized via merchant_finalize_payout_success_rpc.
//    b. processing / pending -> Held in PROCESSING with provider_reference_id.
//    c. Network timeout / 5xx -> Retained in PROCESSING. NEVER auto-refunds on ambiguous state.
//    d. Definitive 4xx / rejection -> FAILED with atomic float & fee refund.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-id, x-client-secret, x-idempotency-key',
  'Access-Control-Max-Age': '86400',
};

const PAYNIT_PAYOUT_FEE = 2.50;

async function hashSecret(secret: string): Promise<string> {
  const data = new TextEncoder().encode(secret);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Activation boundary for automated status-check wallet refunds (ISO 8601).
// Payouts created BEFORE this timestamp are treated as HISTORICAL transactions
// and will NEVER be refunded or modified by this automated check.
const STATUS_REFUND_ACTIVATION_BOUNDARY = '2026-10-07T10:45:00.000Z';

// In-memory rate limiting map for merchant status checks (sliding 60s window per merchant)
const merchantStatusRateLimit = new Map<string, { count: number; resetAt: number }>();

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
  const feeAmount = Number(payout.fee_amount != null ? payout.fee_amount : PAYNIT_PAYOUT_FEE);
  const totalDeducted = Number(payout.total_deducted != null ? payout.total_deducted : (payoutAmount + feeAmount));

  // 1. BOUNDARY CHECK: Only NEW payouts created on or after activation boundary are eligible for automated refund
  const payoutCreatedAt = payout.created_at ? new Date(payout.created_at).getTime() : 0;
  const boundaryTime = new Date(STATUS_REFUND_ACTIVATION_BOUNDARY).getTime();
  const isHistoricalPayout = payoutCreatedAt < boundaryTime;

  if (isHistoricalPayout) {
    // Financial Safety: DO NOT modify wallet balances, DO NOT insert refund transactions
    return {
      success: true,
      status: 'FAILED',
      refunded: false,
      already_refunded: false,
      is_historical: true,
      refund_amount: 0,
      order_id: payout.order_id,
      rejection_reason: rejectionReason,
      message: 'Historical transaction created prior to automated refund activation. Wallet balance was not modified.',
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
      success: true,
      status: 'FAILED',
      already_refunded: true,
      refunded: false,
      refund_amount: totalDeducted,
      order_id: payout.order_id,
      rejection_reason: payout.rejection_reason || rejectionReason,
      message: `Payout is already marked as Failed. The authoritative refund of ₹${totalDeducted.toFixed(2)} was already credited to your wallet previously.`,
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
      success: true,
      status: 'FAILED',
      refunded: false,
      already_refunded: false,
      no_deduction: true,
      refund_amount: 0,
      order_id: payout.order_id,
      rejection_reason: rejectionReason,
      message: 'Payout marked as Failed. No wallet deduction was recorded for this transaction, so no refund was required.',
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
      return {
        success: true,
        status: 'FAILED',
        refunded: Boolean(rpcRes.refunded),
        already_refunded: Boolean(rpcRes.already_refunded),
        is_historical: Boolean(rpcRes.is_historical),
        no_deduction: Boolean(rpcRes.no_deduction),
        refund_amount: Number(rpcRes.refund_amount || 0),
        order_id: payout.order_id,
        rejection_reason: rejectionReason,
        message: rpcRes.message || `Payout Failed. The authoritative amount of ₹${totalDeducted.toFixed(2)} has been refunded to your Gateway wallet.`,
      };
    }
  } catch (rpcCallErr: any) {
    console.warn('Notice: merchant_reconcile_payout_status_v2_rpc not available or threw:', rpcCallErr?.message);
  }

  // 5. DIRECT SERVICE-ROLE DUAL-WALLET CREDITING (Primary, robust & immediate execution)
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

  // E. Update public.merchant_payouts record
  await adminClient
    .from('merchant_payouts')
    .update({
      status: 'FAILED',
      rejection_reason: rejectionReason,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', payoutId);

  // F. Insert provider event log
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
    success: true,
    status: 'FAILED',
    refunded: true,
    already_refunded: false,
    refund_amount: totalDeducted,
    order_id: payout.order_id,
    rejection_reason: rejectionReason,
    message: `Payout Failed. The authoritative amount of ₹${totalDeducted.toFixed(2)} has been refunded to your Gateway wallet.`,
  };
}

async function handleMerchantCheckOrderStatus(
  adminClient: any,
  merchantId: string,
  body: any,
  paynitApiKey: string,
  paynitApiSecret: string,
  paynitBaseUrl: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const now = Date.now();
  const rateKey = `mch_rate_${merchantId}`;
  const rateInfo = merchantStatusRateLimit.get(rateKey);
  if (rateInfo && rateInfo.resetAt > now) {
    if (rateInfo.count >= 10) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Too many status check requests. Please wait a minute before checking again.',
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    rateInfo.count += 1;
  } else {
    merchantStatusRateLimit.set(rateKey, { count: 1, resetAt: now + 60000 });
  }

  // 1. Input Validation and Sanitization
  const rawOrderId = body?.order_id || body?.orderId;
  if (!rawOrderId || typeof rawOrderId !== 'string') {
    return new Response(
      JSON.stringify({ success: false, error: 'Order ID is required.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const cleanOrderId = rawOrderId.trim();
  if (cleanOrderId.length < 3 || cleanOrderId.length > 100 || !/^[a-zA-Z0-9_\-\.:]{3,100}$/.test(cleanOrderId)) {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid Order ID format. Please check the ID and try again.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanOrderId);

  // 2. Authoritative Ownership Verification: Payout MUST belong to THIS merchant
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
  // If not found or belongs to another merchant, return generic 404 with ZERO data leakage
  if (pErr || !payout) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Transaction not found.',
      }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const payoutId = payout.id;
  const currentDbStatus = String(payout.status || '').toUpperCase();
  const payoutAmount = Number(payout.amount);
  const feeAmount = Number(payout.fee_amount != null ? payout.fee_amount : 2.50);
  const totalDeducted = Number(payout.total_deducted != null ? payout.total_deducted : (payoutAmount + feeAmount));

  // Determine historical vs new transaction boundary
  const payoutCreatedAt = payout.created_at ? new Date(payout.created_at).getTime() : 0;
  const boundaryTime = new Date(STATUS_REFUND_ACTIVATION_BOUNDARY).getTime();
  const isHistoricalPayout = payoutCreatedAt < boundaryTime;

  // 3. Short-Circuit Terminal States (Idempotency & Double-Refund Protection)
  if (currentDbStatus === 'SUCCESS') {
    return new Response(
      JSON.stringify({
        success: true,
        status: 'SUCCESS',
        order_id: payout.order_id,
        amount: payoutAmount,
        fee: feeAmount,
        total_deducted: totalDeducted,
        provider_reference_id: payout.provider_reference_id,
        message: 'Payment Successful. Payout has been completed by the banking network.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (currentDbStatus === 'FAILED' || currentDbStatus === 'REVERSED') {
    if (isHistoricalPayout) {
      return new Response(
        JSON.stringify({
          success: true,
          status: 'FAILED',
          is_historical: true,
          refunded: false,
          already_refunded: false,
          refund_amount: 0,
          order_id: payout.order_id,
          rejection_reason: payout.rejection_reason,
          message: 'Historical transaction created prior to automated refund activation. Wallet balance was not modified.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: 'FAILED',
        already_refunded: true,
        refunded: false,
        refund_amount: totalDeducted,
        order_id: payout.order_id,
        rejection_reason: payout.rejection_reason,
        message: `Payout is already marked as Failed. The authoritative refund of ₹${totalDeducted.toFixed(2)} was already credited to your wallet previously.`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 4. Query Real PayNit Provider Status API Server-Side
  const paynitLookupId = (cleanOrderId.toUpperCase().startsWith('PN'))
    ? cleanOrderId
    : (payout.provider_reference_id || payout.provider_order_id || payout.order_id || cleanOrderId);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  let paynitRes: Response | null = null;
  let paynitData: any = {};
  const paynitAuthHeader = `Bearer ${paynitApiKey}:${paynitApiSecret}`;

  try {
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
        success: false,
        status: 'PROCESSING',
        order_id: payout.order_id,
        amount: payoutAmount,
        message: 'Unable to confirm the final status. Please try again later.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 5. Evaluate Provider Outcome
  const statusCode = paynitRes.status;
  if (statusCode >= 500) {
    // Upstream 5xx: State is uncertain -> DO NOT refund
    return new Response(
      JSON.stringify({
        success: false,
        status: 'PROCESSING',
        order_id: payout.order_id,
        amount: payoutAmount,
        message: 'Unable to confirm the final status. Please try again later.',
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

  // 6. Handle SUCCESS -> Finalize State Idempotently (NEVER REFUND)
  if (isSuccess) {
    // Update payout status if not already success
    await adminClient
      .from('merchant_payouts')
      .update({
        status: 'SUCCESS',
        provider_reference_id: paynitData.order_id || paynitLookupId,
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
        status: 'SUCCESS',
        order_id: payout.order_id,
        amount: payoutAmount,
        fee: feeAmount,
        total_deducted: totalDeducted,
        provider_reference_id: paynitData.order_id || paynitLookupId,
        message: 'Payment Successful. Payout has been completed by the banking network.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 7. Handle PROCESSING / PENDING -> Retain Processing State (NEVER REFUND)
  if (isProcessing) {
    return new Response(
      JSON.stringify({
        success: true,
        status: 'PROCESSING',
        order_id: payout.order_id,
        amount: payoutAmount,
        message: 'Transaction is still processing.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 8. Handle DEFINITIVE FAILED -> Safe Authoritative Wallet Refund (Maximum Once, New Transactions Only)
  if (isDefinitiveFailure) {
    const rejectionReason = paynitData.message || paynitData.error || 'Payment failed at banking provider';
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
          status: 'FAILED',
          order_id: payout.order_id,
          error: refundErr?.message || 'Failed to complete wallet refund reconciliation',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // 9. Ambiguous / Unknown Provider Response -> NEVER REFUND
  return new Response(
    JSON.stringify({
      success: false,
      status: 'UNKNOWN',
      order_id: payout.order_id,
      message: 'Unable to confirm status. Please try again later.',
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
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
      .replace(/\/api\/?$/, '')
      .replace(/\/payout\.php\/?$/, '');
    if (!paynitBaseUrl.startsWith('http')) {
      paynitBaseUrl = 'https://api.paynit.in';
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: missing Supabase credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!paynitApiKey || !paynitApiSecret) {
      const missingVars: string[] = [];
      if (!paynitApiKey) missingVars.push('PAYNIT_API_KEY');
      if (!paynitApiSecret) missingVars.push('PAYNIT_API_SECRET');
      console.error(`PayNit provider credentials missing on server: ${missingVars.join(', ')}`);
      return new Response(
        JSON.stringify({ error: 'PayNit provider credentials not configured on server' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // 1. Resolve Caller Identity (API Key or Bearer Session)
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
          JSON.stringify({ error: 'Invalid or inactive merchant API credentials' }),
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
            error: 'Merchant Gateway is not active. Account must be approved with PAID setup fee prior to API dispatch.',
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
            JSON.stringify({ error: `Forbidden: Client IP ${clientIp} is not authorized for this merchant` }),
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
          JSON.stringify({ error: 'Unauthorized session' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: merchantRecord } = await adminClient
        .from('merchants')
        .select('id, status, setup_fee_status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!merchantRecord || merchantRecord.status !== 'ACTIVE' || merchantRecord.setup_fee_status !== 'PAID') {
        return new Response(
          JSON.stringify({
            error: 'No active approved merchant account associated with this session. Setup fee must be PAID and account approved by admin.',
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      merchantId = merchantRecord.id;
    } else {
      return new Response(
        JSON.stringify({ error: 'Missing authentication: provide X-Client-Id/Secret or Authorization Bearer' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!merchantId) {
      return new Response(
        JSON.stringify({ error: 'Unable to resolve merchant identity' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Parse and Validate Request Payload
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2.a. Merchant Order ID Status Check & Safe Reconcile Action
    // CRITICAL: Strictly isolate status check from payout initiation!
    // A status check request requires ONLY: { "order_id": "<ORDER_ID>" }
    // It must NEVER require payout amount, amount > 0, recipient, or fees.
    const isStatusCheck =
      body.action === 'check_order_status' ||
      body.action === 'status' ||
      body.action === 'check_status' ||
      body.action === 'order_status' ||
      body.action === 'lookup' ||
      (Boolean(body.order_id || body.orderId) &&
        (body.amount === undefined || body.amount === null || isNaN(Number(body.amount))) &&
        !body.upi_id &&
        !body.recipient &&
        !body.account_number);

    if (isStatusCheck) {
      return await handleMerchantCheckOrderStatus(
        adminClient,
        merchantId,
        body,
        paynitApiKey,
        paynitApiSecret,
        paynitBaseUrl,
        corsHeaders
      );
    }

    const orderId = String(body.order_id || body.orderId || `m_ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`).trim();
    const amount = Number(body.amount);
    const note = String(body.note || body.description || 'Merchant payout').trim().slice(0, 100);
    const idempotencyKey = req.headers.get('X-Idempotency-Key') || req.headers.get('x-idempotency-key') || body.idempotency_key || null;

    if (!amount || isNaN(amount) || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Valid payout amount greater than zero is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine Payout Method: UPI ONLY (IMPS no longer supported)
    const recipient = body.recipient || {};
    const rawMethod = String(body.type || body.method || body.payout_method || '').toUpperCase().trim();
    const hasBankField = Boolean(body.account_number || recipient.account_number || body.bank_account_number || recipient.ifsc || body.ifsc_code);

    if (rawMethod === 'IMPS' || hasBankField) {
      return new Response(
        JSON.stringify({ error: 'IMPS and bank account payouts are no longer supported. All merchant payouts are processed via UPI only.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const upiId = String(body.upi_id || recipient.upi_id || '').trim();
    if (!upiId || !/^[a-zA-Z0-9._-]{2,255}@[a-zA-Z]{2,64}$/.test(upiId)) {
      return new Response(
        JSON.stringify({ error: 'A valid UPI ID is required for payout. Expected format: username@bank' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const method: 'UPI' = 'UPI';
    const accountHolderName = String(body.account_holder_name || recipient.name || 'UPI Beneficiary').trim();

    // 3. Execute Atomic Payout Initiation RPC (Pessimistic float deduction + authoritative ₹2.50 fee)
    let initRes: any = null;
    let initErr: any = null;

    // Try upgraded 9-arg RPC signature (Migration 037/039)
    const rpc9Attempt = await adminClient.rpc('merchant_initiate_payout_rpc', {
      p_merchant_id: merchantId,
      p_order_id: orderId,
      p_amount: amount,
      p_payout_method: method,
      p_upi_id: upiId,
      p_account_holder_name: accountHolderName,
      p_bank_account_number: null,
      p_ifsc_code: null,
      p_idempotency_key: idempotencyKey,
    });

    if (rpc9Attempt.error && rpc9Attempt.error.message?.includes('function public.merchant_initiate_payout_rpc')) {
      // Fallback to legacy 7-arg signature if migration is pending manual execution
      const rpc7Attempt = await adminClient.rpc('merchant_initiate_payout_rpc', {
        p_merchant_id: merchantId,
        p_order_id: orderId,
        p_amount: amount,
        p_account_holder_name: accountHolderName,
        p_bank_account_number: 'UPI_RAIL',
        p_ifsc_code: 'UPI0000000',
        p_idempotency_key: idempotencyKey,
      });
      initRes = rpc7Attempt.data;
      initErr = rpc7Attempt.error;
    } else {
      initRes = rpc9Attempt.data;
      initErr = rpc9Attempt.error;
    }

    if (initErr || !initRes?.success) {
      return new Response(
        JSON.stringify({ error: initErr?.message || 'Failed to initiate merchant payout' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If request was already processed idempotently
    if (initRes.idempotent) {
      return new Response(
        JSON.stringify({
          success: true,
          idempotent: true,
          payout_id: initRes.payout_id,
          provider_order_id: initRes.provider_order_id,
          status: initRes.status,
          amount: amount,
          fee: 2.50,
          total_debited: amount + 2.50,
          method: method,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payoutId = initRes.payout_id;
    const providerOrderId = initRes.provider_order_id;
    const authoritativeFee = 2.50; // MANDATORY FLAT ₹2.50 FEE
    const totalDebited = amount + authoritativeFee;

    // 4. Build PayNit Official Documented UPI Payout Payload
    const paynitPayload = {
      type: 'UPI',
      amount: amount,
      upi_id: upiId,
      note: note,
    };

    // 6. Dispatch HTTP POST to PayNit API (Server-Side Isolated)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let paynitRes: Response | null = null;
    let paynitData: any = {};
    const paynitAuthHeader = `Bearer ${paynitApiKey}:${paynitApiSecret}`;

    try {
      // Official PayNit documented payout endpoint: /v1/payout.php
      const payoutUrl = `${paynitBaseUrl}/v1/payout.php`;
      paynitRes = await fetch(payoutUrl, {
        method: 'POST',
        headers: {
          Authorization: paynitAuthHeader,
          'Content-Type': 'application/json',
          Origin: 'https://createlifafa.xyz',
        },
        body: JSON.stringify(paynitPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      paynitData = await paynitRes.json().catch(() => ({}));
    } catch (netErr: any) {
      clearTimeout(timeoutId);

      // Network / Request timeout -> State is UNCERTAIN.
      // CRITICAL: Do NOT mark FAILED or auto-refund float! Upstream PayNit may have processed disbursement.
      // Retain locked float and update status to PROCESSING awaiting status check / reconciliation.
      const timeoutReason = `Network dispatch timeout: ${netErr.message || 'Timeout contacting PayNit'}`;

      await adminClient
        .from('merchant_payouts')
        .update({
          status: 'PROCESSING',
          payout_provider: 'PAYNIT',
          rejection_reason: timeoutReason,
          updated_at: new Date().toISOString(),
        })
        .eq('provider_order_id', providerOrderId)
        .eq('status', 'PENDING');

      await adminClient.from('merchant_payout_events').insert({
        provider_event_id: `pn_net_err_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        payout_id: payoutId,
        event_type: 'paynit.dispatch_timeout',
        raw_payload: { error: netErr.message, provider_order_id: providerOrderId, method },
      });

      return new Response(
        JSON.stringify({
          success: false,
          status: 'PROCESSING',
          order_id: orderId,
          provider_order_id: providerOrderId,
          amount: amount,
          fee: authoritativeFee,
          total_debited: totalDebited,
          method: method,
          error: timeoutReason,
          message: 'Dispatch timed out contacting PayNit. Payout held in PROCESSING state awaiting reconciliation. Float is preserved.',
        }),
        { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Process Real PayNit Provider Response
    const paynitOrderId = paynitData.order_id || paynitData.transaction?.order_id || null;
    const rawPaynitStatus = String(paynitData.status || paynitData.transaction?.status || '').toLowerCase();

    if (paynitRes.ok && paynitData.success === true) {
      // PayNit accepted the payout request
      if (rawPaynitStatus === 'success' || rawPaynitStatus === 'processed') {
        // Immediate confirmed success
        const eventId = `pn_succ_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await adminClient.rpc('merchant_finalize_payout_success_rpc', {
          p_provider_order_id: providerOrderId,
          p_provider_reference_id: paynitOrderId,
          p_provider_event_id: eventId,
          p_raw_payload: paynitData,
        });

        return new Response(
          JSON.stringify({
            success: true,
            status: 'SUCCESS',
            order_id: orderId,
            provider_order_id: providerOrderId,
            provider_reference_id: paynitOrderId,
            amount: amount,
            fee: authoritativeFee,
            total_debited: totalDebited,
            method: method,
            message: 'Payment Completed via PayNit',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Status is 'processing' or 'pending' -> Standard PayNit real-time queuing
        await adminClient
          .from('merchant_payouts')
          .update({
            status: 'PROCESSING',
            payout_provider: 'PAYNIT',
            provider_reference_id: paynitOrderId,
            updated_at: new Date().toISOString(),
          })
          .eq('provider_order_id', providerOrderId);

        await adminClient.from('merchant_payout_events').insert({
          provider_event_id: `pn_proc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          payout_id: payoutId,
          event_type: 'paynit.processing',
          raw_payload: paynitData,
        });

        return new Response(
          JSON.stringify({
            success: true,
            status: 'PROCESSING',
            order_id: orderId,
            provider_order_id: providerOrderId,
            provider_reference_id: paynitOrderId,
            amount: amount,
            fee: authoritativeFee,
            total_debited: totalDebited,
            method: method,
            message: 'Payout initiated and processing via PayNit',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (paynitRes.status >= 500) {
      // PayNit Upstream Server Error (HTTP 5xx) -> UNCERTAIN STATE.
      // CRITICAL: Hold in PROCESSING. NEVER auto-refund on upstream 5xx.
      const rejectionReason = paynitData.message || paynitData.error || `PayNit upstream error (HTTP ${paynitRes.status})`;

      await adminClient
        .from('merchant_payouts')
        .update({
          status: 'PROCESSING',
          payout_provider: 'PAYNIT',
          rejection_reason: rejectionReason,
          updated_at: new Date().toISOString(),
        })
        .eq('provider_order_id', providerOrderId)
        .eq('status', 'PENDING');

      await adminClient.from('merchant_payout_events').insert({
        provider_event_id: `pn_5xx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        payout_id: payoutId,
        event_type: 'paynit.dispatch_upstream_5xx',
        raw_payload: { status: paynitRes.status, body: paynitData, provider_order_id: providerOrderId },
      });

      return new Response(
        JSON.stringify({
          success: false,
          status: 'PROCESSING',
          order_id: orderId,
          provider_order_id: providerOrderId,
          amount: amount,
          fee: authoritativeFee,
          total_debited: totalDebited,
          method: method,
          error: rejectionReason,
          message: 'PayNit returned HTTP 5xx. Payout held in PROCESSING state awaiting reconciliation. Locked float is preserved.',
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Definitive HTTP 4xx or { success: false } -> Upfront Provider Rejection.
      // E.g. invalid IFSC, invalid UPI, insufficient PayNit wallet.
      // Safely transition PENDING -> FAILED and refund float + fee.
      const rejectionReason = paynitData.message || paynitData.error || `PayNit rejected (HTTP ${paynitRes.status})`;

      await adminClient.rpc('merchant_finalize_payout_failure_rpc', {
        p_provider_order_id: providerOrderId,
        p_rejection_reason: rejectionReason,
        p_provider_event_id: `pn_4xx_${Date.now()}`,
        p_raw_payload: paynitData,
      });

      return new Response(
        JSON.stringify({
          success: false,
          status: 'FAILED',
          order_id: orderId,
          provider_order_id: providerOrderId,
          amount: amount,
          fee: authoritativeFee,
          total_debited: totalDebited,
          method: method,
          error: rejectionReason,
          message: 'Payout definitively rejected by PayNit. Float balance and fee have been refunded.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Internal gateway dispatch error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
