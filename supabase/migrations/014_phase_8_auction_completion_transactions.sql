-- 014_PHASE_8_AUCTION_COMPLETION_TRANSACTIONS.SQL
-- Creates the transactions table, policies, index structures, and re-defines the finalization functions.

-- 1. Modify the status check constraint on auctions to include 'completed'
ALTER TABLE public.auctions DROP CONSTRAINT IF EXISTS auctions_status_check;
ALTER TABLE public.auctions ADD CONSTRAINT auctions_status_check CHECK (status IN ('draft', 'scheduled', 'live', 'ended', 'cancelled', 'completed'));

-- 1b. Modify the type check constraint on notifications to support completed notification types
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN ('auction_won', 'auction_ended', 'new_message', 'auction_started', 'outbid', 'auction_cancelled', 'auction_sold', 'auction_expired_unsold', 'transaction_completed'));

-- 2. Create public.transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL UNIQUE REFERENCES public.auctions(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  winning_bid_id UUID REFERENCES public.bids(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Enable RLS and define policies on transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_transaction ON public.transactions;
CREATE POLICY select_transaction ON public.transactions
  FOR SELECT
  USING (auth.uid() = seller_id OR auth.uid() = buyer_id);

DROP POLICY IF EXISTS update_transaction ON public.transactions;
CREATE POLICY update_transaction ON public.transactions
  FOR UPDATE
  USING (auth.uid() = seller_id OR auth.uid() = buyer_id)
  WITH CHECK (auth.uid() = seller_id OR auth.uid() = buyer_id);

-- 4. Create performance optimized indexes
CREATE INDEX IF NOT EXISTS idx_transactions_seller_id ON public.transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_transactions_buyer_id ON public.transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_auction_id ON public.transactions(auction_id);

-- 5. Re-create finalize_auction function
CREATE OR REPLACE FUNCTION public.finalize_auction(p_auction_id UUID)
RETURNS JSONB AS $body$
DECLARE
  v_auction RECORD;
  v_highest_bid RECORD;
  v_winner_id UUID := NULL;
  v_winning_amount NUMERIC := 0.00;
  v_winning_bid_id UUID := NULL;
BEGIN
  -- Acquire an exclusive row-level lock on the auction to prevent race conditions
  SELECT * INTO v_auction
  FROM public.auctions
  WHERE id = p_auction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Auction not found.'
    );
  END IF;

  -- Prevent duplicate finalization
  IF v_auction.status IN ('ended', 'completed', 'cancelled') THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Auction has already been finalized.',
      'auction', to_jsonb(v_auction)
    );
  END IF;

  -- Verify auction ends_at has passed
  IF v_auction.ends_at > now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Auction cannot be finalized before it ends.'
    );
  END IF;

  -- Find the highest valid bid (earliest bid wins in case of equal amounts)
  SELECT * INTO v_highest_bid
  FROM public.bids
  WHERE auction_id = p_auction_id
  ORDER BY amount DESC, created_at ASC
  LIMIT 1;

  IF FOUND THEN
    v_winner_id := v_highest_bid.bidder_id;
    v_winning_amount := v_highest_bid.amount;
    v_winning_bid_id := v_highest_bid.id;
  END IF;

  IF v_winner_id IS NOT NULL THEN
    -- A. Update auction status and winner_id
    UPDATE public.auctions
    SET
      status = 'completed',
      winner_id = v_winner_id,
      updated_at = now()
    WHERE id = p_auction_id
    RETURNING * INTO v_auction;

    -- B. Update participant statuses
    -- Winner
    UPDATE public.auction_participants
    SET status = 'winner'
    WHERE auction_id = p_auction_id AND user_id = v_winner_id;

    -- Losers
    UPDATE public.auction_participants
    SET status = 'lost'
    WHERE auction_id = p_auction_id AND user_id <> v_winner_id AND status = 'active';

    -- C. Create the Transaction record (idempotently)
    INSERT INTO public.transactions (
      auction_id,
      seller_id,
      buyer_id,
      winning_bid_id,
      amount,
      status
    )
    VALUES (
      p_auction_id,
      v_auction.seller_id,
      v_winner_id,
      v_winning_bid_id,
      v_winning_amount,
      'pending'
    )
    ON CONFLICT (auction_id) DO NOTHING;

    -- D. Create Winner notification
    INSERT INTO public.notifications (user_id, type, title, body, auction_id)
    VALUES (
      v_winner_id,
      'auction_won',
      '🎉 You won an auction!',
      'You won "' || v_auction.title || '" for ₹' || v_winning_amount::text || '.',
      p_auction_id
    );

    -- E. Create Seller notification
    INSERT INTO public.notifications (user_id, type, title, body, auction_id)
    VALUES (
      v_auction.seller_id,
      'auction_sold',
      '🎉 Your auction has ended!',
      '"' || v_auction.title || '" sold for ₹' || v_winning_amount::text || '.',
      p_auction_id
    );
  ELSE
    -- No bids: mark unsold/ended
    UPDATE public.auctions
    SET
      status = 'ended',
      updated_at = now()
    WHERE id = p_auction_id
    RETURNING * INTO v_auction;

    -- Mark all active participants as lost if no bids
    UPDATE public.auction_participants
    SET status = 'lost'
    WHERE auction_id = p_auction_id AND status = 'active';

    -- Create Seller no-bid notification
    INSERT INTO public.notifications (user_id, type, title, body, auction_id)
    VALUES (
      v_auction.seller_id,
      'auction_expired_unsold',
      'Auction ended',
      '"' || v_auction.title || '" ended without receiving any bids.',
      p_auction_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Auction finalized successfully.',
    'auction', to_jsonb(v_auction)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', SQLERRM
    );
