-- 017_PHASE_10_TRANSACTION_PROTECTION.SQL
-- Implements row update restrictions and automated notifications for the transactions table.

-- 1. Create trigger function to enforce transaction updates constraints
CREATE OR REPLACE FUNCTION public.check_transaction_updates()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent altering critical fields
  IF (new.auction_id <> old.auction_id OR
      new.seller_id <> old.seller_id OR
      new.buyer_id <> old.buyer_id OR
      new.amount <> old.amount) THEN
    RAISE EXCEPTION 'You cannot modify critical transaction fields (auction_id, seller_id, buyer_id, amount).';
  END IF;

  -- Prevent modifying completed/cancelled transactions
  IF (old.status IN ('completed', 'cancelled') AND new.status <> old.status) THEN
    RAISE EXCEPTION 'This transaction has already been completed or cancelled and cannot be modified.';
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_transaction_update_rules ON public.transactions;
CREATE TRIGGER enforce_transaction_update_rules
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_transaction_updates();

-- 2. Create trigger function to automatically create notifications on transaction status change
CREATE OR REPLACE FUNCTION public.handle_transaction_status_change_notifications()
RETURNS TRIGGER AS $$
DECLARE
  v_auction_title TEXT;
  v_sender_name TEXT;
  v_recipient_id UUID;
  v_notification_title TEXT;
  v_notification_body TEXT;
BEGIN
  -- Only trigger if status actually changed
  IF (new.status = old.status) THEN
    RETURN new;
  END IF;

  -- Fetch auction title
  v_auction_title := (SELECT title FROM public.auctions WHERE id = new.auction_id);

  -- Determine sender name and recipient ID
  IF (auth.uid() = new.seller_id) THEN
    v_recipient_id := new.buyer_id;
    v_sender_name := (SELECT coalesce(full_name, username, 'Seller') FROM public.profiles WHERE id = new.seller_id);
  ELSE
    v_recipient_id := new.seller_id;
    v_sender_name := (SELECT coalesce(full_name, username, 'Buyer') FROM public.profiles WHERE id = new.buyer_id);
  END IF;

  -- Safeguard against null recipient
  IF (v_recipient_id IS NULL) THEN
    RETURN new;
  END IF;

  -- Formulate notification content based on status
  IF (new.status = 'contacted') THEN
    v_notification_title := '💬 Transaction In Progress';
    v_notification_body := v_sender_name || ' marked transaction for "' || v_auction_title || '" as In Progress.';
  ELSIF (new.status = 'completed') THEN
    v_notification_title := '✅ Transaction Completed';
    v_notification_body := v_sender_name || ' marked transaction for "' || v_auction_title || '" as Completed.';
  ELSIF (new.status = 'cancelled') THEN
    v_notification_title := '❌ Transaction Cancelled';
    v_notification_body := v_sender_name || ' cancelled transaction for "' || v_auction_title || '".';
  ELSE
    RETURN new;
  END IF;

  -- Insert notification
  INSERT INTO public.notifications (user_id, type, title, body, auction_id)
  VALUES (
    v_recipient_id,
    CASE WHEN new.status = 'completed' THEN 'transaction_completed' ELSE 'auction_ended' END,
    v_notification_title,
    v_notification_body,
    new.auction_id
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_on_transaction_status_change ON public.transactions;
CREATE TRIGGER tr_on_transaction_status_change
  AFTER UPDATE OF status ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_transaction_status_change_notifications();
