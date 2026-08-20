export interface PaymentOrderInput {
  transactionId: string;
  amount: number;
  currency: string;
  buyerId: string;
  sellerId: string;
  commissionRate: number;
}

export interface PaymentOrderResult {
  paymentId: string;
  providerOrderId: string;
  checkoutUrl: string;
  amount: number;
  currency: string;
  status: string;
}

export interface PaymentVerificationResult {
  paymentId: string;
  providerPaymentId: string;
  status: 'captured' | 'failed' | 'processing';
  amount: number;
  paidAt?: string;
}

export interface RefundResult {
  refundId: string;
  providerRefundId: string;
  amount: number;
  status: 'pending' | 'processed' | 'failed';
  processedAt?: string;
}
