-- Galerias Muebles y Decoraciones
-- Supabase/Postgres base schema for auth profiles, catalog, suppliers,
-- scraper sync, carts, inquiries, and admin logs.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('customer', 'admin', 'staff');
  end if;

  if not exists (select 1 from pg_type where typname = 'record_status') then
    create type public.record_status as enum ('active', 'inactive', 'draft', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'cart_status') then
    create type public.cart_status as enum ('active', 'converted', 'abandoned');
  end if;

  if not exists (select 1 from pg_type where typname = 'inquiry_status') then
    create type public.inquiry_status as enum ('new', 'contacted', 'closed', 'spam');
  end if;

  if not exists (select 1 from pg_type where typname = 'sync_status') then
    create type public.sync_status as enum ('running', 'completed', 'failed');
  end if;

  if not exists (select 1 from pg_type where typname = 'product_change_type') then
    create type public.product_change_type as enum ('created', 'updated', 'inactivated', 'reactivated');
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  role public.app_role not null default 'customer',
  status public.record_status not null default 'active',
  default_address_line1 text,
  default_address_line2 text,
  default_city text,
  default_state text,
  default_postal_code text,
  default_country text not null default 'MX',
  avatar_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('admin', 'staff'), false);
$$;

create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique,
  name text not null,
  initials text,
  logo_url text,
  website_url text,
  location text,
  city text,
  state text,
  country text,
  specialty text,
  notes text,
  since_year integer,
  status public.record_status not null default 'active',
  last_sync_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.providers(id) on delete set null,
  slug text not null,
  name text not null,
  parent_id uuid references public.product_categories(id) on delete set null,
  display_order integer not null default 0,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, slug)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.providers(id) on delete set null,
  category_id uuid references public.product_categories(id) on delete set null,
  sku text not null,
  name text not null,
  subtitle text,
  description text,
  category text,
  category_key text,
  image_url text,
  gallery jsonb not null default '[]'::jsonb,
  product_url text,
  specs jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  price numeric(12, 2),
  currency text not null default 'MXN',
  stock_quantity integer,
  status public.record_status not null default 'active',
  source text,
  source_hash text,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz,
  inactive_at timestamptz,
  missing_runs integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  unique (provider_id, sku)
);

create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  status public.cart_status not null default 'active',
  currency text not null default 'MXN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, product_id)
);

