-- 012_PHASE_7_PRODUCTION_READINESS.SQL
-- Schema additions, indexing optimizations, and push token tables.

-- 1. Create user_push_tokens Table
create table if not exists public.user_push_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  device_name text,
  is_active boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  -- Enforce unique token per profile to prevent duplicates
  constraint unique_user_device_token unique (user_id, expo_push_token)
);

-- Enable Row Level Security (RLS)
alter table public.user_push_tokens enable row level security;

-- 2. Configure RLS Policies for user_push_tokens
drop policy if exists "Allow users to view own push tokens" on public.user_push_tokens;
create policy "Allow users to view own push tokens"
  on public.user_push_tokens for select
  using (auth.uid() = user_id);

drop policy if exists "Allow users to insert own push tokens" on public.user_push_tokens;
create policy "Allow users to insert own push tokens"
  on public.user_push_tokens for insert
  with check (auth.role() = 'authenticated' and auth.uid() = user_id);

drop policy if exists "Allow users to update own push tokens" on public.user_push_tokens;
create policy "Allow users to update own push tokens"
  on public.user_push_tokens for update
  using (auth.uid() = user_id);

drop policy if exists "Allow users to delete own push tokens" on public.user_push_tokens;
create policy "Allow users to delete own push tokens"
  on public.user_push_tokens for delete
  using (auth.uid() = user_id);

-- 3. Database Indices for Performance Optimization
-- Query optimizations for auction status & creations
create index if not exists idx_auctions_status_created 
  on public.auctions (status, created_at desc);

-- Category-based listing searches
create index if not exists idx_auctions_category_id 
  on public.auctions (category_id) 
  where status = 'live';

-- User specific listings searches
create index if not exists idx_auctions_seller_id 
  on public.auctions (seller_id);

-- Query optimizations for bid feeds
create index if not exists idx_bids_auction_created 
  on public.bids (auction_id, created_at desc);

-- Participant validations
create index if not exists idx_participants_user_id 
  on public.auction_participants (user_id);

-- In-app notifications unread states
create index if not exists idx_notifications_user_unread 
  on public.notifications (user_id, is_read) 
  where is_read = false;

-- Chat message retrievals
create index if not exists idx_messages_conversation_created 
  on public.messages (conversation_id, created_at desc);
