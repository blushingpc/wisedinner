-- Prepared, unapplied; only guarded pollers may send after separately approved rollout.
-- No recipient/body/credentials stored here. SMTP message ID stays private. Retention is undecided.
create table public.wd_support_sends(
 id text primary key check(id ~ '^[0-9a-f]{64}$'),fingerprint text not null check(fingerprint ~ '^[0-9a-f]{64}$'),
 owner uuid not null,state text not null check(state in ('reserved','sending','accepted','held')),
 created_at timestamptz not null default now(),accepted_at timestamptz,message_id text check(length(message_id) between 1 and 1024),
 check((state='accepted')=(message_id is not null))
);
create index wd_support_sends_recent on public.wd_support_sends((coalesce(accepted_at,created_at)));
create unique index wd_support_sends_message on public.wd_support_sends(message_id)where message_id is not null;
alter table public.wd_support_sends enable row level security;
revoke all on public.wd_support_sends from public,anon,authenticated;
grant select on public.wd_support_sends to service_role;
create function public.wd_support_send(p_action text,p_body jsonb)returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.wd_support_sends%rowtype;n bigint;u uuid;
begin
 if auth.role() is distinct from 'service_role' then raise insufficient_privilege;end if;
 if p_body is null or jsonb_typeof(p_body)<>'object' or octet_length(p_body::text)>2048 or p_body->>'id' is null or p_body->>'id' !~ '^[0-9a-f]{64}$' then return '{"error":"invalid_command"}';end if;
 if p_action not in ('reserve','begin','accept','hold') or p_action is null then return '{"error":"invalid_command"}';end if;
 if p_body->>'owner' is null then return '{"error":"invalid_command"}';end if;u:=(p_body->>'owner')::uuid;
 if p_action='reserve' then
  if p_body-'id'-'fingerprint'-'owner'<>'{}'::jsonb or p_body->>'fingerprint' is null or p_body->>'fingerprint'!~'^[0-9a-f]{64}$' then return '{"error":"invalid_command"}';end if;
  -- One backend-owned advisory lock serializes the rolling cap across serverless instances.
  perform pg_advisory_xact_lock(741008,11);
  select * into r from public.wd_support_sends where id=p_body->>'id' for update;
  if found then
   if r.fingerprint<>p_body->>'fingerprint' then return '{"error":"send_identity_conflict"}';end if;
   if r.state='accepted' then return jsonb_build_object('state','accepted','messageId',r.message_id);end if;
   return '{"error":"send_held"}'; -- No stealing reservations, expired sends or automatic uncertainty retry.
  end if;
  select (select count(*)from public.wd_support_sends where coalesce(accepted_at,created_at)>now()-interval '24 hours')+
   (select count(*)from public.support_messages_v2 m where m.direction='out' and m.created_at>now()-interval '24 hours'
    and not exists(select 1 from public.wd_support_sends s where s.message_id=m.message_id)) into n;
  if n>=450 then return '{"error":"send_cap"}';end if;
  insert into public.wd_support_sends(id,fingerprint,owner,state)values(p_body->>'id',p_body->>'fingerprint',u,'reserved');
  return '{"state":"reserved"}';
 end if;
 if (p_action='accept' and p_body-'id'-'owner'-'messageId'<>'{}'::jsonb)or(p_action<>'accept' and p_body-'id'-'owner'<>'{}'::jsonb)then return '{"error":"invalid_command"}';end if;
 select * into r from public.wd_support_sends where id=p_body->>'id' for update;
 if not found or r.owner<>u then return '{"error":"send_held"}';end if;
 if p_action='begin' then
  if r.state<>'reserved' or r.created_at<now()-interval '5 minutes' then return '{"error":"send_held"}';end if;
  update public.wd_support_sends set state='sending' where id=r.id;return '{"state":"sending"}';
 elsif p_action='accept' then
  if r.state<>'sending' or p_body->>'messageId' is null or length(p_body->>'messageId')not between 1 and 1024 then return '{"error":"send_held"}';end if;
  update public.wd_support_sends set state='accepted',accepted_at=now(),message_id=p_body->>'messageId' where id=r.id;return '{"state":"accepted"}';
 else
  if r.state in ('reserved','sending')then update public.wd_support_sends set state='held'where id=r.id;end if;
  return jsonb_build_object('state',case when r.state='accepted' then 'accepted' else 'held' end);
 end if;
end $$;
revoke all on function public.wd_support_send(text,jsonb)from public,anon,authenticated;
grant execute on function public.wd_support_send(text,jsonb)to service_role;