create table if not exists public.product_inquiries (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  provider_id uuid references public.providers(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  message text,
  preferred_channel text not null default 'whatsapp',
  status public.inquiry_status not null default 'new',
  assigned_to uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.providers(id) on delete set null,
  status public.sync_status not null default 'running',
  mode text not null default 'full',
  scoped_categories text[] not null default '{}',
  scraped_count integer not null default 0,
  new_count integer not null default 0,
  updated_count integer not null default 0,
  reactivated_count integer not null default 0,
  inactive_count integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_message text,
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.product_change_logs (
  id uuid primary key default gen_random_uuid(),
  sync_run_id uuid references public.sync_runs(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  provider_id uuid references public.providers(id) on delete set null,
  sku text,
  change_type public.product_change_type not null,
  changed_fields text[] not null default '{}',
  before_snapshot jsonb,
  after_snapshot jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('customer', 'admin')),
  identifier_hash text not null,
  ip_hash text not null,
  failed_count integer not null default 0 check (failed_count >= 0),
  blocked_until timestamptz,
  last_failed_at timestamptz,
  last_success_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope, identifier_hash, ip_hash)
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_providers_status on public.providers(status);
create index if not exists idx_products_provider_sku on public.products(provider_id, sku);
create index if not exists idx_products_status on public.products(status);
create index if not exists idx_products_category_key on public.products(category_key);
create index if not exists idx_products_updated_at on public.products(updated_at desc);
create index if not exists idx_products_last_seen_at on public.products(last_seen_at desc);
create index if not exists idx_product_inquiries_status on public.product_inquiries(status);
create index if not exists idx_sync_runs_provider_id on public.sync_runs(provider_id);
create index if not exists idx_change_logs_product_id on public.product_change_logs(product_id);
create index if not exists idx_login_attempts_scope_hashes on public.login_attempts(scope, identifier_hash, ip_hash);
create index if not exists idx_login_attempts_blocked_until on public.login_attempts(blocked_until)
where blocked_until is not null;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_providers_updated_at on public.providers;
create trigger set_providers_updated_at before update on public.providers
for each row execute function public.set_updated_at();

drop trigger if exists set_product_categories_updated_at on public.product_categories;
create trigger set_product_categories_updated_at before update on public.product_categories
for each row execute function public.set_updated_at();

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists set_carts_updated_at on public.carts;
create trigger set_carts_updated_at before update on public.carts
for each row execute function public.set_updated_at();

drop trigger if exists set_cart_items_updated_at on public.cart_items;
create trigger set_cart_items_updated_at before update on public.cart_items
for each row execute function public.set_updated_at();

drop trigger if exists set_product_inquiries_updated_at on public.product_inquiries;
create trigger set_product_inquiries_updated_at before update on public.product_inquiries
for each row execute function public.set_updated_at();

drop trigger if exists set_site_settings_updated_at on public.site_settings;
create trigger set_site_settings_updated_at before update on public.site_settings
for each row execute function public.set_updated_at();

drop trigger if exists set_login_attempts_updated_at on public.login_attempts;
create trigger set_login_attempts_updated_at before update on public.login_attempts
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.providers enable row level security;
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.favorites enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.product_inquiries enable row level security;
alter table public.sync_runs enable row level security;
alter table public.product_change_logs enable row level security;
alter table public.admin_activity_logs enable row level security;
alter table public.site_settings enable row level security;
alter table public.login_attempts enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert with check (id = auth.uid());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin" on public.profiles
for update using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists "providers_public_active_select" on public.providers;
create policy "providers_public_active_select" on public.providers
for select using (status = 'active' or public.is_admin());

drop policy if exists "providers_admin_all" on public.providers;
create policy "providers_admin_all" on public.providers
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "categories_public_active_select" on public.product_categories;
create policy "categories_public_active_select" on public.product_categories
for select using (status = 'active' or public.is_admin());

drop policy if exists "categories_admin_all" on public.product_categories;
create policy "categories_admin_all" on public.product_categories
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "products_public_active_select" on public.products;
create policy "products_public_active_select" on public.products
for select using (status = 'active' or public.is_admin());

drop policy if exists "products_admin_all" on public.products;
create policy "products_admin_all" on public.products
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "favorites_user_all" on public.favorites;
create policy "favorites_user_all" on public.favorites
for all to authenticated using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "carts_user_all" on public.carts;
create policy "carts_user_all" on public.carts
for all to authenticated using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "cart_items_user_all" on public.cart_items;
create policy "cart_items_user_all" on public.cart_items
for all to authenticated using (
  exists (
    select 1 from public.carts
    where carts.id = cart_items.cart_id
    and carts.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.carts
    where carts.id = cart_items.cart_id
    and carts.user_id = auth.uid()
  )
);

drop policy if exists "product_inquiries_public_insert" on public.product_inquiries;
create policy "product_inquiries_public_insert" on public.product_inquiries
for insert with check (true);

drop policy if exists "product_inquiries_admin_all" on public.product_inquiries;
create policy "product_inquiries_admin_all" on public.product_inquiries
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "sync_runs_admin_select" on public.sync_runs;
create policy "sync_runs_admin_select" on public.sync_runs
for select using (public.is_admin());

drop policy if exists "change_logs_admin_select" on public.product_change_logs;
create policy "change_logs_admin_select" on public.product_change_logs
for select using (public.is_admin());

drop policy if exists "admin_activity_logs_admin_select" on public.admin_activity_logs;
create policy "admin_activity_logs_admin_select" on public.admin_activity_logs
for select using (public.is_admin());

drop policy if exists "site_settings_public_select" on public.site_settings;
create policy "site_settings_public_select" on public.site_settings
for select using (true);

drop policy if exists "site_settings_admin_all" on public.site_settings;
create policy "site_settings_admin_all" on public.site_settings
for all using (public.is_admin())
with check (public.is_admin());

insert into public.providers (
  provider_key,
  name,
  initials,
  website_url,
  location,
  country,
  specialty,
  notes,
  status
) values (
  'coaster',
  'Coaster Furniture',
  'CF',
  'https://www.coasterfurniture.com',
  'United States',
  'US',
  'Furniture catalog supplier',
  'Imported by SKU scraper from coasterfurniture.com',
  'active'
) on conflict (provider_key) do update set
  name = excluded.name,
  website_url = excluded.website_url,
  updated_at = now();

insert into public.site_settings (key, value, description)
values
  ('store', '{"name":"Galerias Muebles y Decoraciones","currency":"MXN","country":"MX"}', 'Public store identity.'),
  ('contact', '{"whatsapp":"","email":"","phone":""}', 'Public contact channels.')
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description,
  updated_at = now();

-- After creating the first admin account in Supabase Auth, run:
-- update public.profiles set role = 'admin' where email = 'admin@galerias.com';
