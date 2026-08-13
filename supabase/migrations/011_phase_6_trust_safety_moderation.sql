-- 011_PHASE_6_TRUST_SAFETY_MODERATION.SQL
-- Schema, constraints, RLS, triggers, and RPC functions for safety and protection.

-- 1. Create reports Table
create table if not exists public.reports (
  id uuid default gen_random_uuid() primary key,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete cascade,
  auction_id uuid references public.auctions(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  reason text not null check (reason in ('fake_item', 'scam', 'prohibited_item', 'misleading_information', 'offensive_content', 'duplicate_listing', 'harassment', 'spam', 'other')),
  description text,
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'resolved', 'dismissed', 'action_taken')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  -- Check: must target at least one entity
  constraint check_report_target check (
    (reported_user_id is not null)::integer +
    (auction_id is not null)::integer +
    (message_id is not null)::integer >= 1
  )
);

-- 2. Create blocked_users Table
create table if not exists public.blocked_users (
  id uuid default gen_random_uuid() primary key,
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now() not null,
  -- Prevent self-blocking
  constraint check_self_block check (blocker_id <> blocked_id),
  -- Unique block pairing
  constraint unique_block_pair unique (blocker_id, blocked_id)
);

-- Add profiles.deleted_at column for soft deletion logic
alter table public.profiles add column if not exists deleted_at timestamptz;

-- 3. Create Indexes & Duplication Constraints
-- Partial unique indexes to prevent duplicate spam reports from a single user
create unique index if not exists idx_reports_unique_auction 
  on public.reports (reporter_id, auction_id, reason) 
  where auction_id is not null;

create unique index if not exists idx_reports_unique_user 
  on public.reports (reporter_id, reported_user_id, reason) 
  where reported_user_id is not null;

create unique index if not exists idx_reports_unique_message 
  on public.reports (reporter_id, message_id, reason) 
  where message_id is not null;

create index if not exists idx_reports_reporter_id on public.reports(reporter_id);
create index if not exists idx_blocked_users_blocker_id on public.blocked_users(blocker_id);
create index if not exists idx_blocked_users_blocked_id on public.blocked_users(blocked_id);

-- 4. Enable Row Level Security (RLS)
alter table public.reports enable row level security;
alter table public.blocked_users enable row level security;

-- 5. RLS Policies
-- Reports Select & Insert
drop policy if exists "Allow users to view own reports" on public.reports;
create policy "Allow users to view own reports"
  on public.reports for select
  using (auth.uid() = reporter_id);

drop policy if exists "Allow users to create reports" on public.reports;
create policy "Allow users to create reports"
  on public.reports for insert
  with check (auth.role() = 'authenticated' and auth.uid() = reporter_id);

-- Blocked Users Policies
drop policy if exists "Allow blocker to select own blocks" on public.blocked_users;
create policy "Allow blocker to select own blocks"
  on public.blocked_users for select
  using (auth.uid() = blocker_id);

drop policy if exists "Allow blocker to insert block" on public.blocked_users;
create policy "Allow blocker to insert block"
  on public.blocked_users for insert
  with check (auth.role() = 'authenticated' and auth.uid() = blocker_id);

drop policy if exists "Allow blocker to delete block" on public.blocked_users;
create policy "Allow blocker to delete block"
  on public.blocked_users for delete
  using (auth.uid() = blocker_id);

-- Recreate storage upload policy to validate image files format
drop policy if exists "Authenticated User Upload Product Image" on storage.objects;
create policy "Authenticated User Upload Product Image"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images' 
    and auth.role() = 'authenticated' 
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(storage.extension(name)) in ('png', 'jpg', 'jpeg', 'webp')
  );

-- 6. Trigger Function to Validate Listing and Bids integrity
-- Check listing creation guidelines (limits duration to 15 min - 7 days)
create or replace function public.validate_auction_insertion()
returns trigger as $$
begin
  if new.title is null or length(trim(new.title)) < 3 then
    raise exception 'Listing title is too short. Try writing a descriptive title.';
  end if;

  if new.description is null or length(trim(new.description)) < 10 then
    raise exception 'Listing description is too short. Detailed descriptions help bidders feel confident.';
  end if;

  if new.starting_price is null or new.starting_price <= 0 then
    raise exception 'Starting price must be greater than zero.';
  end if;

  if new.minimum_bid_increment is null or new.minimum_bid_increment <= 0 then
    raise exception 'Minimum increment must be greater than zero.';
  end if;

  if new.starts_at is null or new.ends_at is null or new.ends_at <= new.starts_at then
    raise exception 'End time must be after the starting time.';
  end if;

  if new.ends_at < now() then
    raise exception 'End time cannot be in the past.';
  end if;

  -- Enforce duration limits (Min: 15 minutes, Max: 7 days)
  if new.ends_at - new.starts_at < interval '15 minutes' then
    raise exception 'Auction duration must be at least 15 minutes.';
  end if;

  if new.ends_at - new.starts_at > interval '7 days' then
    raise exception 'Auction duration cannot exceed 7 days.';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_validate_auction_insert on public.auctions;
