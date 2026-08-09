-- 005_PROFILE_DATABASE_FOUNDATION.SQL
-- Applies Phase 2 schema modifications, check constraints, security RLS, and restricted field trigger checks

-- 1. Alter public.profiles table
alter table public.profiles
  add column if not exists city text;

-- Sync city with location if location has data
update public.profiles set city = location where city is null and location is not null;

-- 2. Alter public.categories table
alter table public.categories
  add column if not exists icon text,
  add column if not exists is_active boolean default true,
  add column if not exists sort_order integer default 0;

-- Sync icon with icon_name
update public.categories set icon = icon_name where icon is null and icon_name is not null;

-- Update the slug for Sports & Fitness to sports-fitness
update public.categories set slug = 'sports-fitness' where slug = 'sports';

-- 3. Alter public.auctions table
alter table public.auctions
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists category_id uuid references public.categories(id) on delete set null,
  add column if not exists current_price numeric,
  add column if not exists minimum_bid_increment numeric,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists winner_id uuid references public.profiles(id) on delete set null;

-- Sync existing columns with default values if they are null
update public.auctions set current_price = starting_price where current_price is null;
update public.auctions set minimum_bid_increment = min_increment where minimum_bid_increment is null;
update public.auctions set starts_at = start_time where starts_at is null;
update public.auctions set ends_at = end_time where ends_at is null;

-- Add check constraints to auctions
-- First, drop constraints if they already exist
alter table public.auctions drop constraint if exists auctions_starting_price_check;
alter table public.auctions drop constraint if exists auctions_current_price_check;
alter table public.auctions drop constraint if exists auctions_minimum_bid_increment_check;
alter table public.auctions drop constraint if exists auctions_ends_at_check;
alter table public.auctions drop constraint if exists auctions_status_check;

alter table public.auctions
  add constraint auctions_starting_price_check check (starting_price >= 0),
  add constraint auctions_current_price_check check (current_price >= starting_price),
  add constraint auctions_minimum_bid_increment_check check (minimum_bid_increment > 0),
  add constraint auctions_ends_at_check check (ends_at > starts_at),
  add constraint auctions_status_check check (status in ('draft', 'scheduled', 'live', 'ended', 'cancelled'));

-- Update status strings to lowercase to match the lowercase status check
update public.auctions set status = lower(status);

-- 4. Create auction_images table
create table if not exists public.auction_images (
  id uuid default uuid_generate_v4() primary key,
  auction_id uuid references public.auctions(id) on delete cascade not null,
  storage_path text not null,
  display_order integer default 0 not null,
  created_at timestamptz default now() not null
);

-- Enable RLS on auction_images
alter table public.auction_images enable row level security;

-- Create policies on auction_images
create policy "Allow public read access to auction images" on public.auction_images for select using (true);
create policy "Allow sellers to manage images for their auctions" on public.auction_images
  for all using (
    exists (
      select 1 from public.auctions
      where auctions.id = auction_id and auctions.seller_id = auth.uid()
    )
  );

-- Enable RLS and create policies for auctions
alter table public.auctions enable row level security;

drop policy if exists "Allow public read access to auctions" on public.auctions;
drop policy if exists "Allow authenticated users to create auctions" on public.auctions;
drop policy if exists "Allow sellers to update their own auctions" on public.auctions;

create policy "Allow public read access to auctions" on public.auctions for select using (true);
create policy "Allow authenticated users to create auctions" on public.auctions for insert with check (auth.role() = 'authenticated' and auth.uid() = seller_id);
create policy "Allow sellers to update their own auctions" on public.auctions
  for update using (
    auth.uid() = seller_id and status in ('draft', 'scheduled')
  );

-- 5. Database function and trigger to block users from modifying current_price, status, or winner_id directly
create or replace function public.check_auction_update_restrictions()
returns trigger as $$
begin
  if (new.current_price <> old.current_price or 
      new.status <> old.status or 
      new.winner_id <> old.winner_id) then
    if session_user = current_user then
      raise exception 'You are not authorized to directly modify current_price, status, or winner_id on auctions.';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists enforce_auction_update_restrictions on public.auctions;
create trigger enforce_auction_update_restrictions
  before update on public.auctions
  for each row execute procedure public.check_auction_update_restrictions();
