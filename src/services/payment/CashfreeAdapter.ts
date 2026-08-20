import { supabase } from '@/lib/supabase';
import { PaymentProvider } from './PaymentProvider';
import { PaymentOrderInput, PaymentOrderResult, PaymentVerificationResult, RefundResult } from './types';

export class CashfreeAdapter implements PaymentProvider {
  name = 'cashfree';

  async createPaymentOrder(input: PaymentOrderInput): Promise<PaymentOrderResult> {
    const { data, error } = await supabase.functions.invoke('cashfree-payment-create', {
      body: {
        transactionId: input.transactionId,
        currency: input.currency,
      },
    });

    if (error || !data) {
      console.error('Error invoking cashfree-payment-create Edge Function:', error);
      throw new Error(error?.message || 'Failed to initiate Cashfree order on server.');
    }

    return {
      paymentId: data.paymentId,
      providerOrderId: data.cfOrderId,
      checkoutUrl: data.paymentLink,
      amount: data.amount,
      currency: data.currency,
      status: data.status,
    };
  }

  async verifyPayment(providerOrderId: string): Promise<PaymentVerificationResult> {
    const { data, error } = await supabase.functions.invoke('cashfree-payment-verify', {
      body: { providerOrderId },
    });

    if (error || !data) {
      console.error('Error invoking cashfree-payment-verify Edge Function:', error);
      throw new Error(error?.message || 'Failed to verify Cashfree payment on server.');
    }

    return {
      paymentId: data.paymentId,
      providerPaymentId: data.cfPaymentId,
      status: data.status,
      amount: data.amount,
      paidAt: data.paidAt,
    };
  }

  async createSellerAccount(sellerId: string, bankDetails: any): Promise<any> {
    // Stubbed sandbox seller account creation
    console.log('Sandbox onboarding seller account:', sellerId, bankDetails);
    return {
      vendorId: `cf_vendor_${sellerId.slice(0, 8)}`,
      status: 'ACTIVE',
      bankVerification: 'SUCCESS',
    };
  }

  async releaseSellerSettlement(paymentId: string): Promise<boolean> {
    // Releasing payout is sandbox stubbed/blocked for safety until fully verified
    console.warn('Releasing payout settlement is currently blocked in sandbox mode.');
    const { data, error } = await supabase.functions.invoke('cashfree-payout-release', {
      body: { paymentId },
    });

    if (error) {
      console.error('Error invoking cashfree-payout-release Edge Function:', error);
      throw new Error(error.message || 'Failed to release payout.');
    }

    return data?.success || false;
  }

  async requestRefund(paymentId: string, amount: number): Promise<RefundResult> {
    const { data, error } = await supabase.functions.invoke('cashfree-refund-create', {
      body: { paymentId, amount },
    });

    if (error || !data) {
      console.error('Error invoking cashfree-refund-create Edge Function:', error);
      throw new Error(error?.message || 'Failed to process refund.');
    }

    return {
      refundId: data.refundId,
      providerRefundId: data.cfRefundId,
      amount: data.amount,
      status: data.status,
      processedAt: data.processedAt,
    };
  }
}
