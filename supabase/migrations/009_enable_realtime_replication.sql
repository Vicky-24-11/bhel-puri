-- 009_ENABLE_REALTIME_REPLICATION.SQL
-- Configures Supabase Realtime replication for the auctions and bids tables.

do $$
begin
  -- 1. Enable replication for auctions table if not already added
  if not exists (
    select 1 from pg_publication_rel pr
    join pg_class c on pr.prrelid = c.oid
    join pg_publication p on pr.prpubid = p.oid
    where c.relname = 'auctions' and p.pubname = 'supabase_realtime'
  ) then
    alter publication supabase_realtime add table public.auctions;
  end if;

  -- 2. Enable replication for bids table if not already added
  if not exists (
    select 1 from pg_publication_rel pr
    join pg_class c on pr.prrelid = c.oid
    join pg_publication p on pr.prpubid = p.oid
    where c.relname = 'bids' and p.pubname = 'supabase_realtime'
  ) then
    alter publication supabase_realtime add table public.bids;
  end if;
end $$;
