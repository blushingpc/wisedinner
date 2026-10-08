-- Unapplied server composition artifact; no live installation or binding authorized.
-- UNINSTALLED proposal. Execute ONLY in PGlite memory:// after unchanged prerequisites.
-- The replay staging row is server-only, same transaction, exact command. No client proof token.
begin;
create table public.wd_proposal_plan_policy(singleton boolean primary key default true check(singleton),policy jsonb not null,environment text not null check(environment in ('PRODUCTION','SANDBOX')));
create table public.wd_proposal_plan_documents(user_id uuid primary key references public.wd_accounts(user_id),revision integer not null check(revision between 1 and 2147483646),snapshot jsonb not null check(octet_length(snapshot::text)<=131072));
create table public.wd_proposal_plan_receipts(user_id uuid references public.wd_accounts(user_id),id uuid,command jsonb not null,result jsonb not null,created_at timestamptz not null default now(),primary key(user_id,id));
create table public.wd_proposal_plan_replay(user_id uuid references public.wd_accounts(user_id),id uuid,command jsonb not null check(octet_length(command::text)<=131072),transaction_id bigint not null,primary key(user_id,id));
alter table public.wd_proposal_plan_policy enable row level security;
alter table public.wd_proposal_plan_documents enable row level security;
alter table public.wd_proposal_plan_receipts enable row level security;
alter table public.wd_proposal_plan_replay enable row level security;
revoke all on public.wd_proposal_plan_policy,public.wd_proposal_plan_documents,public.wd_proposal_plan_receipts,public.wd_proposal_plan_replay from public,anon,authenticated,service_role;
grant select on public.wd_proposal_plan_documents to authenticated;
grant select,insert on public.wd_proposal_plan_policy to service_role;
grant insert on public.wd_proposal_plan_replay to service_role;
create policy wd_proposal_plan_owner_read on public.wd_proposal_plan_documents for select to authenticated using((select auth.uid())=user_id and exists(select 1 from public.wd_accounts a where a.user_id=(select auth.uid()) and a.state='active'));

