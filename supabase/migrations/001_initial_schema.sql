-- 001_INITIAL_SCHEMA.SQL
-- Sets up the base database structure for Bhel Puri

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES TABLE
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  full_name text,
  avatar_url text,
  rating numeric(3, 2) default 0.00 check (rating >= 0.00 and rating <= 5.00),
  rating_count integer default 0,
  verification_status text check (verification_status in ('PENDING', 'VERIFIED', 'REJECTED')) default 'PENDING',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Trigger to automatically create profile on sign up
create or replace function public.handle_new_user()
returns trigger as $$
declare
  username_val text;
begin
  username_val := coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1)
  );

  -- Handle rare potential duplicate username from split email
  if exists (select 1 from public.profiles where username = username_val) then
    username_val := username_val || '_' || substring(gen_random_uuid()::text from 1 for 6);
  end if;

  insert into public.profiles (id, username, full_name, avatar_url, verification_status)
  values (
    new.id,
    username_val,
    coalesce(new.raw_user_meta_data->>'full_name', username_val),
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    'PENDING'
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. CATEGORIES TABLE
create table public.categories (
  id uuid default uuid_generate_v4() primary key,
  name text unique not null,
  slug text unique not null,
  icon_name text,
  description text,
  created_at timestamptz default now() not null
);

-- Pre-populate initial categories
insert into public.categories (name, slug, icon_name, description) values
  ('Vehicles', 'vehicles', 'car', 'Cars, bikes, and automotive accessories'),
  ('Electronics', 'electronics', 'smartphone', 'Mobile phones, laptops, and tech gadgets'),
  ('Furniture', 'furniture', 'sofa', 'Sofas, tables, beds, and home decors'),
  ('Watches', 'watches', 'watch', 'Luxury watches, smartwatches, and timepieces'),
  ('Fashion', 'fashion', 'shirt', 'Apparel, shoes, bags, and luxury clothing'),
  ('Gaming', 'gaming', 'gamepad-2', 'Consoles, video games, and gaming accessories'),
  ('Cameras', 'cameras', 'camera', 'DSLRs, lenses, action cameras, and drones'),
  ('Appliances', 'appliances', 'tv', 'Home and kitchen appliances'),
  ('Sports & Fitness', 'sports', 'dumbbell', 'Gym equipment, gear, and activewear'),
  ('Other', 'other', 'package', 'Uncategorized or miscellaneous items');

-- 3. PRODUCTS TABLE
create table public.products (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  attributes jsonb default '{}'::jsonb not null, -- Stores category-specific attributes dynamically
  location_name text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 4. PRODUCT IMAGES TABLE
create table public.product_images (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  image_url text not null,
  display_order integer default 0 not null,
  created_at timestamptz default now() not null
);

-- 5. AUCTIONS TABLE
create table public.auctions (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references public.products(id) on delete cascade unique not null,
  seller_id uuid references public.profiles(id) on delete cascade not null,
  starting_price numeric(12, 2) not null check (starting_price >= 0),
  reserve_price numeric(12, 2) check (reserve_price >= starting_price),
  min_increment numeric(12, 2) default 100.00 not null check (min_increment > 0),
  current_highest_bid numeric(12, 2) default 0.00 not null,
  highest_bidder_id uuid references public.profiles(id) on delete set null,
  status text check (status in ('DRAFT', 'UPCOMING', 'LIVE', 'ENDED', 'CANCELLED', 'COMPLETED')) default 'DRAFT' not null,
  start_time timestamptz not null,
  end_time timestamptz not null check (end_time > start_time),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 6. BIDS TABLE
create table public.bids (
  id uuid default uuid_generate_v4() primary key,
  auction_id uuid references public.auctions(id) on delete cascade not null,
  bidder_id uuid references public.profiles(id) on delete cascade not null,
  amount numeric(12, 2) not null,
  created_at timestamptz default now() not null
);

-- 7. WATCHLIST TABLE
create table public.watchlists (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  auction_id uuid references public.auctions(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  unique(user_id, auction_id)
);

-- 8. CONVERSATIONS TABLE
create table public.conversations (
  id uuid default uuid_generate_v4() primary key,
  auction_id uuid references public.auctions(id) on delete set null,
  created_at timestamptz default now() not null
);

-- 9. CONVERSATION PARTICIPANTS
create table public.conversation_participants (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  unique(conversation_id, user_id)
);

-- 10. MESSAGES TABLE
create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  message_text text,
  image_url text,
  read_at timestamptz,
  created_at timestamptz default now() not null
);

-- 11. NOTIFICATIONS TABLE
create table public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  body text not null,
  type text not null, -- 'OUTBID', 'AUCTION_WON', 'AUCTION_LOST', 'NEW_MESSAGE', 'AUCTION_LIVE'
  link_id uuid,      -- Can link to auction_id, conversation_id, etc.
  read boolean default false not null,
  created_at timestamptz default now() not null
);

-- 12. RATINGS TABLE
create table public.ratings (
  id uuid default uuid_generate_v4() primary key,
  auction_id uuid references public.auctions(id) on delete cascade not null,
  reviewer_id uuid references public.profiles(id) on delete cascade not null,
  reviewee_id uuid references public.profiles(id) on delete cascade not null,
  rating_value integer not null check (rating_value >= 1 and rating_value <= 5),
  comment text,
  created_at timestamptz default now() not null,
  unique(auction_id, reviewer_id)
);

-- 13. REPORTS TABLE
create table public.reports (
  id uuid default uuid_generate_v4() primary key,
  reporter_id uuid references public.profiles(id) on delete set null,
  reported_user_id uuid references public.profiles(id) on delete cascade,
  reported_auction_id uuid references public.auctions(id) on delete cascade,
  reason text not null,
  details text,
  status text check (status in ('PENDING', 'RESOLVED', 'DISMISSED')) default 'PENDING' not null,
  created_at timestamptz default now() not null
);

-- CREATE INDEXES FOR FREQUENTLY QUERIED COLUMNS
create index idx_products_category on public.products(category_id);
create index idx_product_images_product on public.product_images(product_id);
create index idx_auctions_product on public.auctions(product_id);
create index idx_auctions_seller on public.auctions(seller_id);
create index idx_auctions_status on public.auctions(status);
create index idx_auctions_end_time on public.auctions(end_time);
create index idx_bids_auction on public.bids(auction_id);
create index idx_bids_bidder on public.bids(bidder_id);
create index idx_bids_amount on public.bids(amount desc);
create index idx_watchlists_user on public.watchlists(user_id);
create index idx_conversation_participants_user on public.conversation_participants(user_id);
create index idx_messages_conversation on public.messages(conversation_id);
create index idx_messages_created_at on public.messages(created_at);
create index idx_notifications_user_read on public.notifications(user_id, read);
create index idx_ratings_reviewee on public.ratings(reviewee_id);
create index idx_reports_status on public.reports(status);
