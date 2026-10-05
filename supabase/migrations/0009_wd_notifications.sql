-- Prepared, unapplied, backend-owned private push storage. No schedule or dispatch activation.
create table public.wd_push_projects(project_id uuid not null,environment text not null check(environment in ('production','development')),enabled boolean not null default false,primary key(project_id,environment));
alter table public.wd_push_projects enable row level security;
revoke all on public.wd_push_projects from public,anon,authenticated;
grant select,insert,update on public.wd_push_projects to service_role;
create table public.wd_push_tokens(
 user_id uuid not null references public.wd_accounts(user_id),device_id uuid not null,
 project_id uuid not null,environment text not null check(environment in ('production','development')),
 token text not null check(length(token) between 20 and 200),revision int not null check(revision>0),
 token_hash text not null,enabled boolean not null default true,updated_at timestamptz not null default now(),
 primary key(user_id,device_id),unique(project_id,environment,token_hash)
);
create table public.wd_push_receipts(user_id uuid not null references public.wd_accounts(user_id),id uuid not null,fingerprint text not null,result jsonb not null,created_at timestamptz not null default now(),primary key(user_id,id));
create index wd_push_receipts_time on public.wd_push_receipts(user_id,created_at);
create table public.wd_push_jobs(id uuid primary key,user_id uuid not null references public.wd_accounts(user_id),device_id uuid not null,project_id uuid not null,environment text not null check(environment in ('production','development')),body text not null check(octet_length(body)<=1000),state text not null default 'pending' check(state in ('pending','claimed','ticket','complete','retry','uncertain','held')),ticket_id text,attempts int not null default 0,created_at timestamptz not null default now());
alter table public.wd_push_tokens enable row level security;
alter table public.wd_push_receipts enable row level security;
alter table public.wd_push_jobs enable row level security;
revoke all on public.wd_push_tokens,public.wd_push_receipts,public.wd_push_jobs from public,anon,authenticated;
grant select,insert,update,delete on public.wd_push_tokens,public.wd_push_receipts,public.wd_push_jobs to service_role;
create function public.wd_push_command(p_action text,p_body jsonb,p_key uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();a public.wd_accounts%rowtype;t public.wd_push_tokens%rowtype;r public.wd_push_receipts%rowtype;d uuid;fingerprint text;result jsonb;n int;
begin
 if u is null or auth.role() is distinct from 'authenticated' or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then return '{"error":"invalid_session"}';end if;
 if p_action is null or p_action not in ('register','revoke','revoke_all') or p_key is null or p_body is null or jsonb_typeof(p_body)<>'object' or octet_length(p_body::text)>4096 then return '{"error":"invalid_command"}';end if;
 select * into a from public.wd_accounts where user_id=u for update;if not found or a.state<>'active' then return '{"error":"account_inactive"}';end if;
 fingerprint:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(jsonb_build_object('action',p_action,'body',p_body)::text,'UTF8')),'hex');
 select * into r from public.wd_push_receipts where user_id=u and id=p_key;
 if found then if r.fingerprint<>fingerprint then return '{"error":"idempotency_conflict"}';end if;return r.result;end if;
 select count(*) into n from public.wd_push_receipts where user_id=u and created_at>now()-interval '1 minute';if n>=30 then return '{"error":"rate_limited"}';end if;
 if p_action='revoke_all' then
  if p_body<>'{}' then return '{"error":"invalid_command"}';end if;
  update public.wd_push_tokens set enabled=false,revision=revision+1,updated_at=now() where user_id=u;
  update public.wd_push_jobs set state='held' where user_id=u and state not in ('complete','uncertain');result:='{"revoked":true}';
 else
  if (p_body->>'deviceId') is null or (p_body->>'deviceId')!~'^[a-fA-F0-9-]{36}$' then return '{"error":"invalid_command"}';end if;d:=(p_body->>'deviceId')::uuid;
  select * into t from public.wd_push_tokens where user_id=u and device_id=d;
  if p_action='revoke' then
   if p_body- 'deviceId'<>'{}' then return '{"error":"invalid_command"}';end if;
   update public.wd_push_tokens set enabled=false,revision=revision+1,updated_at=now() where user_id=u and device_id=d;
   update public.wd_push_jobs set state='held' where user_id=u and device_id=d and state not in ('complete','uncertain');result:='{"revoked":true}';
  else
   if p_body-array['deviceId','projectId','environment','token','revision']<>'{}' or (p_body->>'projectId') is null or (p_body->>'projectId')!~'^[a-fA-F0-9-]{36}$' or (p_body->>'environment') is null or (p_body->>'environment') not in ('production','development') or jsonb_typeof(p_body->'revision') is distinct from 'number' or (p_body->>'revision')!~'^[0-9]+$' or (p_body->>'token') is null or (p_body->>'token')!~'^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]{16,128}\]$' then return '{"error":"invalid_command"}';end if;
   if a.preferences->>'notifications' is distinct from 'true' then return '{"error":"notifications_disabled"}';end if;
   if not exists(select 1 from public.wd_push_projects where project_id=(p_body->>'projectId')::uuid and environment=p_body->>'environment' and enabled) then return '{"error":"project_not_configured"}';end if;
   if coalesce(t.revision,0)<>(p_body->>'revision')::int then return '{"error":"revision_conflict"}';end if;
   if exists(select 1 from public.wd_push_tokens where project_id=(p_body->>'projectId')::uuid and environment=p_body->>'environment' and token_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_body->>'token','UTF8')),'hex') and (user_id<>u or device_id<>d)) then return '{"error":"token_owned_elsewhere"}';end if;
   select count(*) into n from public.wd_push_tokens where user_id=u;if n>=10 and t.user_id is null then return '{"error":"device_limit"}';end if;
   insert into public.wd_push_tokens values(u,d,(p_body->>'projectId')::uuid,p_body->>'environment',p_body->>'token',coalesce(t.revision,0)+1,pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_body->>'token','UTF8')),'hex'),true,now()) on conflict(user_id,device_id)do update set token=excluded.token,token_hash=excluded.token_hash,project_id=excluded.project_id,environment=excluded.environment,revision=excluded.revision,enabled=true,updated_at=now();
   result:=jsonb_build_object('deviceId',d,'revision',coalesce(t.revision,0)+1,'registered',true);
  end if;
 end if;
 insert into public.wd_push_receipts values(u,p_key,fingerprint,result,now());return result;
