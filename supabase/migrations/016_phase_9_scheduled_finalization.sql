-- 016_PHASE_9_SCHEDULED_FINALIZATION.SQL
-- Configures automated auction finalization using pg_cron, dropping duplicate triggers, and aligning conversation RPC checks.

-- 1. Enable pg_cron extension if not already present
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Drop redundant trigger tr_on_auction_ended to prevent duplicate notifications
DROP TRIGGER IF EXISTS tr_on_auction_ended ON public.auctions;

-- 3. Update create_auction_conversation RPC function to support status 'completed' in addition to 'ended'
CREATE OR REPLACE FUNCTION public.create_auction_conversation(
  p_auction_id uuid
)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
  v_auction record;
  v_conv_id uuid;
BEGIN
  -- Require authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required. Please log in.';
  END IF;

  -- Lock the auction row
  SELECT * INTO v_auction
  FROM public.auctions
  WHERE id = p_auction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auction not found.';
  END IF;

  -- Verify auction is ended/completed and has a valid winner
  IF v_auction.status NOT IN ('ended', 'completed') OR v_auction.winner_id IS NULL THEN
    RAISE EXCEPTION 'Conversations can only be initiated for completed auctions with a winning bidder.';
  END IF;

  -- Verify caller is either the seller or the winner
  IF v_user_id <> v_auction.seller_id AND v_user_id <> v_auction.winner_id THEN
    RAISE EXCEPTION 'Access Denied: You are not authorized to start a conversation for this listing.';
  END IF;

  -- Verify neither participant has blocked the other
  IF EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE (blocker_id = v_auction.seller_id and blocked_id = v_auction.winner_id)
       OR (blocker_id = v_auction.winner_id and blocked_id = v_auction.seller_id)
  ) THEN
    RAISE EXCEPTION 'Cannot create conversation. This seller or winner is currently blocked.';
  END IF;

  -- Idempotently insert or retrieve conversation
  SELECT id INTO v_conv_id
  FROM public.conversations
  WHERE auction_id = p_auction_id;

  IF NOT FOUND THEN
    INSERT INTO public.conversations (auction_id, seller_id, winner_id)
    VALUES (p_auction_id, v_auction.seller_id, v_auction.winner_id)
    RETURNING id INTO v_conv_id;
  END IF;

  RETURN v_conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Schedule the sweeper function to run every minute
SELECT cron.unschedule('finalize-expired-auctions-cron-job')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'finalize-expired-auctions-cron-job');

SELECT cron.schedule(
  'finalize-expired-auctions-cron-job',
  '* * * * *', -- every minute
  $$ SELECT public.finalize_expired_auctions(); $$
);
