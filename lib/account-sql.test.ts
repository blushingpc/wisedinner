import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const A = "10000000-0000-4000-8000-000000000001", B = "10000000-0000-4000-8000-000000000002";
const K = "20000000-0000-4000-8000-000000000001", K2 = "20000000-0000-4000-8000-000000000002";
const W = "30000000-0000-4000-8000-000000000001";
// Target is explicitly ephemeral PostgreSQL WASM memory. Never reads env, URLs, credential stores or disk databases.
// auth helpers below emulate verified PostgREST claims; they do not test Supabase signature verification.
test("isolated PostgreSQL executes account migration/RLS, ownership, atomic retries and tombstone denial", async () => {
  const db = await PGlite.create("memory://");
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      grant usage on schema public,auth to anon,authenticated,service_role;
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
      create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
      create function auth.role() returns text language sql stable as $$ select auth.jwt()->>'role' $$;
      create table public.unrelated_sentinel(id integer primary key);
      insert into public.unrelated_sentinel values(7); grant select on public.unrelated_sentinel to authenticated;`);
    await db.exec(await readFile(new URL("../supabase/migrations/0006_wd_accounts.sql", import.meta.url), "utf8"));
    const login = async (role: "anon" | "authenticated" | "service_role", id?: string, age = 0) => {
      await db.exec("reset role");
      const claims = { role, sub: id, is_anonymous: false, amr: [{ method: "oauth", timestamp: Math.floor(Date.now() / 1000) - age }] };
      await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify(claims)]);
      await db.exec(`set role ${role}`);
    };
    const command = async (action: string, body = {}, key: string | null = K) => (await db.query<{ result: Record<string, unknown> }>("select public.wd_account_command($1,$2::jsonb,$3::uuid) as result", [action, JSON.stringify(body), key])).rows[0].result;
    await login("anon");
    await assert.rejects(db.query("select * from public.wd_accounts"), /permission denied/);
    await assert.rejects(command("initialize"), /permission denied/);
    await login("authenticated", A);
    assert.equal((await command("initialize", {}, null)).error, "invalid_command");
    assert.equal((await db.query("select * from public.wd_accounts")).rows.length, 0);
    const initialized = await command("initialize"); assert.equal(initialized.revision, 1);
    assert.deepEqual(await command("initialize"), initialized);
    assert.equal((await db.query("select * from public.unrelated_sentinel")).rows.length, 1);
    await assert.rejects(db.query("update public.wd_accounts set revision=99"), /permission denied/);
    await assert.rejects(db.query("insert into public.wd_saved_weeks(user_id,id,revision,week) values($1,$2,1,'{}')", [A, W]), /permission denied/);
    const prefs = { diet: "none", allergens: [], excludedSkuIds: [], household: 2, notifications: false };
    assert.equal((await command("update", { revision: 1, preferences: { ...prefs, tier: "protein" } }, K2)).error, "invalid_command");
    assert.equal((await command("update", { revision: 1, preferences: { ...prefs, household: null } }, K2)).error, "invalid_command");
    assert.equal((await command("update", { revision: 1, preferences: prefs }, K2)).revision, 2);
    assert.equal((await command("update", { revision: 1, preferences: prefs }, W)).error, "revision_conflict");
    assert.equal((await command("update", { revision: 2, preferences: prefs }, K2)).error, "idempotency_conflict");
    await login("authenticated", B); await command("initialize");
    assert.equal((await db.query<{ user_id: string }>("select user_id from public.wd_accounts")).rows[0].user_id, B);
    assert.equal((await db.query("select * from public.wd_accounts where user_id=$1", [A])).rows.length, 0);
    await assert.rejects(db.query("select * from public.wd_account_receipts"), /permission denied/);
    await login("service_role");
    await db.query("insert into public.wd_catalog_pins values($1,5,$2,'solver-test','[\"main\"]')", ["catalog-test", "a".repeat(64)]);
    await assert.rejects(db.query("update public.wd_catalog_pins set snapshot_version=6"), /permission denied/);
    await login("authenticated", A);
    const week = { snapshotVersion: 5, snapshotSha256: "a".repeat(64), solverRevision: "solver-test", catalogRevision: "catalog-test", recipeIds: Array(15).fill("main"), seed: 7 };
    assert.equal((await command("save_week", { id: W, revision: 0, week: { ...week, snapshotSha256: "b".repeat(64) } }, W)).error, "invalid_command");
    assert.equal((await command("save_week", { id: W, revision: 0, week }, W)).revision, 1);
    await login("authenticated", B);
    assert.equal((await command("list_weeks", { limit: 20, before: null }, null)).weeks instanceof Array, true);
    assert.deepEqual((await command("list_weeks", { limit: 20, before: null }, null)).weeks, []);
    assert.equal((await command("delete_week", { id: W, revision: 1 }, W)).error, "revision_conflict");
    await login("authenticated", A, 301);
    assert.equal((await command("begin_deletion", {}, A)).error, "invalid_command");
    await login("authenticated", A);
    const deleted = await command("begin_deletion", {}, A); assert.equal(deleted.state, "deletion_pending");
    assert.deepEqual(await command("begin_deletion", {}, A), deleted);
    assert.equal((await command("initialize", {}, B)).error, "account_inactive");
    assert.equal((await command("read", {}, null)).error, "account_inactive");
    assert.equal((await db.query("select * from public.wd_saved_weeks")).rows.length, 0);
    assert.equal((await db.query("select * from public.wd_accounts")).rows.length, 0);
    assert.equal((await command("deletion_status", {}, null)).state, "deletion_pending");
  } finally { await db.close(); }
});
