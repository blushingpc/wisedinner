-- Additive backend-only deletion progress. UNAPPLIED; no provider call, schedule or retention rule.
begin;
create table public.wd_deletion_work (
 user_id uuid primary key references public.wd_accounts(user_id),
 owner uuid, attempt integer not null default 0, lease_until timestamptz,
 identity_hash text check(identity_hash ~ '^[a-f0-9]{64}$'), identity_evidence text check(identity_evidence ~ '^[a-f0-9]{64}$'),
 apple_linkage text not null default 'unknown' check(apple_linkage in ('unknown','linked','none')),
 apple_state text not null default 'pending' check(apple_state in ('pending','started','held','done','not_required')),
 auth_state text not null default 'pending' check(auth_state in ('pending','started','held','done')),
 apple_operation uuid not null default gen_random_uuid(), auth_operation uuid not null default gen_random_uuid(),
 apple_evidence text check(apple_evidence ~ '^[a-f0-9]{64}$'), auth_evidence text check(auth_evidence ~ '^[a-f0-9]{64}$'),
 complete boolean not null default false
);
alter table public.wd_deletion_work enable row level security;
revoke all on public.wd_deletion_work from public,anon,authenticated,service_role;
grant select on public.wd_deletion_work to service_role;
create function public.wd_deletion_command(p_action text,p_body jsonb)returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid; claim_owner uuid; a public.wd_accounts%rowtype; w public.wd_deletion_work%rowtype; dep text; st text; op uuid; ev text; outcome text;
begin
 if auth.role() is distinct from 'service_role' then raise insufficient_privilege;end if;
 if p_action is null or p_action not in ('claim','identity','cleanup','begin','proof','complete','release')
  or p_body is null or jsonb_typeof(p_body) is distinct from 'object' or octet_length(p_body::text)>4096
  or jsonb_typeof(p_body->'userId') is distinct from 'string' or jsonb_typeof(p_body->'owner') is distinct from 'string' then return '{"error":"invalid_command"}';end if;
 u:=(p_body->>'userId')::uuid;claim_owner:=(p_body->>'owner')::uuid;
 -- One exact tombstone, same lock order as account/billing. No batch or broad account scan.
 select * into a from public.wd_accounts where user_id=u for update;
 if not found or a.state='active' then return '{"error":"account_inactive"}';end if;
 if p_action='claim' then
  if p_body-array['userId','owner']<>'{}' then return '{"error":"invalid_command"}';end if;
  select * into w from public.wd_deletion_work where user_id=u for update;
  if a.state='deleted' then
   if not found or not w.complete then return '{"error":"account_inactive"}';end if;
   return jsonb_build_object('work',to_jsonb(w),'state','deleted');
  end if;
  insert into public.wd_deletion_work(user_id)values(u)on conflict do nothing;
  select * into w from public.wd_deletion_work where user_id=u for update;
  if w.lease_until>now() then return '{"error":"claim_busy"}';end if;
  update public.wd_deletion_work set owner=(p_body->>'owner')::uuid,attempt=attempt+1,lease_until=now()+interval '5 minutes',
   apple_state=case when apple_state='started' then 'held' else apple_state end,
   auth_state=case when auth_state='started' then 'held' else auth_state end where user_id=u returning * into w;
 else
  if p_body->>'attempt' is null or jsonb_typeof(p_body->'attempt') is distinct from 'number' then return '{"error":"invalid_command"}';end if;
  select * into w from public.wd_deletion_work where user_id=u for update;
  if not found or a.state<>'deletion_pending' or w.complete or w.owner is distinct from (p_body->>'owner')::uuid
   or w.attempt is distinct from (p_body->>'attempt')::integer or w.lease_until is null or w.lease_until<=now() then return '{"error":"stale_claim"}';end if;
  if p_action='identity' then
   if p_body-array['userId','owner','attempt','identityHash','evidenceHash','apple']<>'{}'
    or jsonb_typeof(p_body->'identityHash') is distinct from 'string' or (p_body->>'identityHash')!~'^[a-f0-9]{64}$'
    or jsonb_typeof(p_body->'evidenceHash') is distinct from 'string' or (p_body->>'evidenceHash')!~'^[a-f0-9]{64}$'
    or jsonb_typeof(p_body->'apple') is distinct from 'string' or p_body->>'apple' not in ('linked','none','unknown') then return '{"error":"invalid_command"}';end if;
   if w.identity_hash is not null and (w.identity_hash<>p_body->>'identityHash' or (w.apple_linkage<>'unknown' and (w.apple_linkage<>p_body->>'apple' or w.identity_evidence<>p_body->>'evidenceHash'))) then return '{"error":"identity_conflict"}';end if;
   update public.wd_deletion_work set identity_hash=p_body->>'identityHash',identity_evidence=p_body->>'evidenceHash',apple_linkage=p_body->>'apple',
    apple_state=case when p_body->>'apple'='none' then 'not_required' else apple_state end where user_id=u returning * into w;
  elsif p_action in ('begin','proof') then
   dep:=p_body->>'dependency';
   if dep is null or dep not in ('apple','auth') or w.identity_hash is null or w.apple_linkage='unknown' then return '{"error":"invalid_progress"}';end if;
   st:=case when dep='apple' then w.apple_state else w.auth_state end;
   op:=case when dep='apple' then w.apple_operation else w.auth_operation end;
   ev:=case when dep='apple' then w.apple_evidence else w.auth_evidence end;
   if dep='auth' and w.apple_state not in ('done','not_required') then return '{"error":"invalid_progress"}';end if;
   if dep='apple' and w.apple_linkage<>'linked' then return '{"error":"invalid_progress"}';end if;
   if p_action='begin' then
    if p_body-array['userId','owner','attempt','dependency']<>'{}' or st<>'pending' then return '{"error":"invalid_progress"}';end if;
    if dep='apple' then update public.wd_deletion_work set apple_state='started' where user_id=u;
    else update public.wd_deletion_work set auth_state='started' where user_id=u;end if;
   else
    outcome:=p_body->>'outcome';
    if p_body-array['userId','owner','attempt','dependency','operationId','identityHash','evidenceHash','outcome']<>'{}'
     or p_body->>'operationId' is distinct from op::text or p_body->>'identityHash' is distinct from w.identity_hash
     or jsonb_typeof(p_body->'evidenceHash') is distinct from 'string' or (p_body->>'evidenceHash')!~'^[a-f0-9]{64}$'
     or outcome is null or outcome not in ('confirmed','already_absent','not_started','unknown') or (outcome='already_absent' and dep<>'auth') then return '{"error":"invalid_progress"}';end if;
    if st='done' then
     if outcome not in ('confirmed','already_absent') or ev is distinct from p_body->>'evidenceHash' then return '{"error":"identity_conflict"}';end if;
    elsif st not in ('started','held') then return '{"error":"invalid_progress"}';
    else
     st:=case when outcome in ('confirmed','already_absent') then 'done' when outcome='not_started' then 'pending' else 'held' end;
     if dep='apple' then update public.wd_deletion_work set apple_state=st,apple_evidence=p_body->>'evidenceHash' where user_id=u;
     else update public.wd_deletion_work set auth_state=st,auth_evidence=p_body->>'evidenceHash' where user_id=u;end if;
    end if;
   end if;
   select * into w from public.wd_deletion_work where user_id=u;
  else
   if p_body-array['userId','owner','attempt']<>'{}' then return '{"error":"invalid_command"}';end if;
   if p_action in ('cleanup','complete') then
    -- Existing 0006/0009 remove owned data at initiation; verify, do not recreate their cleanup.
    if a.preferences<>'{}'::jsonb or exists(select 1 from public.wd_saved_weeks where user_id=u)
     or exists(select 1 from public.wd_push_tokens where user_id=u) or exists(select 1 from public.wd_push_receipts where user_id=u)
     or exists(select 1 from public.wd_push_jobs where user_id=u) then return '{"error":"cleanup_pending"}';end if;
    if p_action='complete' then
     if w.identity_hash is null or w.apple_linkage='unknown' or w.apple_state not in ('done','not_required') or w.auth_state<>'done' then return '{"error":"invalid_progress"}';end if;
     update public.wd_accounts set state='deleted',updated_at=now() where user_id=u;
     update public.wd_deletion_work set complete=true,owner=null,lease_until=null where user_id=u returning * into w;
    end if;
   elsif p_action='release' then
    update public.wd_deletion_work set owner=null,lease_until=null,
     apple_state=case when apple_state='started' then 'held' else apple_state end,
     auth_state=case when auth_state='started' then 'held' else auth_state end where user_id=u returning * into w;
   end if;
  end if;
 end if;
 update public.wd_accounts set deletion_dependencies=jsonb_build_object(
  'authDeletion',case when w.auth_state='done' then 'complete' when w.auth_state in ('started','held') then 'review_required' else 'pending' end,
  'sessionInvalidation',case when w.auth_state='done' then 'complete' else 'pending' end,
  'appleRevocation',case when w.apple_linkage='unknown' then 'needs_provider_check' when w.apple_state='not_required' then 'not_required' when w.apple_state='done' then 'complete' when w.apple_state in ('started','held') then 'review_required' else 'pending' end,
  'subscriptionCancellation','not_performed') where user_id=u;
 return jsonb_build_object('work',to_jsonb(w),'state',case when w.complete then 'deleted' else 'deletion_pending' end);
exception when invalid_text_representation or check_violation or not_null_violation or numeric_value_out_of_range then return '{"error":"invalid_command"}';
end $$;
revoke all on function public.wd_deletion_command(text,jsonb)from public,anon,authenticated;
grant execute on function public.wd_deletion_command(text,jsonb)to service_role;
commit;
