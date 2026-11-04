import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { createReviewedCurrentSourceBinder } from "./generated-current-reviewed-source.ts";

const job = "C:/Users/borgh/Documents/ChatGPT/wisedinner/reports/website-refresh-20261027/normal-ui-study/native-integration-20261030/";
test("closed current V4 handoff preserves capsule seals and does not admit a public price or review-window mutation", async () => {
  const capsule = JSON.parse(await readFile(new URL("./generated-current-source-capsule-v4.json", import.meta.url), "utf8"));
  const originalHash = createHash("sha256").update(JSON.stringify(capsule)).digest("hex");
  const binder = createReviewedCurrentSourceBinder(capsule, () => Date.parse("2026-10-31T12:00:00Z"));
  assert.equal(binder.reviewedReferenceData?.sourcePolicyBasis.basisSha256, "6416f956c50b380e4cbd11d223c9095642487cf028142e58aaff80419e5628f4");
  assert.equal((binder.reviewedReferenceData?.configuration as { referencePrices: { facts: unknown[] } }).referencePrices.facts.length, 14);
  assert.equal(createHash("sha256").update(JSON.stringify(capsule)).digest("hex"), originalHash);
  const price = structuredClone(capsule); price.configuration.referencePrices.facts[0].packPriceCents.max += 1;
  assert.throws(() => createReviewedCurrentSourceBinder(price), /seal mismatch/);
  assert.throws(() => createReviewedCurrentSourceBinder({ ...capsule, reviewRevision: 5 }), /seal mismatch/);
  const historical = JSON.parse(await readFile(new URL("./generated-current-source-capsule-v2.json", import.meta.url), "utf8"));
  const old = createReviewedCurrentSourceBinder(historical);
  assert.equal(old.reviewedReferenceData, undefined); assert.equal(old.referenceWindow.lastDay, "2026-10-30");
  assert.equal(old.sourceSha256, binder.sourceSha256);
});
test("exact combined rollout is atomic with tracking and managed-role privileges, preserving unrelated history", async () => {
  const query = await readFile(job + "CURRENT-OWNER-FOUNDATION-APPLY.sql", "utf8");
  const manifest = JSON.parse(await readFile(job + "CURRENT-OWNER-FOUNDATION-APPLY-MANIFEST.json", "utf8")) as { querySha256: string; tracking: { version: string; name: string; statementsSha256: string }[] };
  assert.equal(createHash("sha256").update(query).digest("hex"), manifest.querySha256);
  const db = await PGlite.create("memory://");
  try {
    // PostgreSQL forbids demoting its bootstrap role. Rename that role under
    // a separate fixture administrator, then create the real target name with
    // the observed managed privileges. The tested rollout bytes stay exact.
    await db.exec(`create role fixture_admin superuser;set session authorization fixture_admin;
      alter role postgres rename to fixture_bootstrap;
      create role postgres nosuperuser createrole bypassrls;
      create role anon;create role authenticated;create role service_role bypassrls;
      create schema auth;grant usage on schema public,auth to anon,authenticated,service_role;
      create function auth.jwt()returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
      create function auth.uid()returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
      create function auth.role()returns text language sql stable as $$select auth.jwt()->>'role'$$;
      create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text);
      insert into supabase_migrations.schema_migrations values('unrelated-sentinel',ARRAY['untouched'],'unrelated');
      create table public.unrelated_sentinel(id integer primary key);insert into public.unrelated_sentinel values(7);
      alter default privileges for role postgres in schema public grant execute on functions to anon,authenticated,service_role;
      grant all on schema public to postgres with grant option;
      grant usage on schema auth,supabase_migrations to postgres;
      grant select,insert on supabase_migrations.schema_migrations to postgres;
      grant select on public.unrelated_sentinel to postgres;`);
    const database = (await db.query<{ name: string }>("select current_database() name")).rows[0]!.name;
    await db.exec(`grant create on database "${database.replaceAll('"', '""')}" to postgres;set role postgres`);
    await db.exec(query);
    const history = (await db.query<{ version: string; name: string; statements_hash: string }>("select version,name,encode(sha256(convert_to(array_to_string(statements,''),'UTF8')),'hex') statements_hash from supabase_migrations.schema_migrations where version<>'unrelated-sentinel' order by version")).rows;
    assert.deepEqual(history.map(row => ({ version: row.version, name: row.name, statementsSha256: row.statements_hash })), manifest.tracking);
    assert.deepEqual((await db.query("select id from public.unrelated_sentinel")).rows, [{ id: 7 }]);
    assert.deepEqual((await db.query("select statements from supabase_migrations.schema_migrations where version='unrelated-sentinel'")).rows, [{ statements: ["untouched"] }]);
    const role = (await db.query<{ rolsuper: boolean; rolbypassrls: boolean; rolcanlogin: boolean; actor_set: boolean }>("select rolsuper,rolbypassrls,rolcanlogin,pg_has_role('postgres',oid,'SET') actor_set from pg_roles where rolname='wd_current_plan_internal'")).rows[0]!;
    assert.deepEqual(role, { rolsuper: false, rolbypassrls: false, rolcanlogin: false, actor_set: false });
    assert.equal((await db.query<{ private_original: boolean }>("select to_regprocedure('wd_current_private.wd_account_command(text,jsonb,uuid)') is not null private_original")).rows[0]!.private_original, true);
    assert.equal((await db.query<{ public_rpc: boolean }>("select to_regprocedure('public.wd_current_plan_rpc(uuid,integer,text,text,jsonb,bigint)') is not null public_rpc")).rows[0]!.public_rpc, true);
    // Reproduce the actual hosted gap: the creator can SET the owner but cannot
    // revoke its default ACL while executing as NOINHERIT postgres.
    const privilege = async (role: string, fn: string) => (await db.query<{ allowed: boolean }>("select has_function_privilege($1,$2,'EXECUTE') allowed", [role, fn])).rows[0]!.allowed;
    const rpc = "public.wd_current_plan_rpc(uuid,integer,text,text,jsonb,bigint)", cleanup = "public.wd_current_plan_cleanup_pending(uuid)";
    assert.equal(await privilege("anon", rpc), true);
    assert.equal(await privilege("authenticated", cleanup), true);
    const repair = await readFile(job + "CURRENT-OWNER-EXEC-REPAIR-0020.sql", "utf8");
    const repairManifest = JSON.parse(await readFile(job + "CURRENT-OWNER-EXEC-REPAIR-0020-MANIFEST.json", "utf8")) as { querySha256: string; tracking: { version: string; name: string; statementsSha256: string } };
    assert.equal(createHash("sha256").update(repair).digest("hex"), repairManifest.querySha256);
    await db.exec(repair);
    for (const client of ["anon", "authenticated"]) for (const fn of [rpc, cleanup]) assert.equal(await privilege(client, fn), false);
    assert.equal(await privilege("service_role", rpc), true); assert.equal(await privilege("service_role", cleanup), true);
    assert.equal(await privilege("postgres", cleanup), true);
    assert.equal((await db.query<{ allowed: boolean }>("select pg_has_role('postgres','wd_current_plan_internal','SET') allowed")).rows[0]!.allowed, false);
    const repairedHistory = (await db.query<{ version: string; name: string; statementsSha256: string }>("select version,name,encode(sha256(convert_to(array_to_string(statements,''),'UTF8')),'hex') as \"statementsSha256\" from supabase_migrations.schema_migrations where version='0020'")).rows[0]!;
    assert.deepEqual(repairedHistory, repairManifest.tracking);
    await assert.rejects(db.exec(query), /current_foundation_migration_history_changed/);
    await db.exec("rollback");
    assert.equal((await db.query<{ count: number }>("select count(*)::int count from supabase_migrations.schema_migrations")).rows[0]!.count, 8);
  } finally { await db.close(); }
});
