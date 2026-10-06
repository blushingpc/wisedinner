-- UNAPPLIED. Internal prerequisite only; no authentic provider/store proof adapter is bound.
-- 0006/0007 are prerequisites; account deletion continues to use the existing active-state fence.
begin;
create table public.wd_restore_intents (
  operation uuid primary key, target uuid not null references public.wd_accounts(user_id),
  environment text not null check (environment in ('PRODUCTION','SANDBOX')),
  app text not null, product text not null, entitlement text not null,
  target_binding text not null, created_ms bigint not null, expires_ms bigint not null,
  status text not null default 'pending' check (status in ('pending','leased','held','prepared','completed')),
  reason text not null default 'explicit_intent', attempt integer not null default 0,
  lease uuid, lease_until_ms bigint, target_generation bigint, source_generation bigint, lineage_generation bigint,
  proof jsonb
);
create table public.wd_restore_lineages (
  environment text not null, root_hash text not null check (root_hash ~ '^[0-9a-f]{64}$'),
  app text not null, product text not null, entitlement text not null,
  original_purchase_ms bigint not null, owner_id uuid not null references public.wd_accounts(user_id),
  generation bigint not null default 0, observed_ms bigint not null,
  primary key(environment,root_hash)
);
create table public.wd_restore_aliases (
  environment text not null, transaction_hash text not null check (transaction_hash ~ '^[0-9a-f]{64}$'),
  root_hash text not null, primary key(environment,transaction_hash),
  foreign key(environment,root_hash) references public.wd_restore_lineages(environment,root_hash)
);
create table public.wd_restore_fences (
  user_id uuid not null references public.wd_accounts(user_id), environment text not null,
  primary key(user_id,environment)
);
alter table public.wd_restore_intents enable row level security;
alter table public.wd_restore_lineages enable row level security;
alter table public.wd_restore_aliases enable row level security;
alter table public.wd_restore_fences enable row level security;
revoke all on public.wd_restore_intents,public.wd_restore_lineages,public.wd_restore_aliases,public.wd_restore_fences from public,anon,authenticated,service_role;

-- Legacy callers remain unchanged. Participants cannot grant from an unverified renewal alias.
-- Holds and unrelated ownership are retained. Unknown aliases require new private proof, not a fallback.
create function public.wd_restore_state_fence() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.state->>'state' in ('active','trial') and exists(select 1 from public.wd_restore_fences where user_id=new.user_id and environment=new.environment) then
    if not exists(select 1 from public.wd_restore_aliases x join public.wd_restore_lineages l using(environment,root_hash)
      join public.wd_accounts a on a.user_id=l.owner_id
      where x.environment=new.environment and x.transaction_hash=new.state->>'transactionHash' and l.owner_id=new.user_id and a.state='active') then
      raise check_violation using message='restore_lineage_review_required';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.wd_restore_state_fence() from public,anon,authenticated,service_role;
create trigger wd_restore_state_fence before insert or update of state on public.wd_billing_states
  for each row execute function public.wd_restore_state_fence();

create function public.wd_restore_hold(op uuid, why text) returns jsonb
language sql security definer set search_path='' as $$
  with held as (update public.wd_restore_intents set status='held',reason=why,lease_until_ms=null where operation=op and status<>'completed' returning operation)
  select jsonb_build_object('status','held','reason',why);
$$;
revoke all on function public.wd_restore_hold(uuid,text) from public,anon,authenticated,service_role;

