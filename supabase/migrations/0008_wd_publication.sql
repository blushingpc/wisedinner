-- Prepared, unapplied. Backend data_snapshots only; no engine schema or schema-wide privilege change.
-- Old direct insert publishers must be retired before applying; data reads remain compatible.
revoke insert,update,delete on public.data_snapshots from anon,authenticated,service_role;
create or replace function public.wd_publish_pointer(p_expected integer,p_version integer,p_url text,p_sha text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare latest integer; existing public.data_snapshots%rowtype;
begin
 if auth.role() is distinct from 'service_role' then raise insufficient_privilege; end if;
 if p_expected is null or p_version is null or p_sha is null or p_url is null or p_expected<0 or p_version<>p_expected+1 or p_sha !~ '^[a-f0-9]{64}$' or p_url !~ '^https://[^?]+/snapshots/v[0-9]+\.json$' or p_url not like '%/snapshots/v'||p_version||'.json' then raise exception 'invalid_pointer'; end if;
 perform pg_catalog.pg_advisory_xact_lock(746395120004::bigint);
 select coalesce(max(version),0) into latest from public.data_snapshots;
 select * into existing from public.data_snapshots where version=p_version;
 if found then
   if existing.sha256<>p_sha or existing.url<>p_url then raise exception 'immutable_version_conflict'; end if;
   return jsonb_build_object('currentVersion',latest,'reused',true);
 end if;
 if latest<>p_expected then raise exception 'pointer_conflict'; end if;
 insert into public.data_snapshots(version,url,sha256) values(p_version,p_url,p_sha);
 return jsonb_build_object('currentVersion',p_version,'reused',false);
end $$;
revoke all on function public.wd_publish_pointer(integer,integer,text,text) from public,anon,authenticated;
grant execute on function public.wd_publish_pointer(integer,integer,text,text) to service_role;