end $$;
revoke all on function public.wd_push_command(text,jsonb,uuid) from public,anon;
grant execute on function public.wd_push_command(text,jsonb,uuid) to authenticated;
-- Delete initiation disables pushes before any third-party worker; retries cannot re-enable them.
create function public.wd_push_account_cleanup()returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.state<>'active' then delete from public.wd_push_tokens where user_id=new.user_id;delete from public.wd_push_receipts where user_id=new.user_id;delete from public.wd_push_jobs where user_id=new.user_id;end if;return new;end $$;
create trigger wd_push_account_deleted after update of state on public.wd_accounts for each row execute function public.wd_push_account_cleanup();
revoke all on function public.wd_push_account_cleanup()from public,anon,authenticated;
alter table public.wd_push_jobs add column claimed_at timestamptz,add column retry_at timestamptz,add column sent_token_hash text;
create function public.wd_push_delivery(p_action text,p_body jsonb)returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.wd_push_jobs%rowtype;t public.wd_push_tokens%rowtype;active boolean;
begin
 if auth.role() is distinct from 'service_role' then raise insufficient_privilege;end if;
 if p_body is null or jsonb_typeof(p_body)<>'object' or octet_length(p_body::text)>4096 then return '{"error":"invalid_command"}';end if;
 if p_action='enqueue' then
  if p_body-array['id','userId','deviceId','projectId','environment','body']<>'{}' or p_body->>'body' is null or octet_length(p_body->>'body')>1000 then return '{"error":"invalid_command"}';end if;
  select * into j from public.wd_push_jobs where id=(p_body->>'id')::uuid for update;
  if found then if j.user_id<>(p_body->>'userId')::uuid or j.device_id<>(p_body->>'deviceId')::uuid or j.project_id<>(p_body->>'projectId')::uuid or j.environment<>p_body->>'environment' or j.body<>p_body->>'body' then return '{"error":"idempotency_conflict"}';end if;return '{"queued":true}';end if;
  select * into t from public.wd_push_tokens where user_id=(p_body->>'userId')::uuid and device_id=(p_body->>'deviceId')::uuid;
  if not found or not t.enabled or t.project_id<>(p_body->>'projectId')::uuid or t.environment<>p_body->>'environment' or not exists(select 1 from public.wd_accounts where user_id=t.user_id and state='active' and preferences->>'notifications'='true') then return '{"error":"notification_inactive"}';end if;
  insert into public.wd_push_jobs(id,user_id,device_id,project_id,environment,body) values((p_body->>'id')::uuid,t.user_id,t.device_id,t.project_id,t.environment,p_body->>'body');return '{"queued":true}';
 end if;
 select * into j from public.wd_push_jobs where id=(p_body->>'id')::uuid for update;if not found then return '{"job":null}';end if;
 select * into t from public.wd_push_tokens where user_id=j.user_id and device_id=j.device_id;
 active:=found and t.enabled and t.project_id=j.project_id and t.environment=j.environment and exists(select 1 from public.wd_push_projects where project_id=j.project_id and environment=j.environment and enabled) and exists(select 1 from public.wd_accounts where user_id=j.user_id and state='active' and preferences->>'notifications'='true');
 if p_action='claim' then
  if j.state='claimed' and j.claimed_at<now()-interval '5 minutes' then update public.wd_push_jobs set state='uncertain' where id=j.id;return '{"job":null}';end if;
  if j.state not in ('pending','retry') or j.attempts>=5 or j.retry_at>now() then return '{"job":null}';end if;
  if not active then update public.wd_push_jobs set state='held' where id=j.id;return '{"job":null}';end if;
  update public.wd_push_jobs set state='claimed',attempts=attempts+1,claimed_at=now(),sent_token_hash=t.token_hash where id=j.id;
  return jsonb_build_object('job',jsonb_build_object('id',j.id,'userId',j.user_id,'deviceId',j.device_id,'projectId',j.project_id,'environment',j.environment,'token',t.token,'body',j.body,'attempt',j.attempts+1));
 elsif p_action='allowed' then return jsonb_build_object('allowed',active and t.token_hash=j.sent_token_hash and j.state='claimed' and j.attempts=(p_body->>'attempt')::int);
 elsif p_action='finish' then
  if j.state<>'claimed' or j.attempts is distinct from (p_body->>'attempt')::int then return '{"updated":false}';end if;
  if p_body->>'state' is null or p_body->>'state' not in ('ticket','retry','held','uncertain') or (p_body->>'state'='ticket' and (p_body->>'ticket') is null) then return '{"error":"invalid_command"}';end if;
  update public.wd_push_jobs set state=p_body->>'state',ticket_id=p_body->>'ticket',retry_at=case when p_body->>'state'='retry' then now()+interval '1 minute'*power(2,j.attempts) end where id=j.id;return '{"updated":true}';
 elsif p_action='disable' then
  if j.state<>'claimed' or j.attempts is distinct from (p_body->>'attempt')::int then return '{"disabled":false}';end if;
  update public.wd_push_tokens set enabled=false,revision=revision+1 where user_id=j.user_id and device_id=j.device_id and token_hash=j.sent_token_hash;return '{"disabled":true}';
 elsif p_action='receipt' then
  if j.state<>'ticket' or j.ticket_id is distinct from p_body->>'ticket' then return '{"updated":false}';end if;
  if p_body->>'result' not in ('complete','retry','held','disable') or p_body->>'result' is null then return '{"error":"invalid_command"}';end if;
  if p_body->>'result'='disable' then update public.wd_push_tokens set enabled=false,revision=revision+1 where user_id=j.user_id and device_id=j.device_id and token_hash=j.sent_token_hash;end if;
  update public.wd_push_jobs set state=case when p_body->>'result'='disable' then 'held' else p_body->>'result' end,retry_at=case when p_body->>'result'='retry' then now()+interval '1 minute'*power(2,j.attempts) end where id=j.id;return '{"updated":true}';
 end if;
 return '{"error":"invalid_command"}';
end $$;
revoke all on function public.wd_push_delivery(text,jsonb)from public,anon,authenticated;
grant execute on function public.wd_push_delivery(text,jsonb)to service_role;
