-- 002_RLS_POLICIES.SQL
-- Configures Row Level Security (RLS) for all tables to protect user data

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.auctions enable row level security;
alter table public.bids enable row level security;
alter table public.watchlists enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.ratings enable row level security;
alter table public.reports enable row level security;

-- =========================================================================
-- PROFILES POLICIES
-- =========================================================================
create policy "Allow public read access to profiles"
  on public.profiles for select
  using (true);

create policy "Allow users to update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- =========================================================================
-- CATEGORIES POLICIES
-- =========================================================================
create policy "Allow public read access to categories"
  on public.categories for select
  using (true);

-- (Write operations restricted to database admins by default, no public write policy)

-- =========================================================================
-- PRODUCTS POLICIES
-- =========================================================================
create policy "Allow public read access to products"
  on public.products for select
  using (true);

create policy "Allow authenticated users to create products"
  on public.products for insert
  with check (auth.role() = 'authenticated');

create policy "Allow sellers to update their own products"
  on public.products for update
  using (
    exists (
      select 1 from public.auctions
      where auctions.product_id = id and auctions.seller_id = auth.uid()
    )
  );

-- =========================================================================
-- PRODUCT IMAGES POLICIES
-- =========================================================================
create policy "Allow public read access to product images"
  on public.product_images for select
  using (true);

create policy "Allow authenticated users to upload product images"
  on public.product_images for insert
  with check (auth.role() = 'authenticated');

create policy "Allow sellers to delete product images"
  on public.product_images for delete
  using (
    exists (
      select 1 from public.auctions
      where auctions.product_id = product_id and auctions.seller_id = auth.uid()
    )
  );

-- =========================================================================
-- AUCTIONS POLICIES
-- =========================================================================
create policy "Allow public read access to auctions"
  on public.auctions for select
  using (true);

create policy "Allow authenticated users to create auctions"
  on public.auctions for insert
  with check (auth.role() = 'authenticated' and auth.uid() = seller_id);

create policy "Allow sellers to update draft/upcoming auctions"
  on public.auctions for update
  using (auth.uid() = seller_id and status in ('DRAFT', 'UPCOMING'))
  with check (auth.uid() = seller_id and status in ('DRAFT', 'UPCOMING'));

-- =========================================================================
-- BIDS POLICIES
-- =========================================================================
create policy "Allow public read access to bids"
  on public.bids for select
  using (true);

create policy "Allow authenticated users to insert their own bids"
  on public.bids for insert
  with check (auth.role() = 'authenticated' and auth.uid() = bidder_id);

-- (Bids cannot be updated or deleted, fulfilling database history requirements)

-- =========================================================================
-- WATCHLIST POLICIES
-- =========================================================================
create policy "Allow users to view their own watchlist"
  on public.watchlists for select
  using (auth.uid() = user_id);

create policy "Allow users to add to their watchlist"
  on public.watchlists for insert
  with check (auth.role() = 'authenticated' and auth.uid() = user_id);

create policy "Allow users to remove from their watchlist"
  on public.watchlists for delete
  using (auth.uid() = user_id);

-- =========================================================================
-- CONVERSATIONS & PARTICIPANTS POLICIES
-- =========================================================================
create policy "Allow participants to view conversations"
  on public.conversations for select
  using (
    exists (
      select 1 from public.conversation_participants
      where conversation_participants.conversation_id = id
      and conversation_participants.user_id = auth.uid()
    )
  );

create policy "Allow participants to view conversation membership"
  on public.conversation_participants for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_id
      and cp.user_id = auth.uid()
    )
  );

create policy "Allow creation of conversation participants"
  on public.conversation_participants for insert
  with check (auth.role() = 'authenticated');

-- =========================================================================
-- MESSAGES POLICIES
-- =========================================================================
create policy "Allow participants to view messages in conversation"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversation_participants
      where conversation_participants.conversation_id = conversation_id
      and conversation_participants.user_id = auth.uid()
    )
  );

create policy "Allow participants to send messages"
  on public.messages for insert
  with check (
    auth.role() = 'authenticated' 
    and auth.uid() = sender_id
    and exists (
      select 1 from public.conversation_participants
      where conversation_participants.conversation_id = conversation_id
      and conversation_participants.user_id = auth.uid()
    )
  );

-- =========================================================================
-- NOTIFICATIONS POLICIES
-- =========================================================================
create policy "Allow users to view their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Allow users to update/read their own notifications"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =========================================================================
-- RATINGS POLICIES
-- =========================================================================
create policy "Allow public read access to ratings"
  on public.ratings for select
  using (true);

create policy "Allow users to create ratings"
  on public.ratings for insert
  with check (auth.role() = 'authenticated' and auth.uid() = reviewer_id);

-- =========================================================================
-- REPORTS POLICIES
-- =========================================================================
create policy "Allow users to create reports"
  on public.reports for insert
  with check (auth.role() = 'authenticated' and auth.uid() = reporter_id);

create policy "Allow users to view their submitted reports"
  on public.reports for select
  using (auth.uid() = reporter_id);
