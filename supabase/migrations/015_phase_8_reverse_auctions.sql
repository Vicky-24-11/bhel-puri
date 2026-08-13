-- 015_PHASE_8_REVERSE_AUCTIONS.SQL
-- Extends the auctions schema with auction_type and minimum_price fields,
-- and re-defines the atomic place_bid and finalize_auction functions to support reverse auctions (buy requests).

-- 1. Add fields to auctions table
ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS auction_type TEXT NOT NULL DEFAULT 'forward' CHECK (auction_type IN ('forward', 'reverse'));
ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS minimum_price NUMERIC(12, 2) CHECK (minimum_price >= 0);

-- 2. Re-create place_bid RPC function to support both types of auctions atomically
CREATE OR REPLACE FUNCTION public.place_bid(
  p_auction_id UUID,
  p_amount NUMERIC
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_auction RECORD;
  v_is_participant BOOLEAN;
BEGIN
  -- Identify and verify authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required. Please log in.';
  END IF;

  -- Lock the auction row exclusively to prevent race conditions
  SELECT * INTO v_auction
  FROM public.auctions
  WHERE id = p_auction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auction not found.';
  END IF;

  -- Verify status is live
  IF v_auction.status <> 'live' THEN
    RAISE EXCEPTION 'Bidding is closed. This auction is not live.';
  END IF;

  -- Verify current time is before ends_at
  IF v_auction.ends_at <= now() THEN
    RAISE EXCEPTION 'Bidding is closed. This auction has ended.';
  END IF;

  -- Verify bidder is not the owner (creator)
  IF v_auction.seller_id = v_user_id THEN
    RAISE EXCEPTION 'You cannot place a bid/offer on your own auction.';
  END IF;

  -- Verify bidder is an active participant
  SELECT EXISTS (
    SELECT 1 FROM public.auction_participants
    WHERE auction_id = p_auction_id AND user_id = v_user_id AND status = 'active'
  ) INTO v_is_participant;

  IF NOT v_is_participant THEN
    RAISE EXCEPTION 'You must join the auction before placing a bid/offer.';
  END IF;

  -- Validate bid/offer amount based on auction type
  IF v_auction.auction_type = 'reverse' THEN
    -- Reverse Auction: new offer must be lower than the current lowest offer by at least minimum_bid_increment
    -- If there are no bids yet, compare against starting_price (maximum budget)
    IF v_auction.current_price = v_auction.starting_price AND NOT EXISTS (SELECT 1 FROM public.bids WHERE auction_id = p_auction_id) THEN
      IF p_amount > v_auction.starting_price THEN
        RAISE EXCEPTION 'Initial offer cannot exceed the maximum budget of ₹%', v_auction.starting_price::text;
      END IF;
    ELSE
      IF p_amount > (v_auction.current_price - v_auction.minimum_bid_increment) THEN
        RAISE EXCEPTION 'Your offer must be at most ₹%', (v_auction.current_price - v_auction.minimum_bid_increment)::text;
      END IF;
    END IF;

    -- Offer must not be lower than the minimum acceptable price
    IF v_auction.minimum_price IS NOT NULL AND p_amount < v_auction.minimum_price THEN
      RAISE EXCEPTION 'Your offer cannot be below the minimum acceptable price of ₹%', v_auction.minimum_price::text;
    END IF;
  ELSE
    -- Forward Auction: new bid must be greater than current highest bid by at least minimum_bid_increment
    IF v_auction.current_price > 0 THEN
      IF p_amount < (v_auction.current_price + v_auction.minimum_bid_increment) THEN
        RAISE EXCEPTION 'Your bid must be at least ₹%', (v_auction.current_price + v_auction.minimum_bid_increment)::text;
      END IF;
    ELSE
      IF p_amount < v_auction.starting_price THEN
        RAISE EXCEPTION 'Initial bid must meet the starting price of ₹%', v_auction.starting_price::text;
      END IF;
    END IF;
  END IF;

  -- Insert bid record
  INSERT INTO public.bids (auction_id, bidder_id, amount, created_at)
  VALUES (p_auction_id, v_user_id, p_amount, now());

  -- Update auction current price and highest bidder (which is low offerer in reverse)
  UPDATE public.auctions
  SET 
    current_price = p_amount,
    highest_bidder_id = v_user_id,
    updated_at = now()
  WHERE id = p_auction_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Bid placed successfully.',
    'current_price', p_amount
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Re-create finalize_auction function to support both types of auctions
CREATE OR REPLACE FUNCTION public.finalize_auction(p_auction_id UUID)
RETURNS JSONB AS $body$
DECLARE
  v_auction RECORD;
  v_highest_bid RECORD;
  v_winner_id UUID := NULL;
  v_winning_amount NUMERIC := 0.00;
  v_winning_bid_id UUID := NULL;
  v_seller_profile_id UUID;
  v_buyer_profile_id UUID;
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

  -- Find the highest valid bid (for forward, highest amount; for reverse, lowest amount)
  IF v_auction.auction_type = 'reverse' THEN
    SELECT * INTO v_highest_bid
    FROM public.bids
    WHERE auction_id = p_auction_id
    ORDER BY amount ASC, created_at ASC
    LIMIT 1;
  ELSE
    SELECT * INTO v_highest_bid
    FROM public.bids
    WHERE auction_id = p_auction_id
    ORDER BY amount DESC, created_at ASC
    LIMIT 1;
  END IF;

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

    -- C. Assign Transaction Directions (Forward: owner is seller; Reverse: owner is buyer)
    IF v_auction.auction_type = 'reverse' THEN
      v_seller_profile_id := v_winner_id;           -- winning seller
      v_buyer_profile_id  := v_auction.seller_id;   -- auction creator (buyer)
    ELSE
      v_seller_profile_id := v_auction.seller_id;   -- auction creator (seller)
      v_buyer_profile_id  := v_winner_id;           -- winning bidder (buyer)
    END IF;

    -- D. Create the Transaction record (idempotently)
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
      v_seller_profile_id,
      v_buyer_profile_id,
      v_winning_bid_id,
      v_winning_amount,
      'pending'
    )
    ON CONFLICT (auction_id) DO NOTHING;

    -- E. Create Notifications based on auction direction
    IF v_auction.auction_type = 'reverse' THEN
      -- Reverse Winner (Seller) notification
      INSERT INTO public.notifications (user_id, type, title, body, auction_id)
      VALUES (
        v_winner_id,
        'auction_won',
        '🎉 Your offer won!',
        'You won the buy request with an offer of ₹' || v_winning_amount::text || '.',
        p_auction_id
      );

      -- Reverse Buyer (Creator) notification
      INSERT INTO public.notifications (user_id, type, title, body, auction_id)
      VALUES (
        v_auction.seller_id,
        'auction_ended',
        '🎉 Your buy request has been fulfilled!',
        'A seller offered the winning price of ₹' || v_winning_amount::text || '.',
        p_auction_id
      );
    ELSE
      -- Forward Winner notification
      INSERT INTO public.notifications (user_id, type, title, body, auction_id)
      VALUES (
        v_winner_id,
        'auction_won',
        '🎉 You won an auction!',
        'You won "' || v_auction.title || '" for ₹' || v_winning_amount::text || '.',
        p_auction_id
      );

      -- Forward Seller notification
      INSERT INTO public.notifications (user_id, type, title, body, auction_id)
      VALUES (
        v_auction.seller_id,
        'auction_ended',
        '🎉 Your auction has ended!',
        '"' || v_auction.title || '" sold for ₹' || v_winning_amount::text || '.',
        p_auction_id
      );
    END IF;
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

    -- Create Seller/Buyer no-bid notification
    IF v_auction.auction_type = 'reverse' THEN
      INSERT INTO public.notifications (user_id, type, title, body, auction_id)
      VALUES (
        v_auction.seller_id,
        'auction_expired_unsold',
        'Buy request ended',
        '"' || v_auction.title || '" ended without receiving any offers.',
        p_auction_id
      );
    ELSE
      INSERT INTO public.notifications (user_id, type, title, body, auction_id)
      VALUES (
        v_auction.seller_id,
        'auction_expired_unsold',
        'Auction ended',
        '"' || v_auction.title || '" ended without receiving any bids.',
        p_auction_id
      );
    END IF;
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
