-- UNAPPLIED capability candidate. No login, credentials or role membership installed here.
-- Apply only after 0016 and independent target/privilege review.
begin;
create role wd_owner_plan_stage nologin nosuperuser nobypassrls noinherit nocreatedb nocreaterole noreplication;
grant usage on schema public,auth to wd_owner_plan_stage;
grant execute on function auth.uid(),auth.role(),auth.jwt() to wd_owner_plan_stage;
grant insert on public.wd_proposal_plan_replay to wd_owner_plan_stage;
create policy wd_proposal_plan_server_stage on public.wd_proposal_plan_replay
 for insert to wd_owner_plan_stage
 with check(user_id=(select auth.uid()) and (select auth.role())='wd_owner_plan_stage' and transaction_id=txid_current());
-- A separately reviewed LOGIN may SET ROLE to authenticated and wd_owner_plan_stage.
-- This candidate intentionally grants no membership to any login or client Auth role.
commit;
