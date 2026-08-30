-- SITE-SPEC §9. run in the supabase SQL editor (service role only; no public policies on purpose).
create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text not null default 'hero',
  quiz jsonb,
  created_at timestamptz default now()
);
create table if not exists support_messages (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text not null,
  message text not null,
  created_at timestamptz default now()
);
alter table waitlist enable row level security;
alter table support_messages enable row level security;
-- no public policies; server routes use the service role key only.