END;
$body$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Re-create finalize_expired_auctions function
CREATE OR REPLACE FUNCTION public.finalize_expired_auctions()
RETURNS VOID AS $body$
DECLARE
  r_auction RECORD;
begin
  FOR r_auction IN
    SELECT id
    FROM public.auctions
    WHERE status = 'live' AND ends_at <= now()
  LOOP
    PERFORM public.finalize_auction(r_auction.id);
  END LOOP;
END;
$body$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Update check_auction_update_restrictions trigger function to support 'completed' status
CREATE OR REPLACE FUNCTION public.check_auction_update_restrictions()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Prevent standard users from modifying current_price or winner_id directly, regardless of status
  IF (new.current_price <> old.current_price OR new.winner_id <> old.winner_id) THEN
    IF session_user = current_user THEN
      RAISE EXCEPTION 'You are not authorized to directly modify current_price or winner_id on auctions.';
    END IF;
  END IF;

  -- 2. If the auction is live, ended, completed, or cancelled, restrict edits to sensitive details
  IF (old.status IN ('live', 'ended', 'cancelled', 'completed')) THEN
    -- Sellers CANNOT change starting price, increments, schedules, or winner
    IF (new.starting_price <> old.starting_price OR
        new.minimum_bid_increment <> old.minimum_bid_increment OR
        new.starts_at <> old.starts_at OR
        new.ends_at <> old.ends_at) THEN
      RAISE EXCEPTION 'You cannot edit price settings or schedules once an auction is live or completed.';
    END IF;
    
    -- Status transitions when live/completed are restricted to cancellations, ending, or completing
    IF (new.status <> old.status AND new.status NOT IN ('ended', 'cancelled', 'completed')) THEN
      RAISE EXCEPTION 'Invalid status transition. Active auctions can only be ended, completed, or cancelled.';
    END IF;
  END IF;

  -- 3. Ended, Completed, or Cancelled auctions are completely frozen (no status changes allowed)
  IF (old.status IN ('ended', 'cancelled', 'completed') AND new.status <> old.status) THEN
    RAISE EXCEPTION 'This auction has already finished or been cancelled, its status cannot be modified.';
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql;
