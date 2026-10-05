-- UNAPPLIED additive server-only billing. Synthetic/local proof is not live Apple/RevenueCat activation.
begin;
create table public.wd_billing_bindings (
  user_id uuid primary key references public.wd_accounts(user_id),
  app_user_id text not null unique default ('wd_' || gen_random_uuid()::text),
  held boolean not null default false,
  check (app_user_id ~ '^wd_[0-9a-f-]{36}$')
);
create table public.wd_billing_states (
  user_id uuid not null references public.wd_billing_bindings(user_id),
  environment text not null check (environment in ('PRODUCTION','SANDBOX')),
  generation bigint not null default 0,
  held boolean not null default false,
  state jsonb not null default '{"state":"unknown","expiresAt":null,"observedAt":0,"reason":"not_verified"}',
  request_minute bigint not null default 0,
  requests integer not null default 0,
  primary key(user_id,environment)
);
create table public.wd_billing_transactions (
  environment text not null check (environment in ('PRODUCTION','SANDBOX')),
  transaction_hash text not null check (transaction_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references public.wd_accounts(user_id),
  primary key(environment,transaction_hash)
);
create index wd_billing_transactions_owner on public.wd_billing_transactions(user_id);
create table public.wd_billing_events (
  environment text not null check (environment in ('PRODUCTION','SANDBOX','UNKNOWN')),
  event_id text not null check (length(event_id) between 1 and 128),
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  event_type text not null check (event_type ~ '^[A-Z_]{1,64}$'),
  event_timestamp_ms bigint not null check (event_timestamp_ms >= 0),
  account_ids jsonb not null default '[]' check (jsonb_typeof(account_ids) = 'array' and jsonb_array_length(account_ids) <= 100),
  status text not null check (status in ('queued','leased','retry','processed','held','ignored')),
  attempts integer not null default 0,
  leased_until timestamptz,
  created_at timestamptz not null default now(),
  primary key(environment,event_id)
);
create index wd_billing_events_pending on public.wd_billing_events(status,created_at);
alter table public.wd_billing_bindings enable row level security;
alter table public.wd_billing_states enable row level security;
alter table public.wd_billing_transactions enable row level security;
alter table public.wd_billing_events enable row level security;
revoke all on public.wd_billing_bindings,public.wd_billing_states,public.wd_billing_transactions,public.wd_billing_events from public,anon,authenticated;
grant select,insert,update,delete on public.wd_billing_bindings,public.wd_billing_states,public.wd_billing_transactions,public.wd_billing_events to service_role;
create function public.wd_billing_command(p_action text,p_body jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid; a public.wd_accounts%rowtype; b public.wd_billing_bindings%rowtype; s public.wd_billing_states%rowtype;
  e public.wd_billing_events%rowtype; env text; result jsonb; ids jsonb; next_state jsonb; owner_id uuid;
  minute_now bigint := floor(extract(epoch from now())/60)::bigint;
begin
  if auth.role() is distinct from 'service_role' or p_body is null or jsonb_typeof(p_body) <> 'object' or octet_length(p_body::text) > 65536 then return '{"error":"invalid_command"}'; end if;
  if p_action = 'enqueue' then
    env := p_body->>'environment';
    if env not in ('PRODUCTION','SANDBOX','UNKNOWN') or jsonb_typeof(p_body->'appUserIds') <> 'array' or jsonb_array_length(p_body->'appUserIds') > 100 then return '{"error":"invalid_command"}'; end if;
    select coalesce(jsonb_agg(user_id),'[]'::jsonb) into ids from public.wd_billing_bindings where app_user_id in (select jsonb_array_elements_text(p_body->'appUserIds'));
    insert into public.wd_billing_events(environment,event_id,fingerprint,event_type,event_timestamp_ms,account_ids,status)
      values(env,p_body->>'id',p_body->>'fingerprint',p_body->>'type',(p_body->>'timestamp')::bigint,ids,
        case when jsonb_array_length(ids)=0 then 'ignored' when coalesce((p_body->>'identityHold')::boolean,false) or env='UNKNOWN' then 'held' else 'queued' end)
      on conflict do nothing;
    select * into e from public.wd_billing_events where environment=env and event_id=p_body->>'id';
    if e.fingerprint <> p_body->>'fingerprint' then return '{"error":"idempotency_conflict"}'; end if;
    -- Holds apply durably at receipt, not after a delayed worker. Never grant through an alias/transfer.
    if e.status='held' then
      if env='UNKNOWN' then update public.wd_billing_bindings set held=true where user_id in (select x::uuid from jsonb_array_elements_text(ids) x);
      else
        insert into public.wd_billing_states(user_id,environment,held) select x::uuid,env,true from jsonb_array_elements_text(ids) x on conflict(user_id,environment) do update set held=true;
      end if;
    end if;
    return jsonb_build_object('status',e.status);
  elsif p_action='claim_events' then
    env := p_body->>'environment';
    if env not in ('PRODUCTION','SANDBOX') or (p_body->>'limit')::integer not between 1 and 5 then return '{"error":"invalid_command"}'; end if;
    with selected as (select environment,event_id from public.wd_billing_events where environment=env and (status in ('queued','retry') or (status='leased' and leased_until < now())) and attempts<10 order by created_at limit (p_body->>'limit')::integer for update skip locked),
      claimed as (update public.wd_billing_events ev set status='leased',attempts=attempts+1,leased_until=now()+interval '60 seconds' from selected q where ev.environment=q.environment and ev.event_id=q.event_id returning ev.*)
    select coalesce(jsonb_agg(jsonb_build_object('id',event_id,'environment',environment,'accountIds',account_ids,'attempt',attempts)),'[]'::jsonb) into result from claimed;
    return jsonb_build_object('events',result);
  elsif p_action='finish_event' then
    if p_body->>'status' not in ('processed','retry','held') then return '{"error":"invalid_command"}'; end if;
    update public.wd_billing_events set status=case when p_body->>'status'='retry' and attempts>=10 then 'held' else p_body->>'status' end,leased_until=null where environment=p_body->>'environment' and event_id=p_body->>'id' and status='leased' and attempts=(p_body->>'attempt')::integer;
    return '{"ok":true}';
  end if;
  if p_action not in ('bind','begin','commit') then return '{"error":"invalid_command"}'; end if;
  u := (p_body->>'userId')::uuid;
  -- Explicit ownership target supplied ONLY by server verified-session/claimed-event code.
  select * into a from public.wd_accounts where user_id=u for update;
  if not found or a.state <> 'active' then return '{"error":"account_inactive"}'; end if;
  insert into public.wd_billing_bindings(user_id) values(u) on conflict do nothing;
  select * into b from public.wd_billing_bindings where user_id=u for update;
  if p_action='bind' then return jsonb_build_object('appUserId',b.app_user_id,'held',b.held); end if;
  env := p_body->>'environment';
  if env not in ('PRODUCTION','SANDBOX') then return '{"error":"invalid_command"}'; end if;
  insert into public.wd_billing_states(user_id,environment) values(u,env) on conflict do nothing;
  select * into s from public.wd_billing_states where user_id=u and environment=env for update;
  if p_action='begin' then
    if s.request_minute=minute_now and s.requests >=30 then return '{"error":"rate_limited"}'; end if;
    update public.wd_billing_states set generation=generation+1,request_minute=minute_now,requests=case when request_minute=minute_now then requests+1 else 1 end where user_id=u and environment=env returning * into s;
    return jsonb_build_object('generation',s.generation,'binding',jsonb_build_object('appUserId',b.app_user_id,'held',b.held or s.held),'cached',s.state);
  end if;
  if b.held or s.held then return '{"state":"unknown","expiresAt":null,"observedAt":0,"reason":"identity_review_required"}'; end if;
  if s.generation <> (p_body->>'generation')::bigint then return s.state; end if;
  next_state := p_body->'state';
  if coalesce(jsonb_typeof(next_state) <> 'object' or not (next_state ?& array['state','expiresAt','observedAt','reason'])
    or next_state->>'state' not in ('trial','active','expired','revoked','inactive','unknown')
    or jsonb_typeof(next_state->'observedAt') <> 'number' or (next_state->>'observedAt')::bigint < 0
    or length(next_state->>'reason') not between 1 and 64,true) then return '{"error":"invalid_command"}'; end if;
  if next_state->>'state' in ('trial','active') and coalesce(jsonb_typeof(next_state->'expiresAt') <> 'number' or (next_state->>'expiresAt')::bigint <= extract(epoch from now())*1000 or (next_state->>'transactionHash') !~ '^[0-9a-f]{64}$',true) then return '{"error":"invalid_command"}'; end if;
  if (next_state->>'observedAt')::bigint < (s.state->>'observedAt')::bigint then return s.state; end if;
  if next_state->>'transactionHash' is not null then
    insert into public.wd_billing_transactions(environment,transaction_hash,user_id) values(env,next_state->>'transactionHash',u) on conflict do nothing;
    select user_id into owner_id from public.wd_billing_transactions where environment=env and transaction_hash=next_state->>'transactionHash';
    if owner_id <> u then
      update public.wd_billing_states set held=true where user_id in (u,owner_id) and environment=env;
      next_state := jsonb_build_object('state','unknown','expiresAt',null,'observedAt',next_state->'observedAt','reason','transaction_owner_review_required');
    end if;
  end if;
  update public.wd_billing_states set state=next_state where user_id=u and environment=env;
  return next_state;
exception when invalid_text_representation or check_violation or not_null_violation or numeric_value_out_of_range then return '{"error":"invalid_command"}';
end $$;
revoke all on function public.wd_billing_command(text,jsonb) from public,anon,authenticated;
grant execute on function public.wd_billing_command(text,jsonb) to service_role;
commit;
