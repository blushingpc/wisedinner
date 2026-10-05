-- Additive, backend-owned account foundation. UNAPPLIED. Never run against shared production in this run.
begin;
create table public.wd_accounts (
  user_id uuid primary key,
  state text not null default 'active' check (state in ('active','deletion_pending','deleted')),
  revision integer not null default 1 check (revision > 0),
  preferences jsonb not null default '{"diet":"none","allergens":[],"excludedSkuIds":[],"household":1,"notifications":false}'::jsonb check (jsonb_typeof(preferences) = 'object' and octet_length(preferences::text) <= 8192),
  deletion_dependencies jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- No auth.users cascade: the tombstone must outlive Auth deletion to deny old JWTs/webhooks.
-- Tombstone/receipt retention requires a separately approved privacy policy before activation.
create table public.wd_saved_weeks (
  user_id uuid not null references public.wd_accounts(user_id),
  id uuid not null,
  revision integer not null check (revision > 0),
  week jsonb not null check (jsonb_typeof(week) = 'object' and octet_length(week::text) <= 8192
    and jsonb_typeof(week->'recipeIds') = 'array' and jsonb_array_length(week->'recipeIds') = 15
    and (week->>'snapshotSha256') ~ '^[0-9a-f]{64}$'
    and length(week->>'solverRevision') between 1 and 128
    and length(week->>'catalogRevision') between 1 and 128),
  updated_at timestamptz not null default now(),
  primary key (user_id,id)
);
create table public.wd_account_receipts (
  user_id uuid not null references public.wd_accounts(user_id),
  id uuid not null,
  request jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id,id)
);
create index wd_account_receipts_time on public.wd_account_receipts(user_id,created_at);
create table public.wd_catalog_pins (
  catalog_revision text primary key check (length(catalog_revision) between 1 and 128),
  snapshot_version integer not null check (snapshot_version > 0),
  snapshot_sha256 text not null check (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  solver_revision text not null check (length(solver_revision) between 1 and 128),
  recipe_ids jsonb not null check (jsonb_typeof(recipe_ids) = 'array' and jsonb_array_length(recipe_ids) between 1 and 10000)
);
alter table public.wd_catalog_pins enable row level security;
revoke all on public.wd_catalog_pins from public,anon,authenticated;
grant select on public.wd_catalog_pins to authenticated;
grant select,insert on public.wd_catalog_pins to service_role;
create policy wd_catalog_pin_read on public.wd_catalog_pins for select to authenticated using (true);
alter table public.wd_accounts enable row level security;
alter table public.wd_saved_weeks enable row level security;
alter table public.wd_account_receipts enable row level security;
revoke all on public.wd_accounts, public.wd_saved_weeks, public.wd_account_receipts from public, anon, authenticated;
grant select on public.wd_accounts, public.wd_saved_weeks to authenticated;
grant select, insert, update, delete on public.wd_accounts, public.wd_saved_weeks, public.wd_account_receipts to service_role;
create policy wd_account_read on public.wd_accounts for select to authenticated using ((select auth.uid()) = user_id and state = 'active');
create policy wd_account_write on public.wd_accounts for update to authenticated using ((select auth.uid()) = user_id and state = 'active') with check ((select auth.uid()) = user_id and state = 'active');
create policy wd_week_read on public.wd_saved_weeks for select to authenticated using ((select auth.uid()) = user_id and exists (select 1 from public.wd_accounts a where a.user_id = (select auth.uid()) and a.state = 'active'));
create policy wd_week_write on public.wd_saved_weeks for all to authenticated using ((select auth.uid()) = user_id and exists (select 1 from public.wd_accounts a where a.user_id = (select auth.uid()) and a.state = 'active')) with check ((select auth.uid()) = user_id and exists (select 1 from public.wd_accounts a where a.user_id = (select auth.uid()) and a.state = 'active'));
-- Writes have no client table grants. The RPC derives ownership from auth.uid(), locks the account,
-- bounds writes, enforces revisions and commits idempotency in the SAME transaction.
create function public.wd_account_command(p_action text, p_body jsonb, p_key uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid(); a public.wd_accounts%rowtype; receipt public.wd_account_receipts%rowtype;
  result jsonb; requested jsonb := jsonb_build_object('action',p_action,'body',p_body); n integer; w public.wd_saved_weeks%rowtype;
begin
  if u is null or auth.role() <> 'authenticated' or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then return '{"error":"invalid_command"}'; end if;
  if p_action not in ('initialize','read','update','list_weeks','save_week','delete_week','begin_deletion','deletion_status') or p_body is null or jsonb_typeof(p_body) <> 'object' or octet_length(p_body::text) > 16384 then return '{"error":"invalid_command"}'; end if;
  if p_action not in ('read','list_weeks','deletion_status') and p_key is null then return '{"error":"invalid_command"}'; end if;
  if p_action = 'initialize' then
    if p_body <> '{}'::jsonb then return '{"error":"invalid_command"}'; end if;
    insert into public.wd_accounts(user_id) values(u) on conflict do nothing;
  end if;
  select * into a from public.wd_accounts where user_id = u for update;
  if not found then return '{"error":"account_missing"}'; end if;
  if p_action = 'deletion_status' then return jsonb_build_object('state',a.state,'dependencies',a.deletion_dependencies); end if;
  -- Pending/deleted accounts may only retry deletion or read its status. They cannot bootstrap again.
  if a.state <> 'active' and p_action <> 'begin_deletion' then return '{"error":"account_inactive"}'; end if;
  if p_action in ('read','list_weeks') then
    if p_action = 'read' then return jsonb_build_object('revision',a.revision,'preferences',a.preferences); end if;
    n := (p_body->>'limit')::integer;
    if n is null or n < 1 or n > 50 then return '{"error":"invalid_command"}'; end if;
    select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into result from (select id,revision,week from public.wd_saved_weeks where user_id = u and (p_body->>'before' is null or id < (p_body->>'before')::uuid) order by id desc limit n) t;
    return jsonb_build_object('weeks',result);
  end if;
  if p_key is null then return '{"error":"invalid_command"}'; end if;
  select * into receipt from public.wd_account_receipts where user_id = u and id = p_key;
  if found then
    if receipt.request <> requested then return '{"error":"idempotency_conflict"}'; end if;
    return receipt.result;
  end if;
  if (select count(*) from public.wd_account_receipts where user_id = u and created_at > now() - interval '1 minute') >= 30 then return '{"error":"rate_limited"}'; end if;
  if p_action = 'initialize' then result := jsonb_build_object('revision',a.revision,'preferences',a.preferences);
  elsif p_action = 'update' then
    if (p_body->>'revision')::integer is distinct from a.revision then return '{"error":"revision_conflict"}'; end if;
    -- Restrict all keys even for direct RPC callers. Tier/roles/entitlements cannot enter preferences.
    if coalesce((p_body - array['revision','preferences']) <> '{}'::jsonb or jsonb_typeof(p_body->'preferences') <> 'object'
      or ((p_body->'preferences') - array['diet','allergens','excludedSkuIds','household','notifications']) <> '{}'::jsonb
      or not ((p_body->'preferences') ?& array['diet','allergens','excludedSkuIds','household','notifications'])
      or (p_body->'preferences'->>'diet') not in ('none','vegan','vegetarian','dairy-free','gluten-free')
      or jsonb_typeof(p_body->'preferences'->'notifications') <> 'boolean'
      or jsonb_typeof(p_body->'preferences'->'allergens') <> 'array' or jsonb_array_length(p_body->'preferences'->'allergens') > 9
      or jsonb_typeof(p_body->'preferences'->'excludedSkuIds') <> 'array' or jsonb_array_length(p_body->'preferences'->'excludedSkuIds') > 79
      or (p_body->'preferences'->>'household')::integer not between 1 and 8, true) then return '{"error":"invalid_command"}'; end if;
    if exists (select 1 from jsonb_array_elements(p_body->'preferences'->'allergens') x where jsonb_typeof(x) <> 'string' or (x#>>'{}') not in ('peanuts','tree-nuts','dairy','eggs','wheat','soy','fish','shellfish','sesame'))
      or exists (select 1 from jsonb_array_elements(p_body->'preferences'->'excludedSkuIds') x where jsonb_typeof(x) <> 'string' or (x#>>'{}') !~ '^[a-z0-9-]{1,64}$') then return '{"error":"invalid_command"}'; end if;
    update public.wd_accounts set preferences = p_body->'preferences', revision = revision+1,updated_at = now() where user_id = u returning revision into n;
    result := jsonb_build_object('revision',n);
  elsif p_action in ('save_week','delete_week') then
    select * into w from public.wd_saved_weeks where user_id = u and id = (p_body->>'id')::uuid;
    if coalesce(w.revision,0) is distinct from (p_body->>'revision')::integer then return '{"error":"revision_conflict"}'; end if;
    if p_action = 'delete_week' then
      if w.id is null then return '{"error":"revision_conflict"}'; end if;
      delete from public.wd_saved_weeks where user_id = u and id = w.id; result := '{"deleted":true}';
    else
      if w.id is null and (select count(*) from public.wd_saved_weeks where user_id = u) >= 52 then return '{"error":"week_limit"}'; end if;
      if (p_body - array['id','revision','week']) <> '{}'::jsonb
        or not exists (select 1 from public.wd_catalog_pins p where p.catalog_revision = p_body->'week'->>'catalogRevision'
          and p.snapshot_version = (p_body->'week'->>'snapshotVersion')::integer
          and p.snapshot_sha256 = p_body->'week'->>'snapshotSha256' and p.solver_revision = p_body->'week'->>'solverRevision'
          and jsonb_typeof(p_body->'week'->'recipeIds') = 'array'
          and not exists (select 1 from jsonb_array_elements(p_body->'week'->'recipeIds') r where not (p.recipe_ids @> jsonb_build_array(r))))
        then return '{"error":"invalid_command"}'; end if;
      insert into public.wd_saved_weeks(user_id,id,revision,week) values(u,(p_body->>'id')::uuid,coalesce(w.revision,0)+1,p_body->'week') on conflict(user_id,id) do update set revision = excluded.revision,week = excluded.week,updated_at = now();
      result := jsonb_build_object('revision',coalesce(w.revision,0)+1,'nutritionalProof',false);
    end if;
  elsif p_action = 'begin_deletion' then
    -- Recent authentication is checked AGAIN in SQL; refreshed JWT iat is not proof.
    if not exists (select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) m where m->>'method' in ('password','otp','oauth','totp','webauthn') and (m->>'timestamp')::bigint between extract(epoch from now())::bigint-300 and extract(epoch from now())::bigint) then return '{"error":"invalid_command"}'; end if;
    if a.state = 'active' then
      delete from public.wd_saved_weeks where user_id = u;
      delete from public.wd_account_receipts where user_id = u;
      update public.wd_accounts set state = 'deletion_pending',preferences = '{}'::jsonb,revision = revision+1,updated_at = now(),deletion_dependencies = jsonb_build_object('authDeletion','pending','sessionInvalidation','pending','appleRevocation','needs_provider_check','subscriptionCancellation','not_performed') where user_id = u;
    end if;
    result := jsonb_build_object('state','deletion_pending','subscriptionCancelled',false);
  else return '{"error":"invalid_command"}'; end if;
  insert into public.wd_account_receipts(user_id,id,request,result) values(u,p_key,requested,result);
  return result;
exception when invalid_text_representation or check_violation or not_null_violation or numeric_value_out_of_range then return '{"error":"invalid_command"}';
end $$;
revoke all on function public.wd_account_command(text,jsonb,uuid) from public,anon;
grant execute on function public.wd_account_command(text,jsonb,uuid) to authenticated;
commit;
