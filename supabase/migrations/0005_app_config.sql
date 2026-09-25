-- app_config: key/value settings the website and Build 2 read live (no redeploy), edited by the founder in the
-- Supabase Table Editor or with one SQL update. Service key only: RLS on, no policies, same as every other table.
-- First key: founders_invite_url, served by /api/data/latest as config.founders_invite_url (empty until set).
create table if not exists app_config (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

alter table app_config enable row level security;

insert into app_config (key, value) values ('founders_invite_url', '')
on conflict (key) do nothing;
