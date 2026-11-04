import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const A = "10000000-0000-4000-8000-000000000001";
const B = "10000000-0000-4000-8000-000000000002";
const OWNER = "40000000-0000-4000-8000-000000000001";

type OptionalTable = "wd_push_tokens" | "wd_push_receipts" | "wd_push_jobs";
async function minimum(optionalRows: "absent" | "other-owner" | "this-owner", optionalTable: OptionalTable) {
  // Explicit disposable memory. No hosted connection, environment or provider access.
  const db = await PGlite.create("memory://");
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; grant usage on schema public,auth to anon,authenticated,service_role;
    create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    create function auth.role() returns text language sql stable as $$select auth.jwt()->>'role'$$;`);
  for (const file of ["0006_wd_accounts.sql", "0013_wd_account_deletion.sql"]) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
  }
  await db.query("insert into public.wd_accounts(user_id,state,preferences) values($1,'deletion_pending','{}'),($2,'active','{}')", [A, B]);
  await db.exec("create table public.unrelated_sentinel(id integer primary key); insert into public.unrelated_sentinel values(7)");
  if (optionalRows !== "absent") {
    // Partial optional installation: checking one present table must not require the other two.
    await db.exec(`create table public.${optionalTable}(user_id uuid not null)`);
    await db.query(`insert into public.${optionalTable} values($1)`, [optionalRows === "this-owner" ? A : B]);
  }
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role: "service_role" })]);
  await db.exec("set role service_role");
  const command = async (action: string, body: Record<string, unknown>) => (await db.query<{ result: Record<string, unknown> }>(
    "select public.wd_deletion_command($1,$2::jsonb) result", [action, JSON.stringify(body)],
  )).rows[0].result;
  const claimed = await command("claim", { userId: A, owner: OWNER });
  const work = claimed.work as { attempt: number };
  return { db, command, body: { userId: A, owner: OWNER, attempt: work.attempt } };
}

const cases: { optionalRows: "absent" | "other-owner" | "this-owner"; optionalTable: OptionalTable }[] = [
  { optionalRows: "absent", optionalTable: "wd_push_tokens" },
  ...(["wd_push_tokens", "wd_push_receipts", "wd_push_jobs"] as const).flatMap(optionalTable =>
    (["other-owner", "this-owner"] as const).map(optionalRows => ({ optionalRows, optionalTable }))),
];
for (const { optionalRows, optionalTable } of cases) {
  test(`account deletion cleanup: ${optionalTable} ${optionalRows}`, async () => {
    const fixture = await minimum(optionalRows, optionalTable);
    try {
      const cleaned = await fixture.command("cleanup", fixture.body);
      if (optionalRows === "this-owner") {
        assert.equal(cleaned.error, "cleanup_pending");
      } else {
        assert.equal(cleaned.state, "deletion_pending");
        assert.equal((cleaned.work as { complete: boolean }).complete, false);
        assert.equal((await fixture.command("complete", fixture.body)).error, "invalid_progress");
      }
      await fixture.db.exec("reset role");
      assert.deepEqual((await fixture.db.query("select id from public.unrelated_sentinel")).rows, [{ id: 7 }]);
      assert.equal((await fixture.db.query<{ state: string }>("select state from public.wd_accounts where user_id=$1", [B])).rows[0].state, "active");
      if (optionalRows !== "absent") {
        assert.equal((await fixture.db.query<{ count: number }>(`select count(*)::int count from public.${optionalTable}`)).rows[0].count, 1);
      }
      await fixture.db.exec("set role authenticated");
      await assert.rejects(fixture.command("cleanup", fixture.body), /permission denied/);
    } finally {
      await fixture.db.close();
    }
  });
}
