-- Private-v1 metadata boundary. Additive and UNAPPLIED; no live target authorized.
-- Existing incompatible rows/receipts remain history and block activation pending
-- independent inventory and a separately reviewed data-preserving transition.
begin;
create function public.wd_week_metadata_v1(w jsonb)
returns boolean language plpgsql immutable set search_path = '' as $guard$
begin
  if w is null or jsonb_typeof(w) <> 'object' or octet_length(w::text) > 8192 then return false; end if;
  if w - array['snapshotVersion','snapshotSha256','solverRevision','catalogRevision','recipeIds','seed'] <> '{}'::jsonb
    or not (w ?& array['snapshotVersion','snapshotSha256','solverRevision','catalogRevision','recipeIds','seed']) then return false; end if;
  if jsonb_typeof(w->'snapshotVersion') <> 'number' or jsonb_typeof(w->'seed') <> 'number'
    or (w->>'snapshotVersion') !~ '^[0-9]{1,10}$' or (w->>'seed') !~ '^[0-9]{1,10}$' then return false; end if;
  if (w->>'snapshotVersion')::numeric not between 1 and 2147483647
    or (w->>'seed')::numeric not between 0 and 2147483647 then return false; end if;
  if jsonb_typeof(w->'snapshotSha256') <> 'string' or (w->>'snapshotSha256') !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(w->'solverRevision') <> 'string' or (w->>'solverRevision') !~ '^[a-zA-Z0-9._:-]{1,128}$'
    or jsonb_typeof(w->'catalogRevision') <> 'string' or (w->>'catalogRevision') !~ '^[a-zA-Z0-9._:-]{1,128}$'
    or jsonb_typeof(w->'recipeIds') <> 'array' then return false; end if;
  if jsonb_array_length(w->'recipeIds') <> 15 then return false; end if;
  -- Repeated recipe IDs are legitimate meal slots, not duplicate saved-week IDs.
  if exists (select 1 from jsonb_array_elements(w->'recipeIds') r
    where jsonb_typeof(r) <> 'string' or (r#>>'{}') !~ '^[a-zA-Z0-9_-]{1,128}$') then return false; end if;
  return true;
end $guard$;
revoke all on function public.wd_week_metadata_v1(jsonb) from public,anon;
-- Pure predicate only. Needed for existing table SELECT/CHECK users; no DML/RPC bypass.
grant execute on function public.wd_week_metadata_v1(jsonb) to authenticated,service_role;
alter table public.wd_saved_weeks add constraint wd_saved_week_metadata_v1
  check (public.wd_week_metadata_v1(week) and revision between 1 and 2147483647
    and id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') not valid;
-- NOT VALID skips historical scanning only. All future INSERT/UPDATE rows must pass.
-- No old row/receipt rewrite, deletion, broad validation or grant expansion.
-- Same RPC identity; exact0006 body except the following pre-receipt save guard.
create or replace function public.wd_account_command(p_action text, p_body jsonb, p_key uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid(); a public.wd_accounts%rowtype; receipt public.wd_account_receipts%rowtype;
  result jsonb; requested jsonb := jsonb_build_object('action',p_action,'body',p_body); n integer; w public.wd_saved_weeks%rowtype;
begin
  if u is null or auth.role() is distinct from 'authenticated' or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then return '{"error":"invalid_command"}'; end if;
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
  -- Validate before replay: historical malformed requests cannot resurrect hybrid data.
  if p_action = 'save_week' then
    if p_body - array['id','revision','week'] <> '{}'::jsonb
      or not (p_body ?& array['id','revision','week'])
      or jsonb_typeof(p_body->'id') <> 'string'
      or (p_body->>'id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
      or jsonb_typeof(p_body->'revision') <> 'number'
      or (p_body->>'revision') !~ '^[0-9]{1,10}$'
      or not public.wd_week_metadata_v1(p_body->'week') then return '{"error":"invalid_command"}'; end if;
    if (p_body->>'revision')::numeric not between 0 and 2147483647 then return '{"error":"invalid_command"}'; end if;
  end if;
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
    if p_body - 'confirmation' <> '{}'::jsonb or p_body->>'confirmation' is distinct from 'DELETE MY ACCOUNT' then return '{"error":"invalid_command"}';end if;
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
