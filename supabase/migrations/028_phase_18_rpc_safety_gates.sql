CREATE OR REPLACE FUNCTION public.claim_payout_release(p_payment_id UUID, p_actor_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment RECORD;
  v_dispute_count INTEGER;
  v_payouts_blocked BOOLEAN;
  v_transfer_count INTEGER;
  v_config RECORD;
BEGIN
  -- 1. Fetch config settings
  SELECT * INTO v_config
  FROM public.payment_system_config
  WHERE is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Blocked: Safety configuration is missing.';
  END IF;

  -- 2. Check emergency halts
  IF v_config.payouts_blocked_globally = true THEN
    RAISE EXCEPTION 'Blocked: Seller payouts are temporarily suspended.';
  END IF;

  -- 3. Check environment gates
  IF v_config.payment_environment = 'production' THEN
    IF v_config.provider_activation_status != 'active' OR v_config.production_payments_enabled != true THEN
      RAISE EXCEPTION 'Blocked: Production payouts are currently unavailable.';
    END IF;
  END IF;

  -- 4. Lock payment row
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Blocked: Payment record not found.';
  END IF;

  -- 5. Check status
  IF v_payment.status NOT IN ('held', 'captured') THEN
    RAISE EXCEPTION 'Blocked: Payment status must be held or captured.';
  END IF;

  -- 6. Check active disputes
  SELECT COUNT(*) INTO v_dispute_count
  FROM public.disputes
  WHERE transaction_id = v_payment.transaction_id
    AND status IN ('open', 'under_review');

  IF v_dispute_count > 0 THEN
    RAISE EXCEPTION 'Blocked: Active dispute exists on this transaction.';
  END IF;

  -- 7. Check existing transfers
  SELECT COUNT(*) INTO v_transfer_count
  FROM public.payment_transfers
  WHERE payment_id = p_payment_id
    AND status IN ('pending', 'processed');

  IF v_transfer_count > 0 THEN
    RAISE EXCEPTION 'Blocked: An active/successful transfer already exists.';
  END IF;

  -- 8. Transition to release_pending
  UPDATE public.payments
  SET status = 'release_pending',
      updated_at = now()
  WHERE id = p_payment_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'seller_payable_amount', v_payment.seller_payable_amount
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_refund_create(p_payment_id UUID, p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment RECORD;
  v_existing_refunds_sum NUMERIC;
  v_config RECORD;
BEGIN
  -- 1. Fetch config settings
  SELECT * INTO v_config
  FROM public.payment_system_config
  WHERE is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Blocked: Safety configuration is missing.';
  END IF;

  -- 2. Check emergency halts
  IF v_config.refunds_blocked_globally = true THEN
    RAISE EXCEPTION 'Blocked: Refunds are temporarily suspended.';
  END IF;

  -- 3. Check environment gates
  IF v_config.payment_environment = 'production' THEN
    IF v_config.provider_activation_status != 'active' OR v_config.production_payments_enabled != true THEN
      RAISE EXCEPTION 'Blocked: Production refunds are currently unavailable.';
    END IF;
  END IF;

  -- 4. Lock payment row
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Blocked: Payment record not found.';
  END IF;

  -- 5. Check refund limits
  SELECT COALESCE(SUM(amount), 0) INTO v_existing_refunds_sum
  FROM public.payment_refunds
  WHERE payment_id = p_payment_id
    AND status IN ('pending', 'processed');

  IF (v_existing_refunds_sum + p_amount) > v_payment.amount THEN
    RAISE EXCEPTION 'Blocked: Refund sum would exceed captured amount.';
  END IF;

  -- 6. Transition to refund_pending
  UPDATE public.payments
  SET status = 'refund_pending',
      updated_at = now()
  WHERE id = p_payment_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'amount', p_amount
  );
END;
$$;
