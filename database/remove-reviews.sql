-- Optional cleanup for an existing Supabase project.
-- Run this only if you want to permanently remove the reviews structure.

drop table if exists public.product_reviews cascade;

alter table public.products
  drop column if exists rating,
  drop column if exists reviews_count;
