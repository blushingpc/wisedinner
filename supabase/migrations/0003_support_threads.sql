-- BACKEND-V1 §1: support threads + messages v2. the legacy support_messages rows are migrated into threads
-- (one thread per row, channel 'form'); the legacy table and the waitlist table stay as they are.

create table if not exists support_threads (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email', 'form')),
  from_email text not null,
  subject text not null default '',
  status text not null default 'open' check (status in ('open', 'auto_replied', 'escalated', 'closed')),
  message_id text,                 -- the first inbound Message-ID (email threads), for In-Reply-To matching
  legacy_id uuid,                  -- support_messages.id when migrated
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_threads_status on support_threads (status);
create index if not exists support_threads_from on support_threads (from_email, created_at desc);
create unique index if not exists support_threads_message_id on support_threads (message_id) where message_id is not null;

create table if not exists support_messages_v2 (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references support_threads (id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  body text not null,
  ai boolean not null default false,
  message_id text,                 -- email Message-ID (in: as received; out: as sent)
  created_at timestamptz not null default now()
);
create index if not exists support_messages_v2_thread on support_messages_v2 (thread_id, created_at);
create index if not exists support_messages_v2_out on support_messages_v2 (direction, created_at desc);
create unique index if not exists support_messages_v2_message_id on support_messages_v2 (message_id) where message_id is not null;

alter table support_threads enable row level security;
alter table support_messages_v2 enable row level security;
-- no public policies on purpose.

-- migrate legacy rows once (idempotent on legacy_id).
insert into support_threads (channel, from_email, subject, status, legacy_id, created_at, updated_at)
select 'form', m.email, 'Support form', 'open', m.id, m.created_at, m.created_at
from support_messages m
where not exists (select 1 from support_threads t where t.legacy_id = m.id);

insert into support_messages_v2 (thread_id, direction, body, ai, created_at)
select t.id, 'in', case when m.name is not null and m.name <> '' then m.name || E'\n\n' || m.message else m.message end, false, m.created_at
from support_messages m
join support_threads t on t.legacy_id = m.id
where not exists (select 1 from support_messages_v2 v where v.thread_id = t.id);
