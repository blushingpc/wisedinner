import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
const A="10000000-0000-4000-8000-000000000001",B="10000000-0000-4000-8000-000000000002",D="20000000-0000-4000-8000-000000000001",P="30000000-0000-4000-8000-000000000001",J="40000000-0000-4000-8000-000000000001";
test("actual isolated SQL enforces push owner/project/revision/dedup/opt-out and deletion cleanup",async()=>{
 const db=await PGlite.create("memory://");try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;grant usage on schema public,auth to anon,authenticated,service_role;
 create function auth.jwt()returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
 create function auth.uid()returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
 create function auth.role()returns text language sql stable as $$select auth.jwt()->>'role'$$;`);
 for(const file of ["0006_wd_accounts.sql","0009_wd_notifications.sql"])await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),"utf8"));
 const login=async(role:string,id?:string)=>{await db.exec("reset role");await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role,sub:id,amr:[{method:"oauth",timestamp:Math.floor(Date.now()/1000)}]})]);await db.exec(`set role ${role}`);};
 const rpc=async(name:string,...args:unknown[])=>(await db.query<{r:Record<string,unknown>}>(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(",")}) r`,args)).rows[0].r;
 const account=(action:string,body={},key:string|null=crypto.randomUUID())=>rpc("wd_account_command",action,JSON.stringify(body),key);
 const push=(action:string,body:unknown,key=crypto.randomUUID())=>rpc("wd_push_command",action,JSON.stringify(body),key);
 const delivery=(action:string,body:unknown)=>rpc("wd_push_delivery",action,JSON.stringify(body));
 const prefs=(notifications:boolean)=>({diet:"none",allergens:[],excludedSkuIds:[],household:1,notifications});
 const body={deviceId:D,projectId:P,environment:"production",token:"ExpoPushToken[synthetic-token-12345]",revision:0};
 await login("anon");await assert.rejects(push("register",body),/permission denied/);
 await login("authenticated",A);await account("initialize");await account("update",{revision:1,preferences:prefs(true)});
 assert.equal((await push("register",body)).error,"project_not_configured");
 await login("service_role");await db.query("insert into public.wd_push_projects values($1,'production',true)",[P]);
 await login("authenticated",A);const key=crypto.randomUUID(),registered=await push("register",body,key);assert.equal(registered.revision,1);assert.deepEqual(await push("register",body,key),registered);
 assert.equal((await push("register",{...body,user_id:B})).error,"invalid_command");assert.equal((await push("register",{...body,token:"ExpoPushToken[changed-token-12345]"},key)).error,"idempotency_conflict");
 assert.equal((await push("register",body)).error,"revision_conflict");await assert.rejects(db.exec("select token from public.wd_push_tokens"),/permission denied/);await assert.rejects(delivery("claim",{id:J}),/permission denied/);
 await login("authenticated",B);await account("initialize");await account("update",{revision:1,preferences:prefs(true)});assert.equal((await push("register",body)).error,"token_owned_elsewhere");await push("revoke",{deviceId:D});
 await login("service_role");assert.equal((await db.query<{enabled:boolean}>("select enabled from public.wd_push_tokens where user_id=$1",[A])).rows[0].enabled,true);
 const job={id:J,userId:A,deviceId:D,projectId:P,environment:"production",body:"Synthetic test only"};assert.equal((await delivery("enqueue",job)).queued,true);assert.equal((await delivery("enqueue",job)).queued,true);assert.equal((await delivery("enqueue",{...job,body:"different"})).error,"idempotency_conflict");
 assert.ok((await delivery("claim",{id:J})).job);assert.equal((await delivery("claim",{id:J})).job,null);assert.equal((await delivery("allowed",{id:J,attempt:1})).allowed,true);
 assert.equal((await delivery("finish",{id:J,attempt:9,state:"ticket",ticket:J})).updated,false);await delivery("finish",{id:J,attempt:1,state:"ticket",ticket:J});
 assert.equal((await delivery("receipt",{id:J,ticket:B,result:"disable"})).updated,false);await delivery("receipt",{id:J,ticket:J,result:"disable"});assert.equal((await db.query<{enabled:boolean}>("select enabled from public.wd_push_tokens where user_id=$1",[A])).rows[0].enabled,false);
 await login("authenticated",A);assert.equal((await push("register",{...body,revision:2})).revision,3);
 const secondJob=crypto.randomUUID();await login("service_role");await delivery("enqueue",{...job,id:secondJob});await delivery("claim",{id:secondJob});await delivery("finish",{id:secondJob,attempt:1,state:"ticket",ticket:secondJob});
 await login("authenticated",A);assert.equal((await push("register",{...body,revision:3,token:"ExpoPushToken[rotated-token-12345]"})).revision,4);
 await login("service_role");await delivery("receipt",{id:secondJob,ticket:secondJob,result:"disable"});assert.equal((await db.query<{enabled:boolean}>("select enabled from public.wd_push_tokens where user_id=$1",[A])).rows[0].enabled,true,"late receipt must not disable a rotated token");
 await login("authenticated",A);await account("update",{revision:2,preferences:prefs(false)});assert.equal((await push("register",{...body,revision:4})).error,"notifications_disabled");
 await account("begin_deletion",{confirmation:"DELETE MY ACCOUNT"});assert.equal((await push("register",{...body,revision:3})).error,"account_inactive");
 await login("service_role");for(const table of ["wd_push_tokens","wd_push_jobs","wd_push_receipts"])assert.equal((await db.query(`select * from public.${table} where user_id=$1`,[A])).rows.length,0);
 }finally{await db.close();}
});
test("actual isolated operations SQL preserves attempts/success, coarse failures and alert recovery dedup",async()=>{
 const db=await PGlite.create("memory://");try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;grant usage on schema public,auth to anon,authenticated,service_role;create function auth.role()returns text language sql stable as $$select current_setting('request.jwt.role',true)$$;`);
 await db.exec(await readFile(new URL("../supabase/migrations/0010_wd_operations.sql",import.meta.url),"utf8"));
 const rpc=async(action:string,body={})=>(await db.query<{r:Record<string,unknown>}>("select public.wd_operations($1,$2::jsonb)r",[action,JSON.stringify(body)])).rows[0].r;
 await db.exec("set role authenticated");await assert.rejects(rpc("read"),/permission denied/);await db.exec("reset role");await db.query("select set_config('request.jwt.role','service_role',false)");await db.exec("set role service_role");
 await rpc("begin",{check:"support-poll",attempt:A});await rpc("finish",{check:"support-poll",attempt:A,error:"unavailable"});assert.equal(((await rpc("alerts")).events as unknown[]).length,1);
 await rpc("begin",{check:"support-poll",attempt:B});await rpc("finish",{check:"support-poll",attempt:B,error:"unavailable"});assert.equal(((await rpc("alerts")).events as unknown[]).length,1);
 assert.equal((await rpc("finish",{check:"support-poll",attempt:A,error:"none"})).stale,true);
 await rpc("finish",{check:"support-poll",attempt:B,error:"none"});assert.equal(((await rpc("alerts")).events as unknown[]).length,2);
 const probe=((await rpc("read")).checks as {lastSuccess:string;lastAttempt:string}[])[0];assert.ok(probe.lastSuccess&&probe.lastAttempt);
 await db.exec("update public.wd_ops_checks set last_success=now()-interval '16 minutes'");await rpc("sweep",{check:"support-poll"});assert.equal(((await rpc("alerts")).events as unknown[]).length,3);
 await rpc("sweep",{check:"support-poll"});assert.equal(((await rpc("alerts")).events as unknown[]).length,3);
 for(const event of (await rpc("alerts")).events as {id:string}[])await rpc("ack",{id:event.id});assert.equal(((await rpc("alerts")).events as unknown[]).length,0);
 }finally{await db.close();}
});
