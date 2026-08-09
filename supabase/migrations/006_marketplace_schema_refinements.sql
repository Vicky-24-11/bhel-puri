-- 006_MARKETPLACE_SCHEMA_REFINEMENTS.SQL
-- Refines update RLS rules and trigger restrictions to allow sellers to edit non-sensitive details while live

-- Drop old update policy to update it
drop policy if exists "Allow sellers to update their own auctions" on public.auctions;

-- Allow sellers to update their own auctions regardless of status (sensitive fields are protected by trigger checks below)
create policy "Allow sellers to update their own auctions" on public.auctions
  for update using (auth.uid() = seller_id);

-- Refined Trigger function for editing restrictions
create or replace function public.check_auction_update_restrictions()
returns trigger as $$
begin
  -- 1. Prevent standard users from modifying current_price or winner_id directly, regardless of status
  if (new.current_price <> old.current_price or new.winner_id <> old.winner_id) then
    if session_user = current_user then
      raise exception 'You are not authorized to directly modify current_price or winner_id on auctions.';
    end if;
  end if;

  -- 2. If the auction is live or ended/cancelled, restrict edits to sensitive details
  if (old.status in ('live', 'ended', 'cancelled')) then
    -- Sellers CANNOT change starting price, increments, schedules, or winner
    if (new.starting_price <> old.starting_price or
        new.minimum_bid_increment <> old.minimum_bid_increment or
        new.starts_at <> old.starts_at or
        new.ends_at <> old.ends_at) then
      raise exception 'You cannot edit price settings or schedules once an auction is live or completed.';
    end if;
    
    -- Status transitions when live are restricted to cancellations or ending
    if (new.status <> old.status and new.status not in ('ended', 'cancelled')) then
      raise exception 'Invalid status transition. Active auctions can only be ended or cancelled.';
    end if;
  end if;

  -- 3. Ended or Cancelled auctions are completely frozen (no status changes allowed)
  if (old.status in ('ended', 'cancelled') and new.status <> old.status) then
    raise exception 'This auction has already finished or been cancelled, its status cannot be modified.';
  end if;

  return new;
end;
$$ language plpgsql;

-- Re-bind trigger
drop trigger if exists enforce_auction_update_restrictions on public.auctions;
create trigger enforce_auction_update_restrictions
  before update on public.auctions
  for each row execute procedure public.check_auction_update_restrictions();
