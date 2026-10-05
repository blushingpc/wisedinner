-- Prepared, unapplied. Coarse backend health only; no mail, paid classifier, alert schedule or engine access.
create table public.wd_ops_checks(check_id text primary key check(check_id in ('database','support-poll')),attempt uuid,last_attempt timestamptz,last_success timestamptz,error text not null default 'interrupted' check(error in ('none','configuration','unavailable','interrupted')),generation int not null default 0,healthy boolean not null default false);
create table public.wd_ops_alerts(id uuid primary key default gen_random_uuid(),check_id text not null references public.wd_ops_checks(check_id),generation int not null,state text not null check(state in ('failure','recovery')),acknowledged boolean not null default false,created_at timestamptz not null default now(),unique(check_id,generation,state));
alter table public.wd_ops_checks enable row level security;alter table public.wd_ops_alerts enable row level security;
revoke all on public.wd_ops_checks,public.wd_ops_alerts from public,anon,authenticated;
grant select,insert,update on public.wd_ops_checks,public.wd_ops_alerts to service_role;
create function public.wd_operations(p_action text,p_body jsonb)returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.wd_ops_checks%rowtype;ishealthy boolean;result jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise insufficient_privilege;end if;
 if p_body is null or jsonb_typeof(p_body)<>'object' or octet_length(p_body::text)>1024 then return '{"error":"invalid_command"}';end if;
 if p_action='read' then
  if p_body<>'{}' then return '{"error":"invalid_command"}';end if;
  select coalesce(jsonb_agg(jsonb_build_object('check',check_id,'lastAttempt',last_attempt,'lastSuccess',last_success,'error',error,'generation',generation)),'[]') into result from public.wd_ops_checks;return jsonb_build_object('checks',result);
 elsif p_action='alerts' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from(select id,check_id as "check",state from public.wd_ops_alerts where not acknowledged order by created_at,id limit 20)x;return jsonb_build_object('events',result);
 elsif p_action='ack' then update public.wd_ops_alerts set acknowledged=true where id=(p_body->>'id')::uuid;return '{"acknowledged":true}';end if;
 if p_body->>'check' is null or p_body->>'check' not in ('database','support-poll') then return '{"error":"invalid_command"}';end if;
 insert into public.wd_ops_checks(check_id)values(p_body->>'check')on conflict do nothing;
 select * into c from public.wd_ops_checks where check_id=p_body->>'check' for update;
 if p_action='begin' then
  update public.wd_ops_checks set attempt=(p_body->>'attempt')::uuid,last_attempt=now(),generation=generation+1,error='interrupted' where check_id=c.check_id;return '{"started":true}';
 elsif p_action='finish' then
  if c.attempt is distinct from (p_body->>'attempt')::uuid then return '{"stale":true}';end if;
  if p_body->>'error' is null or p_body->>'error' not in ('none','configuration','unavailable','interrupted') then return '{"error":"invalid_command"}';end if;
  ishealthy:=p_body->>'error'='none';
 elsif p_action='sweep' then
  ishealthy:=c.last_success is not null and c.last_success<=now() and c.last_success>now()-case when c.check_id='support-poll' then interval '15 minutes' else interval '26 hours' end and c.error='none';
 else return '{"error":"invalid_command"}';end if;
 if ishealthy is distinct from c.healthy then
  insert into public.wd_ops_alerts(check_id,generation,state)values(c.check_id,c.generation,case when ishealthy then 'recovery' else 'failure' end)on conflict do nothing;
 elsif not ishealthy and c.last_success is null and not exists(select 1 from public.wd_ops_alerts where check_id=c.check_id) then
  insert into public.wd_ops_alerts(check_id,generation,state)values(c.check_id,c.generation,'failure')on conflict do nothing;
 end if;
 update public.wd_ops_checks set healthy=ishealthy,error=case when p_action='finish' then p_body->>'error' else error end,last_success=case when p_action='finish' and ishealthy then now() else last_success end where check_id=c.check_id;
 return '{"recorded":true}';
end $$;
revoke all on function public.wd_operations(text,jsonb) from public,anon,authenticated;grant execute on function public.wd_operations(text,jsonb)to service_role;
