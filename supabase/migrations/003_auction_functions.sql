-- 003_AUCTION_FUNCTIONS.SQL
-- Implements core database functions for bidding safety, anti-sniping, and auction closure

-- =========================================================================
-- FUNCTION: place_bid(p_auction_id, p_bid_amount)
-- Atomically validates and registers a bid, handling race conditions and sniping.
-- =========================================================================
create or replace function public.place_bid(
  p_auction_id uuid,
  p_bid_amount numeric
)
returns jsonb
security definer -- Runs with elevated permissions to perform updates and writes safely
language plpgsql
as $$
declare
  v_user_id uuid;
  v_auction record;
  v_new_end_time timestamptz;
  v_extended boolean := false;
  v_ext_seconds integer := 30;     -- Duration in seconds to extend the auction by
  v_trigger_seconds integer := 30; -- Threshold before expiration to trigger anti-sniping
begin
  -- 1. Verify user is authenticated
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Authentication required. Please log in.'
    );
  end if;

  -- 2. Obtain an exclusive lock on the auction row to prevent race conditions
  select * into v_auction
  from public.auctions
  where id = p_auction_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'Auction not found.'
    );
  end if;

  -- 3. Verify status is active (LIVE)
  if v_auction.status != 'LIVE' then
    return jsonb_build_object(
      'success', false,
      'message', 'Bidding is only allowed on active, live auctions.'
    );
  end if;

  -- 4. Check if auction has started
  if v_auction.start_time > now() then
    return jsonb_build_object(
      'success', false,
      'message', 'This auction has not started yet.'
    );
  end if;

  -- 5. Check if auction has already expired
  if v_auction.end_time <= now() then
    -- Auto-close state transition if someone tries to bid on an expired live row
    update public.auctions
    set status = 'ENDED', updated_at = now()
    where id = p_auction_id;

    return jsonb_build_object(
      'success', false,
      'message', 'Bidding closed. This auction has already ended.'
    );
  end if;

  -- 6. Check that bidder is not the seller
  if v_auction.seller_id = v_user_id then
    return jsonb_build_object(
      'success', false,
      'message', 'You cannot place bids on your own listings.'
    );
  end if;

  -- 7. Validate bid amount against current highest bid and min increment
  if v_auction.highest_bidder_id is not null then
    -- There are existing bids
    if p_bid_amount < (v_auction.current_highest_bid + v_auction.min_increment) then
      return jsonb_build_object(
        'success', false,
        'message', 'Bid must be at least ' || (v_auction.current_highest_bid + v_auction.min_increment)::text
      );
    end if;
  else
    -- First bid on the auction
    if p_bid_amount < v_auction.starting_price then
      return jsonb_build_object(
        'success', false,
        'message', 'Initial bid must meet the starting price of ' || v_auction.starting_price::text
      );
    end if;
  end if;

  -- 8. Anti-Sniping Protection
  -- If a bid arrives in the final 30 seconds, push back the end_time by 30 seconds from NOW
  v_new_end_time := v_auction.end_time;
  if (v_auction.end_time - now()) < (v_trigger_seconds || ' seconds')::interval then
    v_new_end_time := now() + (v_ext_seconds || ' seconds')::interval;
    v_extended := true;
  end if;

  -- 9. Insert bid history record
  insert into public.bids (auction_id, bidder_id, amount, created_at)
  values (p_auction_id, v_user_id, p_bid_amount, now());

  -- 10. Update current auction record
  update public.auctions
  set
    current_highest_bid = p_bid_amount,
    highest_bidder_id = v_user_id,
    end_time = v_new_end_time,
    updated_at = now()
  where id = p_auction_id;

  -- 11. Create a notification for the previously outbid user (if applicable)
  if v_auction.highest_bidder_id is not null and v_auction.highest_bidder_id != v_user_id then
    insert into public.notifications (user_id, title, body, type, link_id)
    values (
      v_auction.highest_bidder_id,
      'Outbid alert!',
      'You have been outbid on ' || (select title from public.products where id = v_auction.product_id) || '. The new high bid is ' || p_bid_amount::text,
      'OUTBID',
      p_auction_id
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Bid placed successfully.',
    'current_highest_bid', p_bid_amount,
    'end_time', v_new_end_time,
    'extended', v_extended
  );
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'message', 'An error occurred during bidding: ' || SQLERRM
    );
end;
$$;


-- =========================================================================
-- FUNCTION: close_expired_auctions()
-- Closes expired live auctions, creates winner/seller notifications, and
-- opens a direct messaging channel. Can be scheduled or triggered.
-- =========================================================================
create or replace function public.close_expired_auctions()
returns table (
  closed_auction_id uuid,
  winner_id uuid,
  seller_id uuid,
  conversation_id uuid
)
security definer
language plpgsql
as $$
declare
  r_auction record;
  v_conv_id uuid;
  v_prod_title text;
begin
  -- Loop through all LIVE auctions where end_time has passed
  for r_auction in
    select id, product_id, seller_id, highest_bidder_id, current_highest_bid
    from public.auctions
    where status = 'LIVE' and end_time <= now()
  loop
    -- Lock individual auction row
    update public.auctions
    set status = 'ENDED', updated_at = now()
    where id = r_auction.id;

    -- Fetch product title
    select title into v_prod_title
    from public.products
    where id = r_auction.product_id;

    v_conv_id := null;

    -- Process winner logic if a highest bidder exists
    if r_auction.highest_bidder_id is not null then
      -- 1. Notify the winner
      insert into public.notifications (user_id, title, body, type, link_id)
      values (
        r_auction.highest_bidder_id,
        'Congratulations! You won the auction!',
        'Your bid of ' || r_auction.current_highest_bid::text || ' was the winning bid for "' || v_prod_title || '". Click here to contact the seller.',
        'AUCTION_WON',
        r_auction.id
      );

      -- 2. Notify the seller
      insert into public.notifications (user_id, title, body, type, link_id)
      values (
        r_auction.seller_id,
        'Your auction has ended successfully!',
        'Your item "' || v_prod_title || '" sold for ' || r_auction.current_highest_bid::text || '. Click here to coordinate handover.',
        'AUCTION_ENDED_SELLER',
        r_auction.id
      );

      -- 3. Open a direct conversation channel post-auction
      insert into public.conversations (auction_id, created_at)
      values (r_auction.id, now())
      returning id into v_conv_id;

      -- Add participants (Seller & Winner)
      insert into public.conversation_participants (conversation_id, user_id)
      values
        (v_conv_id, r_auction.seller_id),
        (v_conv_id, r_auction.highest_bidder_id);

      -- Seed system introduction message
      insert into public.messages (conversation_id, sender_id, message_text, created_at)
      values (
        v_conv_id,
        r_auction.seller_id, -- Sent on behalf of system using seller context as base
        'Auction won! Chat is open. Please coordinate product handover and payment terms securely.',
        now()
      );
    else
      -- Auction ended without any bids
      insert into public.notifications (user_id, title, body, type, link_id)
      values (
        r_auction.seller_id,
        'Auction ended with no bids.',
        'Your auction for "' || v_prod_title || '" ended without any offers. You can choose to list it again.',
        'AUCTION_ENDED_NO_BIDS',
        r_auction.id
      );
    end if;

    -- Assign return row
    closed_auction_id := r_auction.id;
    winner_id := r_auction.highest_bidder_id;
    seller_id := r_auction.seller_id;
    conversation_id := v_conv_id;
    return next;
  end loop;
end;
$$;
