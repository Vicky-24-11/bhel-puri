import { CashfreeAdapter } from './CashfreeAdapter';
import { PaymentProvider } from './PaymentProvider';

// Set active provider adapter (currently defaulting to Cashfree Sandbox)
export const activePaymentProvider: PaymentProvider = new CashfreeAdapter();

export * from './types';
export * from './PaymentProvider';
export * from './CashfreeAdapter';