create function public.wd_restore_command(p_action text,p_body jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  i public.wd_restore_intents%rowtype; l public.wd_restore_lineages%rowtype;
  source_id uuid; source_state public.wd_billing_states%rowtype; target_state public.wd_billing_states%rowtype;
  op uuid; t uuid; p jsonb; n bigint:=floor(extract(epoch from clock_timestamp())*1000)::bigint; k text;
begin
  if auth.role() is distinct from 'service_role' or coalesce(jsonb_typeof(p_body)<>'object',true) or octet_length(p_body::text)>8192
    or coalesce(p_action not in ('intent','read','claim','hold','prepare','commit'),true) then return '{"error":"invalid_command"}'; end if;
  if exists(select 1 from jsonb_object_keys(p_body) x where x not in ('operation','target','environment','app','product','entitlement','lease','attempt','reason','proof')) then return '{"error":"invalid_command"}'; end if;
  if exists(select 1 from jsonb_object_keys(p_body) x where x<> 'operation' and not (
    (p_action='intent' and x in ('target','environment','app','product','entitlement')) or
    (p_action='claim' and x='lease') or
    (p_action in ('hold','prepare','commit') and x in ('lease','attempt')) or
    (p_action='hold' and x='reason') or (p_action='prepare' and x='proof'))) then return '{"error":"invalid_command"}'; end if;
  op:=(p_body->>'operation')::uuid;
  if op is null then return '{"error":"invalid_command"}'; end if;
  -- Serialize internal restores only; legacy paths take account locks first and never this lock.
  perform pg_advisory_xact_lock(7140014);
  n:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
  if p_action='intent' then
    t:=(p_body->>'target')::uuid;
    perform 1 from public.wd_accounts where user_id=t and state='active' for update;
    if not found then return '{"error":"account_inactive"}'; end if;
    if coalesce(p_body->>'environment' not in ('PRODUCTION','SANDBOX') or p_body->>'app' !~ '^[A-Za-z0-9._-]{1,128}$'
      or p_body->>'product' !~ '^[A-Za-z0-9._-]{1,128}$' or p_body->>'entitlement' !~ '^[A-Za-z0-9._-]{1,128}$',true) then return '{"error":"invalid_command"}'; end if;
    foreach k in array array['environment','app','product','entitlement'] loop
      if coalesce(jsonb_typeof(p_body->k)<>'string',true) then return '{"error":"invalid_command"}'; end if;
    end loop;
    if not exists(select 1 from public.wd_billing_bindings where user_id=t) then return '{"error":"binding_required"}'; end if;
    insert into public.wd_restore_intents(operation,target,environment,app,product,entitlement,target_binding,created_ms,expires_ms)
      select op,t,p_body->>'environment',p_body->>'app',p_body->>'product',p_body->>'entitlement',app_user_id,n,n+300000 from public.wd_billing_bindings where user_id=t on conflict do nothing;
  end if;
  select * into i from public.wd_restore_intents where operation=op for update;
  if not found then return '{"error":"intent_required"}'; end if;
  if p_action='intent' and (i.target<>t or i.environment<>p_body->>'environment' or i.app<>p_body->>'app' or i.product<>p_body->>'product' or i.entitlement<>p_body->>'entitlement') then return '{"error":"idempotency_conflict"}'; end if;
  if not exists(select 1 from public.wd_accounts where user_id=i.target and state='active') then return '{"error":"account_inactive"}'; end if;
  if p_action in ('intent','read') then
    return jsonb_build_object('operation',i.operation,'targetBinding',i.target_binding,'environment',i.environment,'app',i.app,'product',i.product,'entitlement',i.entitlement,'createdAt',i.created_ms,'expiresAt',i.expires_ms,'status',i.status,'reason',i.reason,'attempt',i.attempt);
  end if;
  if i.status='completed' then return '{"status":"completed"}'; end if;
  if n>i.expires_ms then update public.wd_restore_intents set status='held',reason='intent_expired' where operation=op; return '{"status":"held","reason":"intent_expired"}'; end if;
  if p_action='claim' then
    if i.lease_until_ms>=n or i.attempt>=5 or p_body->>'lease' is null then return '{"status":"held","reason":"lease_unavailable"}'; end if;
    perform 1 from public.wd_accounts where user_id=i.target and state='active' for update;
    if not found then return '{"error":"account_inactive"}'; end if;
    insert into public.wd_billing_states(user_id,environment) values(i.target,i.environment) on conflict do nothing;
    update public.wd_restore_intents set status='leased',lease=(p_body->>'lease')::uuid,lease_until_ms=n+60000,attempt=attempt+1,
      target_generation=(select generation from public.wd_billing_states where user_id=i.target and environment=i.environment) where operation=op returning * into i;
    return jsonb_build_object('status','leased','attempt',i.attempt);
  end if;
  if coalesce(i.lease is distinct from (p_body->>'lease')::uuid or p_body->>'attempt' !~ '^[1-5]$' or i.attempt<>(p_body->>'attempt')::integer or i.lease_until_ms<n,true) then return '{"status":"held","reason":"stale_lease"}'; end if;
  if p_action='hold' then
    if p_body->>'reason' not in ('proof_unavailable','proof_invalid','outcome_unknown','reconciliation_required') then return '{"error":"invalid_command"}'; end if;
    update public.wd_restore_intents set status='held',reason=p_body->>'reason',lease_until_ms=null where operation=op;
    return jsonb_build_object('status','held','reason',p_body->>'reason');
  end if;
  p:=case when p_action='commit' then i.proof else p_body->'proof' end;
  if coalesce(jsonb_typeof(p)<>'object',true) or not(p ?& array['operation','sourceBinding','targetBinding','environment','app','store','product','entitlement','sourceRoot','targetRoot','sourceTransaction','targetTransaction','originalPurchaseAt','observedAt','expiresAt','ownership','sourceRevoked','state','refunded'])
    or exists(select 1 from jsonb_object_keys(p) x where x not in ('operation','sourceBinding','targetBinding','environment','app','store','product','entitlement','sourceRoot','targetRoot','sourceTransaction','targetTransaction','originalPurchaseAt','observedAt','expiresAt','ownership','sourceRevoked','state','refunded')) then return public.wd_restore_hold(op,'proof_invalid'); end if;
  if coalesce(p->>'operation'<>op::text or p->>'targetBinding'<>i.target_binding or p->>'environment'<>i.environment or p->>'app'<>i.app or p->>'store'<>'app_store' or p->>'product'<>i.product or p->>'entitlement'<>i.entitlement
    or p->>'sourceRoot'<>p->>'targetRoot' or p->>'ownership'<>'PURCHASED' or p->>'state' not in ('active','trial') or p->'refunded'<>'false'::jsonb or jsonb_typeof(p->'sourceRevoked')<>'boolean',true) then return public.wd_restore_hold(op,'proof_invalid'); end if;
  foreach k in array array['operation','sourceBinding','targetBinding','environment','app','store','product','entitlement','sourceRoot','targetRoot','sourceTransaction','targetTransaction','ownership','state'] loop
    if coalesce(jsonb_typeof(p->k)<>'string',true) or length(p->>k)>128 then return public.wd_restore_hold(op,'proof_invalid'); end if;
  end loop;
  foreach k in array array['sourceRoot','targetRoot','sourceTransaction','targetTransaction'] loop
    if coalesce(p->>k !~ '^[0-9a-f]{64}$',true) then return public.wd_restore_hold(op,'proof_invalid'); end if;
  end loop;
  foreach k in array array['originalPurchaseAt','observedAt','expiresAt'] loop
    if coalesce(jsonb_typeof(p->k)<>'number' or p->>k !~ '^[0-9]{1,16}$',true) or (p->>k)::numeric>9007199254740991 then return public.wd_restore_hold(op,'proof_invalid'); end if;
  end loop;
  if (p->>'observedAt')::bigint>n or n-(p->>'observedAt')::bigint>300000 or (p->>'observedAt')::bigint<i.created_ms
    or (p->>'originalPurchaseAt')::bigint>(p->>'observedAt')::bigint or (p->>'expiresAt')::bigint<=n
    or (i.proof is not null and (i.proof->>'observedAt')::bigint>(p->>'observedAt')::bigint) then return public.wd_restore_hold(op,'proof_invalid'); end if;
  select user_id into source_id from public.wd_billing_bindings where app_user_id=p->>'sourceBinding';
  if source_id is null or (source_id<>i.target and p->'sourceRevoked'<>'true'::jsonb) then return public.wd_restore_hold(op,'proof_invalid'); end if;
  perform 1 from public.wd_accounts where user_id in (source_id,i.target) order by user_id for update;
  -- Recheck time AFTER possible account-lock waits; an entry-time clock cannot authorize a late commit.
  n:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
  if n>i.expires_ms or n>i.lease_until_ms or n-(p->>'observedAt')::bigint>300000 or (p->>'expiresAt')::bigint<=n then return public.wd_restore_hold(op,'proof_invalid'); end if;
  if exists(select 1 from public.wd_accounts where user_id in (source_id,i.target) and state<>'active') then return public.wd_restore_hold(op,'account_inactive'); end if;
  select * into source_state from public.wd_billing_states where user_id=source_id and environment=i.environment for update;
  select * into target_state from public.wd_billing_states where user_id=i.target and environment=i.environment for update;
  if source_state.user_id is null or target_state.user_id is null or target_state.generation<>i.target_generation
    or (source_state.state->>'observedAt')::bigint>(p->>'observedAt')::bigint or (target_state.state->>'observedAt')::bigint>(p->>'observedAt')::bigint
    or not exists(select 1 from public.wd_billing_transactions where environment=i.environment and transaction_hash=p->>'sourceTransaction' and user_id=source_id)
    or (source_state.state->>'state' in ('active','trial') and source_state.state->>'transactionHash' is distinct from p->>'sourceTransaction')
    or (source_id<>i.target and target_state.state->>'state' in ('active','trial') and target_state.state->>'transactionHash' is distinct from p->>'targetTransaction')
    or exists(select 1 from public.wd_billing_transactions where environment=i.environment and transaction_hash=p->>'targetTransaction' and user_id not in (source_id,i.target)) then return public.wd_restore_hold(op,'ownership_or_generation_conflict'); end if;
  select * into l from public.wd_restore_lineages where environment=i.environment and root_hash=p->>'sourceRoot' for update;
  if found and (l.owner_id<>source_id or l.app<>i.app or l.product<>i.product or l.entitlement<>i.entitlement or l.original_purchase_ms<>(p->>'originalPurchaseAt')::bigint or l.observed_ms>(p->>'observedAt')::bigint) then return public.wd_restore_hold(op,'lineage_conflict'); end if;
  if exists(select 1 from public.wd_restore_aliases where environment=i.environment and transaction_hash in (p->>'sourceTransaction',p->>'targetTransaction') and root_hash<>p->>'sourceRoot') then return public.wd_restore_hold(op,'lineage_conflict'); end if;
  if p_action='prepare' then
    if i.proof is not null and (i.proof->>'sourceBinding'<>p->>'sourceBinding' or i.proof->>'sourceRoot'<>p->>'sourceRoot' or i.proof->>'originalPurchaseAt'<>p->>'originalPurchaseAt') then return public.wd_restore_hold(op,'lineage_conflict'); end if;
    update public.wd_restore_intents set proof=p,status='prepared',source_generation=source_state.generation,lineage_generation=coalesce(l.generation,0) where operation=op;
    return '{"status":"prepared"}';
  end if;
  if i.status<>'prepared' or source_state.generation<>i.source_generation or coalesce(l.generation,0)<>i.lineage_generation then return public.wd_restore_hold(op,'stale_generation'); end if;
  insert into public.wd_restore_lineages(environment,root_hash,app,product,entitlement,original_purchase_ms,owner_id,observed_ms)
    values(i.environment,p->>'sourceRoot',i.app,i.product,i.entitlement,(p->>'originalPurchaseAt')::bigint,source_id,(p->>'observedAt')::bigint) on conflict do nothing;
  insert into public.wd_restore_aliases(environment,transaction_hash,root_hash) values(i.environment,p->>'sourceTransaction',p->>'sourceRoot'),(i.environment,p->>'targetTransaction',p->>'sourceRoot') on conflict do nothing;
  insert into public.wd_restore_fences(user_id,environment) values(source_id,i.environment),(i.target,i.environment) on conflict do nothing;
  update public.wd_restore_lineages set owner_id=i.target,generation=generation+1,observed_ms=(p->>'observedAt')::bigint where environment=i.environment and root_hash=p->>'sourceRoot';
  -- Only proven aliases move; all other transactions, environments and held flags remain unchanged.
  update public.wd_billing_transactions set user_id=i.target where environment=i.environment and transaction_hash in (p->>'sourceTransaction',p->>'targetTransaction');
  insert into public.wd_billing_transactions(environment,transaction_hash,user_id) values(i.environment,p->>'targetTransaction',i.target) on conflict do nothing;
  if source_id<>i.target then update public.wd_billing_states set generation=generation+1,state=jsonb_build_object('state','revoked','expiresAt',null,'observedAt',p->'observedAt','reason','explicit_restore_reconciled') where user_id=source_id and environment=i.environment; end if;
  update public.wd_billing_states set generation=generation+1,state=jsonb_build_object('state',p->>'state','expiresAt',p->'expiresAt','observedAt',p->'observedAt','transactionHash',p->>'targetTransaction','reason','explicit_restore_verified') where user_id=i.target and environment=i.environment;
  update public.wd_restore_intents set status='completed',reason='explicit_restore_verified',lease_until_ms=null where operation=op;
  return '{"status":"completed"}';
exception when invalid_text_representation or check_violation or not_null_violation or numeric_value_out_of_range then return '{"error":"invalid_command"}';
end $$;
revoke all on function public.wd_restore_command(text,jsonb) from public,anon,authenticated;
grant execute on function public.wd_restore_command(text,jsonb) to service_role;
commit;
