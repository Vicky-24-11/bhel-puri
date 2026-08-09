-- 008_LIVE_AUCTION_ENGINE.SQL
-- Sets up the database objects for the Live Auction Engine including participants, bid constraints, RLS, and secure atomic functions.

-- 1. Create auction_participants Table
create table if not exists public.auction_participants (
  id uuid default gen_random_uuid() primary key,
  auction_id uuid not null references public.auctions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('active', 'left', 'winner', 'lost')) default 'active',
  joined_at timestamptz default now() not null,
  left_at timestamptz,
  created_at timestamptz default now() not null,
  unique(auction_id, user_id)
);

-- 2. Indexes for Performance and Speed
create index if not exists idx_bids_auction_id on public.bids(auction_id);
create index if not exists idx_bids_bidder_id on public.bids(bidder_id);
create index if not exists idx_bids_auction_id_created_at on public.bids(auction_id, created_at desc);
create index if not exists idx_bids_auction_id_amount on public.bids(auction_id, amount desc);

create index if not exists idx_participants_auction_id on public.auction_participants(auction_id);
create index if not exists idx_participants_user_id on public.auction_participants(user_id);
create index if not exists idx_participants_auction_user on public.auction_participants(auction_id, user_id);

-- 3. Check Constraint on bids Amount (must be greater than 0)
alter table public.bids drop constraint if exists bids_amount_check;
alter table public.bids add constraint bids_amount_check check (amount > 0);

-- 4. Enable RLS on auction_participants (and bids already enabled)
alter table public.auction_participants enable row level security;
alter table public.bids enable row level security;

-- 5. RLS Policies
-- Select Policies
drop policy if exists "Allow public read access to participants" on public.auction_participants;
create policy "Allow public read access to participants"
  on public.auction_participants for select
  using (true);

drop policy if exists "Allow public read access to bids" on public.bids;
create policy "Allow public read access to bids"
  on public.bids for select
  using (true);

-- Insert/Update/Delete Policies: Restricted strictly to database functions (RPCs) running as security definer.
-- Clients cannot insert directly to bids or participants.
drop policy if exists "Allow authenticated users to insert their own bids" on public.bids;
drop policy if exists "Allow users to join auctions directly" on public.auction_participants;

-- DROP OLD LEGACY FUNCTIONS TO AVOID PARAMETER CONFLICTS
drop function if exists public.place_bid(uuid, numeric);
drop function if exists public.finalize_auction(uuid);
drop function if exists public.finalize_expired_auctions();
drop function if exists public.join_auction(uuid);
drop function if exists public.leave_auction(uuid);

-- 6. secure join_auction Function
create or replace function public.join_auction(
  p_auction_id uuid
)
returns jsonb as $$
declare
  v_user_id uuid;
  v_auction record;
  v_participant record;
begin
  -- Require authentication
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required. Please log in.';
  end if;

  -- Lock the auction row
  select * into v_auction
  from public.auctions
  where id = p_auction_id;

  if not found then
    raise exception 'Auction not found.';
  end if;

  -- Verify auction is live
  if v_auction.status <> 'live' then
    raise exception 'Bidding is closed. This auction is not live.';
  end if;

  -- Verify current time is before ends_at
  if v_auction.ends_at <= now() then
    raise exception 'This auction has already ended.';
  end if;

  -- Verify bidder is not the seller
  if v_auction.seller_id = v_user_id then
    raise exception 'Sellers cannot participate in their own auctions.';
  end if;

  -- Insert or reactivate participant record
  select * into v_participant
  from public.auction_participants
  where auction_id = p_auction_id and user_id = v_user_id;

  if found then
    if v_participant.status = 'left' then
      update public.auction_participants
      set status = 'active', left_at = null, joined_at = now()
      where auction_id = p_auction_id and user_id = v_user_id
      returning * into v_participant;
    end if;
  else
    insert into public.auction_participants (auction_id, user_id, status, joined_at)
    values (p_auction_id, v_user_id, 'active', now())
    returning * into v_participant;
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Successfully joined the auction.',
    'participant', to_jsonb(v_participant)
  );
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'message', SQLERRM
    );
end;
$$ language plpgsql security definer;

-- 7. secure leave_auction Function
create or replace function public.leave_auction(
  p_auction_id uuid
)
returns jsonb as $$
declare
  v_user_id uuid;
  v_has_bid boolean;
begin
  -- Require authentication
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required. Please log in.';
  end if;

  -- Check if user has placed a bid
  select exists (
    select 1 from public.bids
    where auction_id = p_auction_id and bidder_id = v_user_id
  ) into v_has_bid;

  if v_has_bid then
    raise exception 'You cannot leave this auction because you have already placed a bid.';
  end if;

  -- Update participant status to 'left'
  update public.auction_participants
  set status = 'left', left_at = now()
  where auction_id = p_auction_id and user_id = v_user_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Successfully left the auction.'
  );
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'message', SQLERRM
    );