create trigger tr_validate_auction_insert
  before insert or update on public.auctions
  for each row
  execute function public.validate_auction_insertion();

-- Trigger to assert report guidelines (users cannot report themselves)
create or replace function public.validate_report_insertion()
returns trigger as $$
begin
  if new.reporter_id = new.reported_user_id then
    raise exception 'You cannot report your own profile.';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_validate_report_insert on public.reports;
create trigger tr_validate_report_insert
  before insert on public.reports
  for each row
  execute function public.validate_report_insertion();

-- 7. Secure Account Deletion Architecture
-- Safely sever cascade connection between profiles and auth.users
do $$
declare
  r record;
begin
  for r in
    select constraint_name
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'profiles'
      and constraint_type = 'FOREIGN KEY'
  loop
    execute 'alter table public.profiles drop constraint if exists ' || quote_ident(r.constraint_name);
  end loop;
end;
$$;

-- Create Account Deletion definer RPC
create or replace function public.delete_user_account()
returns void as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required. Please log in.';
  end if;

  -- 1. Soft-delete and anonymize user profile to preserve bid history
  update public.profiles
  set
    username = 'deleted_user_' || substring(v_user_id::text from 1 for 8),
    full_name = 'Deleted User',
    avatar_url = null,
    bio = null,
    city = null,
    deleted_at = now()
  where id = v_user_id;

  -- 2. Clear out user credentials and settings
  delete from public.watchlists where user_id = v_user_id;
  delete from public.notifications where user_id = v_user_id;
  delete from public.blocked_users where blocker_id = v_user_id or blocked_id = v_user_id;

  -- 3. Delete auth entry (severed profile remains intact as soft-deleted)
  delete from auth.users where id = v_user_id;
end;
$$ language plpgsql security definer;

-- 8. Enhance Chat RPCs to block blocked contacts
create or replace function public.create_auction_conversation(
  p_auction_id uuid
)
returns uuid as $$
declare
  v_user_id uuid;
  v_auction record;
  v_conv_id uuid;
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

  -- Verify auction is ended and has a valid winner
  if v_auction.status <> 'ended' or v_auction.winner_id is null then
    raise exception 'Conversations can only be initiated for completed auctions with a winning bidder.';
  end if;

  -- Verify caller is either the seller or the winner
  if v_user_id <> v_auction.seller_id and v_user_id <> v_auction.winner_id then
    raise exception 'Access Denied: You are not authorized to start a conversation for this listing.';
  end if;

  -- Verify neither participant has blocked the other
  if exists (
    select 1 from public.blocked_users
    where (blocker_id = v_auction.seller_id and blocked_id = v_auction.winner_id)
       or (blocker_id = v_auction.winner_id and blocked_id = v_auction.seller_id)
  ) then
    raise exception 'Cannot create conversation. This seller or winner is currently blocked.';
  end if;

  -- Idempotently insert or retrieve conversation
  select id into v_conv_id
  from public.conversations
  where auction_id = p_auction_id;

  if not found then
    insert into public.conversations (auction_id, seller_id, winner_id)
    values (p_auction_id, v_auction.seller_id, v_auction.winner_id)
    returning id into v_conv_id;
  end if;

  return v_conv_id;
end;
$$ language plpgsql security definer;

create or replace function public.send_chat_message(
  p_conversation_id uuid,
  p_content text
)
returns jsonb as $$
declare
  v_user_id uuid;
  v_conversation record;
  v_message record;
  v_clean_content text;
begin
  -- Require authentication
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required. Please log in.';
  end if;

  -- Fetch and verify conversation
  select * into v_conversation
  from public.conversations
  where id = p_conversation_id;

  if not found then
    raise exception 'Conversation not found.';
  end if;

  -- Verify membership
  if v_user_id <> v_conversation.seller_id and v_user_id <> v_conversation.winner_id then
    raise exception 'Access Denied: You do not belong to this conversation.';
  end if;

  -- Verify neither participant has blocked the other
  if exists (
    select 1 from public.blocked_users
    where (blocker_id = v_conversation.seller_id and blocked_id = v_conversation.winner_id)
       or (blocker_id = v_conversation.winner_id and blocked_id = v_conversation.seller_id)
  ) then
    raise exception 'Access Denied: This conversation is unavailable due to blocking.';
  end if;

  -- Validate and trim content
  v_clean_content := trim(p_content);
  if length(v_clean_content) = 0 then
    raise exception 'Message content cannot be empty.';
  end if;
  if length(v_clean_content) > 2000 then
    raise exception 'Message content exceeds the 2000 character limit.';
  end if;

  -- Insert message
  insert into public.messages (conversation_id, sender_id, content, created_at)
  values (p_conversation_id, v_user_id, v_clean_content, now())
  returning * into v_message;

  -- Update conversation updated_at trigger
  update public.conversations
  set updated_at = now()
  where id = p_conversation_id;

  return to_jsonb(v_message);
end;
$$ language plpgsql security definer;
