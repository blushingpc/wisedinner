import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
test("actual isolated SQL protects immutable pointer versions, narrow grants and competing revisions",async()=>{
 const db=await PGlite.create("memory://");
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;grant usage on schema public,auth to anon,authenticated,service_role;
 create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.role',true)$$;
 create table public.data_snapshots(version int primary key,url text not null,sha256 text not null,created_at timestamptz not null default now());alter table public.data_snapshots enable row level security;
 grant select,insert,update,delete on public.data_snapshots to service_role;
 create table public.unrelated_sentinel(id int);grant insert on public.unrelated_sentinel to service_role;
 insert into public.data_snapshots values(1,'https://example.invalid/snapshots/v1.json',repeat('a',64),now());`);
 await db.exec(await readFile(new URL("../../supabase/migrations/0008_wd_publication.sql",import.meta.url),"utf8"));
 const role=async(r:string)=>{await db.exec("reset role");await db.query("select set_config('request.jwt.role',$1,false)",[r]);await db.exec(`set role ${r}`);};
 const put=(expected:number|null,v:number,hash="b".repeat(64))=>db.query<{result:{currentVersion:number;reused:boolean}}>("select public.wd_publish_pointer($1,$2,$3,$4) result",[expected,v,`https://example.invalid/snapshots/v${v}.json`,hash]);
 await role("authenticated");await assert.rejects(put(1,2),/permission denied/);
 await role("service_role");await db.exec("insert into public.unrelated_sentinel values(1)");
 await assert.rejects(db.exec("insert into public.data_snapshots(version,url,sha256) values(2,'x','y')"),/permission denied/);
 await assert.rejects(put(null,2),/invalid_pointer/);await assert.rejects(put(0,1,"c".repeat(64)),/immutable_version_conflict/);
 assert.equal((await put(1,2)).rows[0].result.currentVersion,2);assert.equal((await put(1,2)).rows[0].result.reused,true);
 await assert.rejects(put(1,2,"c".repeat(64)),/immutable_version_conflict/);await assert.rejects(put(1,3),/invalid_pointer/);
 assert.equal((await put(2,3)).rows[0].result.currentVersion,3);assert.equal((await put(1,2)).rows[0].result.currentVersion,3);
 await assert.rejects(put(3,5),/invalid_pointer/);await assert.rejects(db.exec("update public.data_snapshots set sha256='x'"),/permission denied/);
 }finally{await db.close();}
});
