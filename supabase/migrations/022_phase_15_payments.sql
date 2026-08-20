-- 022_PHASE_15_PAYMENTS.SQL
-- Implements Bhel Puri payments registry, route transfers, refunds, auditing events and webhook logging.

-- 1. Create generic updated_at function if not exists
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  new.updated_at := now();
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- 2. Create Payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL UNIQUE REFERENCES public.transactions(id) ON DELETE RESTRICT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  provider TEXT NOT NULL DEFAULT 'razorpay',
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'processing', 'captured', 'held', 'release_pending', 'released', 'refund_pending', 'refunded', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  paid_at TIMESTAMPTZ,
  held_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ
);

-- 3. Create Payment Transfers table
CREATE TABLE IF NOT EXISTS public.payment_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  razorpay_transfer_id TEXT UNIQUE,
  linked_account_id TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'held', 'processed', 'failed')),
  settlement_on_hold BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  processed_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ
);

-- 4. Create Payment Refunds table
CREATE TABLE IF NOT EXISTS public.payment_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  razorpay_refund_id TEXT UNIQUE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  processed_at TIMESTAMPTZ
);

-- 5. Create Payment Events table
CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('payment_created', 'payment_captured', 'payment_failed', 'payment_held', 'payment_release_requested', 'payment_released', 'payment_refund_requested', 'payment_refunded', 'payment_status_updated')),
  from_status TEXT,
  to_status TEXT,
  metadata JSONB,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 6. Create Webhook Idempotency table
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 7. Add integrity checks and triggers
-- A. Refund Amount Check Trigger
CREATE OR REPLACE FUNCTION public.check_refund_amount_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_captured_amount NUMERIC(12, 2);
  v_total_refunds NUMERIC(12, 2);
BEGIN
  -- Get captured payment amount
  SELECT amount INTO v_captured_amount
  FROM public.payments
  WHERE id = new.payment_id;
  
  IF v_captured_amount IS NULL THEN
    RAISE EXCEPTION 'Associated payment record not found.';
  END IF;

  -- Get sum of existing processed/pending refunds for this payment
  SELECT coalesce(sum(amount), 0.00) INTO v_total_refunds
  FROM public.payment_refunds
  WHERE payment_id = new.payment_id AND id <> new.id AND status IN ('pending', 'processed');

  -- Verify total refunds do not exceed payment amount
  IF (v_total_refunds + new.amount) > v_captured_amount THEN
    RAISE EXCEPTION 'Total refund amount (₹%) cannot exceed original payment amount (₹%).', (v_total_refunds + new.amount), v_captured_amount;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_check_refund_amount_limit ON public.payment_refunds;
CREATE TRIGGER tr_check_refund_amount_limit
  BEFORE INSERT OR UPDATE ON public.payment_refunds
  FOR EACH ROW
  EXECUTE FUNCTION public.check_refund_amount_limit();

-- B. Transfer Amount Check Trigger
CREATE OR REPLACE FUNCTION public.check_transfer_amount_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_payment_amount NUMERIC(12, 2);
  v_total_transfers NUMERIC(12, 2);
BEGIN
  -- Get original payment amount
  SELECT amount INTO v_payment_amount
  FROM public.payments
  WHERE id = new.payment_id;
  
  IF v_payment_amount IS NULL THEN
    RAISE EXCEPTION 'Payment record not found.';
  END IF;

  -- Get sum of existing transfers for this payment
  SELECT coalesce(sum(amount), 0.00) INTO v_total_transfers
  FROM public.payment_transfers
  WHERE payment_id = new.payment_id AND id <> new.id AND status IN ('pending', 'held', 'processed');

  -- Verify total transfers do not exceed original payment amount
  IF (v_total_transfers + new.amount) > v_payment_amount THEN
    RAISE EXCEPTION 'Total transfer amount (₹%) cannot exceed original payment amount (₹%).', (v_total_transfers + new.amount), v_payment_amount;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_check_transfer_amount_limit ON public.payment_transfers;
