import {test}from "node:test";
import assert from "node:assert/strict";
import {readFile}from "node:fs/promises";
import {PGlite}from "@electric-sql/pglite";
const owner="10000000-0000-4000-8000-000000000001",other="10000000-0000-4000-8000-000000000002";
const hash=(n:number)=>n.toString(16).padStart(64,"0");
test("actual isolated SQL bounds reservations, rejects stale owners and preserves private grants",async()=>{
 const db=await PGlite.create("memory://");try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;grant usage on schema public,auth to anon,authenticated,service_role;
 create function auth.role()returns text language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb->>'role'$$;
 create table public.support_messages_v2(message_id text,direction text,created_at timestamptz default now());
 create table public.engine_grant_sentinel(id int);grant select on public.engine_grant_sentinel to authenticated;`);
 await db.exec(await readFile(new URL("../../supabase/migrations/0011_wd_support_sends.sql",import.meta.url),"utf8"));
 const login=async(role:string)=>{await db.exec("reset role");await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role})]);await db.exec(`set role ${role}`);};
 const rpc=async(action:string,body:unknown)=>(await db.query<{r:Record<string,unknown>}>("select public.wd_support_send($1,$2)r",[action,JSON.stringify(body)])).rows[0].r;
 await login("anon");await assert.rejects(rpc("reserve",{}),/permission denied/);
 await login("authenticated");await assert.rejects(db.query("select * from public.wd_support_sends"),/permission denied/);assert.equal((await db.query("select * from public.engine_grant_sentinel")).rows.length,0);
 await db.exec("reset role;insert into public.support_messages_v2(message_id,direction)select 'legacy-'||n,'out'from generate_series(1,449)n;");
 await login("service_role");await assert.rejects(db.query("insert into public.wd_support_sends(id,fingerprint,owner,state)values($1,$1,$2,'reserved')",[hash(900),owner]),/permission denied/);
 const body={id:hash(1),fingerprint:hash(10),owner};assert.equal((await rpc("reserve",{...body,tier:"forged"})).error,"invalid_command");
 const simultaneous=await Promise.all([rpc("reserve",body),rpc("reserve",{...body,id:hash(2)})]);assert.equal(simultaneous.filter(x=>x.state==="reserved").length,1);assert.equal(simultaneous.filter(x=>x.error==="send_cap").length,1);
 assert.equal((await rpc("reserve",body)).error,"send_held");assert.equal((await rpc("begin",{id:body.id,owner:other})).error,"send_held");
 assert.equal((await rpc("begin",{id:body.id,owner})).state,"sending");assert.equal((await rpc("begin",{id:body.id,owner})).error,"send_held");
 assert.equal((await rpc("accept",{id:body.id,owner,messageId:"synthetic-smtp-id"})).state,"accepted");assert.equal((await rpc("reserve",body)).messageId,"synthetic-smtp-id");
 await db.exec("reset role;insert into public.support_messages_v2(message_id,direction)values('synthetic-smtp-id','out');delete from public.support_messages_v2 where message_id='legacy-1';");
 await login("service_role");assert.equal((await rpc("reserve",{...body,id:hash(2)})).state,"reserved","accepted SMTP log must not count twice");
 assert.equal((await rpc("hold",{id:hash(2),owner})).state,"held");assert.equal((await rpc("reserve",{...body,id:hash(2)})).error,"send_held");
 await db.exec("reset role;update public.support_messages_v2 set created_at=now()-interval '25 hours';update public.wd_support_sends set created_at=now()-interval '25 hours',accepted_at=case when state='accepted'then now()-interval '25 hours'else null end;");
 await login("service_role");assert.equal((await rpc("reserve",{...body,id:hash(3)})).state,"reserved");
 await db.exec("reset role;update public.wd_support_sends set created_at=now()-interval '6 minutes'where id='"+hash(3)+"';");await login("service_role");assert.equal((await rpc("begin",{id:hash(3),owner})).error,"send_held");
 assert.equal((await rpc("reserve",{...body,fingerprint:hash(11)})).error,"send_identity_conflict");
 }finally{await db.close();}
});
