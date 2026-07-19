-- Login security tables for failed attempts, CAPTCHA escalation, and temporary lockouts.
-- Run this in Supabase SQL Editor before enabling the secure-login Edge Function.

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

create index if not exists idx_login_attempts_scope_hashes
on public.login_attempts(scope, identifier_hash, ip_hash);

create index if not exists idx_login_attempts_blocked_until
on public.login_attempts(blocked_until)
where blocked_until is not null;

drop trigger if exists set_login_attempts_updated_at on public.login_attempts;
create trigger set_login_attempts_updated_at before update on public.login_attempts
for each row execute function public.set_updated_at();

alter table public.login_attempts enable row level security;

-- No public RLS policies on purpose.
-- This table should only be accessed with the service_role key from the secure-login Edge Function.