create function public.wd_proposal_keys(v jsonb,keys text[],all_required boolean default true)returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(v)='object' and not exists(select 1 from jsonb_object_keys(v) k where not(k=any(keys))) and (not all_required or v ?& keys),false)
$$;
-- Counts all descendants, bounds arrays/strings/finite safe magnitude; invalid returns -1.
create function public.wd_proposal_nodes(v jsonb,depth integer default 0)returns integer language plpgsql immutable set search_path='' as $$
declare kind text:=jsonb_typeof(v);n integer:=1;child jsonb;part integer;
begin
 if depth>12 or v is null then return -1;end if;
 if kind='string' then if length(v#>>'{}')>4096 then return -1;end if;
 elsif kind='number' then if abs((v#>>'{}')::numeric)>9007199254740991 then return -1;end if;
 elsif kind='array' then
  if jsonb_array_length(v)>256 then return -1;end if;
  for child in select value from jsonb_array_elements(v) loop part:=public.wd_proposal_nodes(child,depth+1);if part<0 then return -1;end if;n:=n+part;end loop;
 elsif kind='object' then
  if exists(select 1 from jsonb_object_keys(v) k where k in ('__proto__','constructor','prototype')) then return -1;end if;
  for child in select value from jsonb_each(v) loop part:=public.wd_proposal_nodes(child,depth+1);if part<0 then return -1;end if;n:=n+part;end loop;
 elsif kind not in ('null','boolean') then return -1;end if;
 return case when n>10000 then -1 else n end;
end $$;
create function public.wd_proposal_answers(v jsonb,p jsonb,complete boolean)returns boolean language plpgsql immutable set search_path='' as $$
declare k text;x jsonb;
begin
 if not public.wd_proposal_keys(v,array['budget','protein','calories','diet','allergies','household','pantry','stores'],complete) then return false;end if;
 for k in select jsonb_object_keys(v) loop
  x:=v->k;
  if k='budget' then if jsonb_typeof(x)<>'number' or (x#>>'{}')::numeric not between 10 and 999 or mod((x#>>'{}')::numeric*100,1)<>0 then return false;end if;
  elsif k='protein' then if jsonb_typeof(x)<>'number' or (x#>>'{}')::numeric not between 20 and 400 then return false;end if;
  elsif k='household' then if jsonb_typeof(x)<>'number' or x not in ('1','2','3','4') then return false;end if;
  elsif k='calories' then if jsonb_typeof(x)<>'string' or x#>>'{}' not in ('under-1800','1800-2300','2300-2800','over-2800','not-sure') then return false;end if;
  elsif k='diet' then if jsonb_typeof(x)<>'string' or x#>>'{}' not in ('none','vegan','vegetarian','dairy-free','gluten-free') then return false;end if;
  elsif k in ('stores','allergies') then
   if jsonb_typeof(x)<>'array' then return false;end if;
   if k='stores' and jsonb_array_length(x)>(p->>'maxStores')::integer then return false;end if;
   if (select count(*) from jsonb_array_elements(x))<>(select count(distinct value) from jsonb_array_elements(x)) then return false;end if;
   if exists(select 1 from jsonb_array_elements(x) e where jsonb_typeof(e)<>'string' or not((case when k='stores' then p->'stores' else p->'allergens' end)@>jsonb_build_array(e))) then return false;end if;
  elsif k='pantry' then
   if jsonb_typeof(x)<>'array' then return false;end if;
   if (select count(*) from jsonb_array_elements(x))<>(select count(distinct value->>'id') from jsonb_array_elements(x)) then return false;end if;
   for x in select value from jsonb_array_elements(v->'pantry') loop
    if not public.wd_proposal_keys(x,array['id','qty','name'],false) or not(x ?& array['id','qty']) or jsonb_typeof(x->'id')<>'string' or jsonb_typeof(x->'qty')<>'number' or (x->>'qty')::numeric not between 0 and 9007199254740991 then return false;end if;
    if x?'name' and (jsonb_typeof(x->'name')<>'string' or length(trim(x->>'name'))=0) then return false;end if;
    if not((p->'pantryIds')@>jsonb_build_array(x->'id')) and not(x->>'id' like 'custom:%' and x?'name') then return false;end if;
   end loop;
  end if;
 end loop;return true;
exception when others then return false;
end $$;
create function public.wd_proposal_shape(c jsonb,p jsonb)returns boolean language plpgsql immutable set search_path='' as $$
declare s jsonb;w jsonb;r jsonb;x jsonb;
begin
 if octet_length(c::text)>131072 or public.wd_proposal_nodes(c) <0 or not public.wd_proposal_keys(c,array['format','pins','expectedRevision','state'])
  or c->'format' is distinct from p->'format' or c->'pins' is distinct from p->'pins'
  or jsonb_typeof(c->'expectedRevision') is distinct from 'number' or c->>'expectedRevision' !~ '^[0-9]+$' or (c->>'expectedRevision')::numeric>2147483645 then return false;end if;
 s:=c->'state';if not public.wd_proposal_keys(s,array['answers','draft','week','checks']) then return false;end if;
 if not public.wd_proposal_answers(s->'draft',p,false) then return false;end if;
 if s->'answers'<>'null' and not public.wd_proposal_answers(s->'answers',p,true) then return false;end if;
 if jsonb_typeof(s->'checks') is distinct from 'object' or exists(select 1 from jsonb_each(s->'checks') where jsonb_typeof(value)<>'boolean') then return false;end if;
 w:=s->'week';
 if w='null' then return s->'checks'='{}';end if;
 if s->'answers'='null' or not public.wd_proposal_keys(w,array['seed','generatedAt','answers','result']) or w->'answers' is distinct from s->'answers'
  or jsonb_typeof(w->'seed') is distinct from 'number' or w->>'seed' !~ '^[0-9]+$' or (w->>'seed')::numeric>4294967295
  or jsonb_typeof(w->'generatedAt') is distinct from 'string' or w->>'generatedAt' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$' then return false;end if;
 r:=w->'result';
 if not public.wd_proposal_keys(r,array['feasible','seed','budget','protein_target','household','days','list','aisles','est_total','protein_min_day','protein_avg_day','kcal_avg_day','checks','delivery','why','shortfall_g','price_as_of','distinct_skus','allergyLimited','miss'])
  or jsonb_typeof(r->'list') is distinct from 'array' or jsonb_typeof(r->'days') is distinct from 'array' or jsonb_typeof(r->'aisles') is distinct from 'array'
  or jsonb_typeof(r->'feasible') is distinct from 'boolean' or jsonb_typeof(r->'allergyLimited') is distinct from 'boolean' then return false;end if;
 if (select count(*) from jsonb_array_elements(r->'list'))<>(select count(distinct value->>'id') from jsonb_array_elements(r->'list')) then return false;end if;
 for x in select value from jsonb_array_elements(r->'list') loop
  if not public.wd_proposal_keys(x,array['id','name','unit','qty','paidQty','price_usd','aisle','perishable','owned']) or jsonb_typeof(x->'id') is distinct from 'string' or jsonb_typeof(x->'qty') is distinct from 'number' or jsonb_typeof(x->'paidQty') is distinct from 'number' or jsonb_typeof(x->'price_usd') is distinct from 'number' then return false;end if;
 end loop;
 if exists(select 1 from jsonb_object_keys(s->'checks') k where not exists(select 1 from jsonb_array_elements(r->'list') row where row->>'id'=k)) then return false;end if;
 return true; -- Exact nested result equality to actual replay is separately mandatory in RPC below.
exception when others then return false;
end $$;

create function public.wd_proposal_plan_command(p_action text,p_body jsonb,p_key uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();a public.wd_accounts%rowtype;b public.wd_billing_bindings%rowtype;s public.wd_billing_states%rowtype;p public.wd_proposal_plan_policy%rowtype;d public.wd_proposal_plan_documents%rowtype;r public.wd_proposal_plan_receipts%rowtype;result jsonb;n bigint;
begin
 if u is null or auth.role() is distinct from 'authenticated' or auth.jwt()->>'is_anonymous' is distinct from 'false' then return '{"error":"invalid_command"}';end if;
 if p_action is null or p_action not in ('read','save') or p_body is null then return '{"error":"invalid_command"}';end if;
 select * into a from public.wd_accounts where user_id=u for update;
 if not found then return '{"error":"account_missing"}';end if;
 if a.state<>'active' then return '{"error":"account_inactive"}';end if;
 select * into p from public.wd_proposal_plan_policy where singleton;
 if not found then return '{"error":"replay_required"}';end if;
 select * into d from public.wd_proposal_plan_documents where user_id=u;
 if p_action='read' then
  if p_body<>'{}' or p_key is not null then return '{"error":"invalid_command"}';end if;
  return jsonb_build_object('format',p.policy->'format','pins',p.policy->'pins','serverRevision',coalesce(d.revision,0),'state',d.snapshot);
 end if;
 if p_key is null or not public.wd_proposal_shape(p_body,p.policy) then return '{"error":"invalid_command"}';end if;
 -- Same account -> billing lock order. Never trust a payload tier/expiry/environment/boolean.
 select * into b from public.wd_billing_bindings where user_id=u for update;
 select * into s from public.wd_billing_states where user_id=u and environment=p.environment for update;
 n:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
 if b.user_id is null or b.held or s.user_id is null or s.held or coalesce(s.state->>'state' not in ('active','trial'),true)
  or coalesce((s.state->>'expiresAt')::numeric<=n,true) or coalesce((s.state->>'observedAt')::numeric>n,true)
  or not exists(select 1 from public.wd_billing_transactions t where t.user_id=u and t.environment=p.environment and t.transaction_hash=s.state->>'transactionHash') then return '{"error":"eligibility_required"}';end if;
 select * into r from public.wd_proposal_plan_receipts where user_id=u and id=p_key;
 if found then if r.command is distinct from p_body then return '{"error":"idempotency_conflict"}';end if;
  delete from public.wd_proposal_plan_replay where user_id=u and id=p_key and transaction_id=txid_current();return r.result;end if;
 if coalesce(d.revision,0)<>(p_body->>'expectedRevision')::integer then return '{"error":"revision_conflict"}';end if;
 -- Independent server admission replay must bind every nested fact in THIS SQL transaction.
 -- Authenticated/anon cannot manufacture this staging row, even for their own owner.
 if not exists(select 1 from public.wd_proposal_plan_replay where user_id=u and id=p_key and transaction_id=txid_current() and command=p_body) then return '{"error":"replay_required"}';end if;
 if (select count(*) from public.wd_proposal_plan_receipts where user_id=u and created_at>now()-interval '1 minute')>=30 then return '{"error":"rate_limited"}';end if;
 insert into public.wd_proposal_plan_documents values(u,coalesce(d.revision,0)+1,p_body->'state')on conflict(user_id)do update set revision=excluded.revision,snapshot=excluded.snapshot returning * into d;
 result:=jsonb_build_object('format',p.policy->'format','pins',p.policy->'pins','serverRevision',d.revision,'state',d.snapshot);
 insert into public.wd_proposal_plan_receipts(user_id,id,command,result)values(u,p_key,p_body,result);
 delete from public.wd_proposal_plan_replay where user_id=u and id=p_key and transaction_id=txid_current();return result;
exception when invalid_text_representation or check_violation or not_null_violation or numeric_value_out_of_range then return '{"error":"invalid_command"}';
end $$;
revoke all on function public.wd_proposal_keys(jsonb,text[],boolean),public.wd_proposal_nodes(jsonb,integer),public.wd_proposal_answers(jsonb,jsonb,boolean),public.wd_proposal_shape(jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.wd_proposal_plan_command(text,jsonb,uuid)from public,anon,service_role;
grant execute on function public.wd_proposal_plan_command(text,jsonb,uuid)to authenticated;
create function public.wd_proposal_plan_cleanup()returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.state<>'active' then
  delete from public.wd_proposal_plan_documents where user_id=new.user_id;
  delete from public.wd_proposal_plan_receipts where user_id=new.user_id;
  delete from public.wd_proposal_plan_replay where user_id=new.user_id;
 end if;return new;
end $$;
revoke all on function public.wd_proposal_plan_cleanup()from public,anon,authenticated,service_role;
create trigger wd_proposal_plan_tombstone after update of state on public.wd_accounts for each row execute function public.wd_proposal_plan_cleanup();
commit;