CREATE TRIGGER tr_check_transfer_amount_limit
  BEFORE INSERT OR UPDATE ON public.payment_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.check_transfer_amount_limit();

-- C. Payment Status Event logger trigger
CREATE OR REPLACE FUNCTION public.log_payment_status_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.payment_events (
      payment_id,
      event_type,
      from_status,
      to_status,
      actor_id
    )
    VALUES (
      new.id,
      'payment_created',
      NULL,
      new.status,
      auth.uid()
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF (new.status <> old.status) THEN
      INSERT INTO public.payment_events (
        payment_id,
        event_type,
        from_status,
        to_status,
        actor_id
      )
      VALUES (
        new.id,
        CASE
          WHEN new.status = 'captured' THEN 'payment_captured'::text
          WHEN new.status = 'held' THEN 'payment_held'::text
          WHEN new.status = 'released' THEN 'payment_released'::text
          WHEN new.status = 'refunded' THEN 'payment_refunded'::text
          WHEN new.status = 'failed' THEN 'payment_failed'::text
          ELSE 'payment_status_updated'::text
        END,
        old.status,
        new.status,
        auth.uid()
      );
    END IF;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_log_payment_status_changes ON public.payments;
CREATE TRIGGER tr_log_payment_status_changes
  AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_payment_status_changes();

-- D. Register updated_at triggers
DROP TRIGGER IF EXISTS tr_update_payments_timestamp ON public.payments;
CREATE TRIGGER tr_update_payments_timestamp
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_update_transfers_timestamp ON public.payment_transfers;
CREATE TRIGGER tr_update_transfers_timestamp
  BEFORE UPDATE ON public.payment_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_update_refunds_timestamp ON public.payment_refunds;
CREATE TRIGGER tr_update_refunds_timestamp
  BEFORE UPDATE ON public.payment_refunds
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 8. Add optimized indexes
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON public.payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id ON public.payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payment_transfers_payment_id ON public.payment_transfers(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_transfers_status ON public.payment_transfers(status);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_payment_id ON public.payment_refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_payment_id ON public.payment_events(payment_id);

-- 9. Enable RLS on all tables
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies
-- A. Payments Read: Buyer/Seller can select their own transaction payments
CREATE POLICY select_payments ON public.payments
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND (
      auth.uid() IN (SELECT buyer_id FROM public.transactions WHERE id = transaction_id) OR
      auth.uid() IN (SELECT seller_id FROM public.transactions WHERE id = transaction_id)
    )
  );

-- B. Payment Transfers Read: Buyer/Seller can select their transfers
CREATE POLICY select_transfers ON public.payment_transfers
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND (
      auth.uid() IN (SELECT buyer_id FROM public.transactions t JOIN public.payments p ON p.transaction_id = t.id WHERE p.id = payment_id) OR
      auth.uid() IN (SELECT seller_id FROM public.transactions t JOIN public.payments p ON p.transaction_id = t.id WHERE p.id = payment_id)
    )
  );

-- C. Payment Refunds Read: Buyer/Seller can select refunds
CREATE POLICY select_refunds ON public.payment_refunds
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND (
      auth.uid() IN (SELECT buyer_id FROM public.transactions t JOIN public.payments p ON p.transaction_id = t.id WHERE p.id = payment_id) OR
      auth.uid() IN (SELECT seller_id FROM public.transactions t JOIN public.payments p ON p.transaction_id = t.id WHERE p.id = payment_id)
    )
  );

-- D. Payment Events Read: Buyer/Seller can select events
CREATE POLICY select_events ON public.payment_events
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND (
      auth.uid() IN (SELECT buyer_id FROM public.transactions t JOIN public.payments p ON p.transaction_id = t.id WHERE p.id = payment_id) OR
      auth.uid() IN (SELECT seller_id FROM public.transactions t JOIN public.payments p ON p.transaction_id = t.id WHERE p.id = payment_id)
    )
  );
