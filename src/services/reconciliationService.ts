import { supabase } from '@/lib/supabase';

export interface ReconciliationResult {
  paymentId: string;
  transactionId: string;
  issueType: 'amount_mismatch' | 'status_mismatch' | 'missing_provider_record' | 'matched';
  internalAmount: number;
  providerAmount: number;
  internalStatus: string;
  providerStatus: string;
  message: string;
}

/**
 * Performs reconciliation check on a single payment record against Cashfree Sandbox/Production API.
 */
export async function reconcilePaymentRecord(paymentId: string): Promise<ReconciliationResult> {
  try {
    // 1. Fetch internal record
    const { data: payment, error } = await supabase
      .from('payments')
      .select('*, transaction:transactions(*)')
      .eq('id', paymentId)
      .single();

    if (error || !payment) {
      throw new Error(`Payment record ${paymentId} not found in internal ledger.`);
    }

    // 2. Fetch current system config to resolve base URL
    const { data: sysConfig } = await supabase
      .from('payment_system_config')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    const env = sysConfig?.payment_environment || 'sandbox';
    let appId, secretKey, cfUrl;

    if (env === 'production') {
      appId = process.env.CASHFREE_PROD_APP_ID || '';
      secretKey = process.env.CASHFREE_PROD_SECRET_KEY || '';
      cfUrl = `https://api.cashfree.com/pg/orders/${payment.id}`;
    } else {
      appId = 'TEST1027170134b2203ddb72c9bc44d110717201';
      secretKey = 'cfsk_ma_test_04c55ec3e7fead17a7e17424b9148560_050d2bc4';
      cfUrl = `https://sandbox.cashfree.com/pg/orders/${payment.id}`;
    }

    // 3. Fetch from provider
    const response = await fetch(cfUrl, {
      method: 'GET',
      headers: {
        'x-api-version': '2023-08-01',
        'x-client-id': appId,
        'x-client-secret': secretKey,
        'content-type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Log mismatch issue
        await logReconciliationDiscrepancy(
          paymentId,
          payment.transaction_id,
          'missing_provider_record',
          payment.amount,
          0,
          payment.status,
          'NOT_FOUND'
        );
        return {
          paymentId,
          transactionId: payment.transaction_id,
          issueType: 'missing_provider_record',
          internalAmount: payment.amount,
          providerAmount: 0,
          internalStatus: payment.status,
          providerStatus: 'NOT_FOUND',
          message: 'Missing provider payment record.'
        };
      }
      throw new Error(`Provider API query failed with status: ${response.status}`);
    }

    const providerData = await response.json();
    const providerAmount = Number(providerData.order_amount);
    const providerStatus = providerData.order_status; // PAID, ACTIVE, EXPIRED

    let issueType: ReconciliationResult['issueType'] = 'matched';
    let msg = 'Record matches successfully.';

    // Compare amounts
    if (providerAmount !== Number(payment.amount)) {
      issueType = 'amount_mismatch';
      msg = `Amount mismatch detected: Internal ₹${payment.amount} vs Provider ₹${providerAmount}`;
    }
    // Compare statuses
    else if (providerStatus === 'PAID' && !['captured', 'held', 'released', 'refunded'].includes(payment.status)) {
      issueType = 'status_mismatch';
      msg = `Status mismatch detected: Internal ${payment.status} vs Provider PAID`;
    }

    if (issueType !== 'matched') {
      await logReconciliationDiscrepancy(
        paymentId,
        payment.transaction_id,
        issueType,
        payment.amount,
        providerAmount,
        payment.status,
        providerStatus,
        providerData
      );
    }

    return {
      paymentId,
      transactionId: payment.transaction_id,
      issueType,
      internalAmount: payment.amount,
      providerAmount,
      internalStatus: payment.status,
      providerStatus,
      message: msg
    };

  } catch (err: any) {
    console.error(`Reconciliation failed for payment ${paymentId}:`, err);
    return {
      paymentId,
      transactionId: '',
      issueType: 'missing_provider_record',
      internalAmount: 0,
      providerAmount: 0,
      internalStatus: 'unknown',
      providerStatus: 'unknown',
      message: err.message
    };
  }
}

/**
 * Registers a reconciliation issue in the DB ledger.
 */
async function logReconciliationDiscrepancy(
  paymentId: string,
  transactionId: string,
  issueType: string,
  internalAmount: number,
  providerAmount: number,
  internalStatus: string,
  providerStatus: string,
  metadata: any = {}
) {
  // Check if issue already logged to prevent duplicates
  const { data: existing } = await supabase
    .from('financial_reconciliation_issues')
    .select('id')
    .eq('payment_id', paymentId)
    .eq('issue_type', issueType)
    .eq('resolution_status', 'open')
    .maybeSingle();

  if (existing) return;

  await supabase
    .from('financial_reconciliation_issues')
    .insert({
      payment_id: paymentId,
      transaction_id: transactionId,
      issue_type: issueType,
      internal_amount: internalAmount,
      provider_amount: providerAmount,
      internal_status: internalStatus,
      provider_status: providerStatus,
      metadata: metadata,
      resolution_status: 'open'
    });
}