end;
$$ language plpgsql security definer;

-- 8. secure place_bid Function
create or replace function public.place_bid(
  p_auction_id uuid,
  p_amount numeric
)
returns jsonb as $$
declare
  v_user_id uuid;
  v_auction record;
  v_is_participant boolean;
begin
  -- Identify and verify authenticated user
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required. Please log in.';
  end if;

  -- Lock the auction row exclusively to prevent race conditions
  select * into v_auction
  from public.auctions
  where id = p_auction_id
  for update;

  if not found then
    raise exception 'Auction not found.';
  end if;

  -- Verify status is live
  if v_auction.status <> 'live' then
    raise exception 'Bidding is closed. This auction is not live.';
  end if;

  -- Verify current time is before ends_at
  if v_auction.ends_at <= now() then
    raise exception 'Bidding is closed. This auction has ended.';
  end if;

  -- Verify bidder is not the seller
  if v_auction.seller_id = v_user_id then
    raise exception 'You cannot place a bid on your own auction.';
  end if;

  -- Verify bidder is an active participant
  select exists (
    select 1 from public.auction_participants
    where auction_id = p_auction_id and user_id = v_user_id and status = 'active'
  ) into v_is_participant;

  if not v_is_participant then
    raise exception 'You must join the auction before placing a bid.';
  end if;

  -- Validate bid amount
  if v_auction.current_price > 0 then
    if p_amount < (v_auction.current_price + v_auction.minimum_bid_increment) then
      raise exception 'Your bid must be at least ₹%', (v_auction.current_price + v_auction.minimum_bid_increment)::text;
    end if;
  else
    if p_amount < v_auction.starting_price then
      raise exception 'Initial bid must meet the starting price of ₹%', v_auction.starting_price::text;
    end if;
  end if;

  -- Insert bid record
  insert into public.bids (auction_id, bidder_id, amount, created_at)
  values (p_auction_id, v_user_id, p_amount, now());

  -- Update auction current price and highest bidder
  update public.auctions
  set 
    current_price = p_amount,
    highest_bidder_id = v_user_id,
    updated_at = now()
  where id = p_auction_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Bid placed successfully.',
    'current_price', p_amount
  );
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'message', SQLERRM
    );
end;
$$ language plpgsql security definer;

-- 9. secure finalize_auction Function
create or replace function public.finalize_auction(
  p_auction_id uuid
)
returns jsonb as $$
declare
  v_auction record;
  v_highest_bid record;
  v_winner_id uuid := null;
begin
  -- Lock the auction row
  select * into v_auction
  from public.auctions
  where id = p_auction_id
  for update;

  if not found then
    raise exception 'Auction not found.';
  end if;

  -- Verify auction ends_at has passed
  if v_auction.ends_at > now() then
    raise exception 'Auction cannot be finalized before it ends.';
  end if;

  -- Prevent duplicate finalization
  if v_auction.status = 'ended' then
    return jsonb_build_object(
      'success', true,
      'message', 'Auction has already been finalized.',
      'auction', to_jsonb(v_auction)
    );
  end if;

  -- Find the highest valid bid
  select * into v_highest_bid
  from public.bids
  where auction_id = p_auction_id
  order by amount desc, created_at asc
  limit 1;

  if found then
    v_winner_id := v_highest_bid.bidder_id;
  end if;

  -- Update auction status and winner_id
  update public.auctions
  set
    status = 'ended',
    winner_id = v_winner_id,
    updated_at = now()
  where id = p_auction_id
  returning * into v_auction;

  -- Update participant statuses
  if v_winner_id is not null then
    -- Winner
    update public.auction_participants
    set status = 'winner'
    where auction_id = p_auction_id and user_id = v_winner_id;

    -- Losers
    update public.auction_participants
    set status = 'lost'
    where auction_id = p_auction_id and user_id <> v_winner_id and status = 'active';
  else
    -- Mark all active participants as lost if no bids
    update public.auction_participants
    set status = 'lost'
    where auction_id = p_auction_id and status = 'active';
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Auction finalized successfully.',
    'auction', to_jsonb(v_auction)
  );
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'message', SQLERRM
    );
end;
$$ language plpgsql security definer;

-- 10. secure finalize_expired_auctions Function
create or replace function public.finalize_expired_auctions()
returns void as $$
declare
  r_auction record;
begin
  for r_auction in
    select id
    from public.auctions
    where status = 'live' and ends_at <= now()
  loop
    perform public.finalize_auction(r_auction.id);
  end loop;
end;
$$ language plpgsql security definer;
