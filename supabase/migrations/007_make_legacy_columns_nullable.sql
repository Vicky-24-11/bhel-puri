-- 007_MAKE_LEGACY_COLUMNS_NULLABLE.SQL
alter table public.auctions
  alter column product_id drop not null,
  alter column start_time drop not null,
  alter column end_time drop not null;
