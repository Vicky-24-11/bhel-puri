import { PaymentOrderInput, PaymentOrderResult, PaymentVerificationResult, RefundResult } from './types';

export interface PaymentProvider {
  name: string;
  createPaymentOrder(input: PaymentOrderInput): Promise<PaymentOrderResult>;
  verifyPayment(providerOrderId: string): Promise<PaymentVerificationResult>;
  createSellerAccount(sellerId: string, bankDetails: any): Promise<any>;
  releaseSellerSettlement(paymentId: string): Promise<boolean>;
  requestRefund(paymentId: string, amount: number): Promise<RefundResult>;
}
