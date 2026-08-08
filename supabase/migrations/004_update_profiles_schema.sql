-- 004_UPDATE_PROFILES_SCHEMA.SQL
-- Updates the public.profiles table schema to match Bhel Puri requirements and sets up storage buckets/policies

-- 1. Alter public.profiles table
alter table public.profiles
  add column if not exists bio text,
  add column if not exists location text,
  add column if not exists is_verified boolean default false,
  add column if not exists is_profile_completed boolean default false;

-- Rename rating_count to total_ratings if rating_count exists and total_ratings doesn't
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'rating_count') then
    alter table public.profiles rename column rating_count to total_ratings;
  end if;
end $$;

-- Update trigger function to include default completed state
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

  insert into public.profiles (id, username, full_name, avatar_url, bio, location, is_verified, is_profile_completed)
  values (
    new.id,
    username_val,
    coalesce(new.raw_user_meta_data->>'full_name', username_val),
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    coalesce(new.raw_user_meta_data->>'bio', ''),
    coalesce(new.raw_user_meta_data->>'location', ''),
    false,
    false
  );
  return new;
end;
$$ language plpgsql security definer;

-- 2. Create Storage Buckets for avatars and product-images
-- (Inserting if not exists)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Enable RLS on storage.objects
alter table storage.objects enable row level security;

-- Storage Policies for avatars
create policy "Public Access to Avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Authenticated User Upload Avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars' 
    and auth.role() = 'authenticated' 
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Authenticated User Update Avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars' 
    and auth.role() = 'authenticated' 
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Authenticated User Delete Avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars' 
    and auth.role() = 'authenticated' 
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage Policies for product-images
create policy "Public Access to Product Images"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "Authenticated User Upload Product Image"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images' 
    and auth.role() = 'authenticated' 
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Authenticated User Update Product Image"
  on storage.objects for update
  using (
    bucket_id = 'product-images' 
    and auth.role() = 'authenticated' 
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Authenticated User Delete Product Image"
  on storage.objects for delete
  using (
    bucket_id = 'product-images' 
    and auth.role() = 'authenticated' 
    and (storage.foldername(name))[1] = auth.uid()::text
  );
