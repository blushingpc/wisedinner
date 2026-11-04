import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { appleDigest } from "./apple-token-custody.server.ts";
import { createCurrentSparseUuidScopeRpcPorts } from "./current-uuid-scope-rpc.server.ts";
import { CURRENT_SPARSE_CATALOG_METADATA } from "./current-sparse-catalog-profile.server.ts";
import type { ScopeObservationRequest } from "./current-auth-scope.server.ts";

const receiptPath = process.env.WD_LOCAL_BACKEND_TEST_ADMISSION;
assert.ok(receiptPath, "Actual exclusive local slot required, never skip");
const slot = JSON.parse(await readFile(receiptPath, "utf8"));
assert.equal(slot.taskId, "backend-production-sparse-v161");
assert.equal(slot.actualExecutorThreadId, "01a14edc-e4d0-7882-9abf-9ccaa2e854b6");
assert.equal(resolve(slot.workspace), resolve(process.cwd()));
assert.ok(Date.parse(slot.validUntil) > Date.now());
const { PGlite } = await import("@electric-sql/pglite");
type Data = Record<string, unknown>;
const A="10000000-0000-4000-8000-000000000001", B="10000000-0000-4000-8000-000000000002", H="a".repeat(64);
const policy={approved:true,version:"wd-owner-uuid-delete-v1",preparedSeconds:600,pendingSeconds:600,recoverySeconds:600,receiptSeconds:600,retainedEvidence:["deletion_receipt","billing_evidence","apple_credential_recovery"]};
const custody={approved:true,version:"synthetic-only",credentialSeconds:600,recoverySeconds:600,evidenceSeconds:3600,retainedEvidence:["apple_credential_recovery"]};

test("recorded sparse baseline then ordered21..30; real natural claim and closed observations",async t=>{
 const db=await PGlite.create();
 try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;grant usage on schema public,auth to anon,authenticated,service_role;
 create function auth.jwt()returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
 create function auth.uid()returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
 create function auth.role()returns text language sql stable as $$select auth.jwt()->>'role'$$;
 create table auth.users(id uuid primary key);
 create table auth.identities(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);
 grant select on auth.users,auth.identities to service_role;
 create schema storage;grant usage on schema storage to service_role;
 create table storage.buckets(id text primary key,owner uuid,owner_id text);
 create table storage.objects(id uuid primary key,name text,owner uuid,owner_id text,user_metadata jsonb);
 create table storage.s3_multipart_uploads(id text primary key,key text,owner_id text,user_metadata jsonb);
 create table storage.s3_multipart_uploads_parts(id uuid primary key,key text,owner_id text);
 grant select on all tables in schema storage to service_role;`);
 const { readdir }=await import("node:fs/promises");
 const directory=new URL("../supabase/migrations/",import.meta.url);
 const names=(await readdir(directory)).filter(n=>/^00\d\d_.*\.sql$/.test(n));
 const apply=async(n:number)=>{const f=names.find(f=>Number(f.slice(0,4))===n);assert.ok(f);await db.exec(await readFile(new URL(f,directory),"utf8"));};
 for(const n of [1,2,3,4,5,6,7,13,14,18,19,20])await apply(n);
 // Exact observed default-result table ACLs only, no invented subsystem.
 const relations=CURRENT_SPARSE_CATALOG_METADATA.relations;
 assert.ok(relations&&typeof relations==="object"&&!Array.isArray(relations));
 for(const name of Object.keys(relations)) await db.exec("grant all on public."+name+" to anon,authenticated,service_role");
 // Independently observed176 view default ACL, not an empty-ACL substitute.
 await db.exec("grant all on public.store_prices to anon,authenticated,service_role");
 for(const name of CURRENT_SPARSE_CATALOG_METADATA.absentRelations)assert.equal((await db.query<{r:string|null}>("select to_regclass($1) r",["public."+name])).rows[0].r,null);
 // Check source function baseline before forward wrappers move/replace names.
 const baseline=await db.query("select proname,encode(sha256(convert_to(prosrc,'UTF8')),'hex') sha from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and left(proname,3)='wd_' order by proname");
 await writeFile(join(dirname(receiptPath!),"source-baseline-functions.json"),JSON.stringify(baseline.rows,null,2));
 const captured=CURRENT_SPARSE_CATALOG_METADATA.baselineFunctions;
 assert.ok(Array.isArray(captured));assert.equal(baseline.rows.length,captured.length);
 for(const row of baseline.rows as {proname:string;sha:string}[]){
  const record: {name:string;metadata:{source_sha256:string}}|undefined=captured.find((v:{name:string})=>v.name===row.proname);
  assert.ok(record);assert.equal(row.sha,record.metadata.source_sha256,"actual maintained baseline matches160 before forward replacements");
 }
 for(let n=21;n<=29;n++)await apply(n);
 // Secure rendering projection from maintained DDL, before any target/observer.
 await db.exec("set search_path=pg_catalog,pg_temp");
 const qualifiedLegacy=await db.query("SELECT 'relation' AS kind,c.relname AS name,jsonb_build_object('owner',pg_get_userbyid(c.relowner),'kind',c.relkind,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'columns',(SELECT jsonb_agg(jsonb_build_array(a.attname,pg_catalog.format_type(a.atttypid,a.atttypmod),a.attnotnull)ORDER BY a.attnum)FROM pg_catalog.pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),'nonowner_grants',(SELECT coalesce(jsonb_agg(jsonb_build_array(coalesce(r.rolname,'PUBLIC'),x.privilege_type,x.is_grantable)ORDER BY coalesce(r.rolname,'PUBLIC'),x.privilege_type),'[]')FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))x LEFT JOIN pg_roles r ON r.oid=x.grantee WHERE x.grantee<>c.relowner),'column_acl',(SELECT coalesce(jsonb_agg(jsonb_build_array(a.attname,a.attacl::text)ORDER BY a.attnum),'[]')FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND a.attacl IS NOT NULL),'policies',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'roles',(SELECT array_agg(coalesce(r.rolname,'PUBLIC')ORDER BY coalesce(r.rolname,'PUBLIC'))FROM unnest(p.polroles)x LEFT JOIN pg_roles r ON r.oid=x),'qual_sha256',encode(sha256(convert_to(coalesce(pg_get_expr(p.polqual,p.polrelid),''),'UTF8')),'hex'),'check_sha256',encode(sha256(convert_to(coalesce(pg_get_expr(p.polwithcheck,p.polrelid),''),'UTF8')),'hex'))ORDER BY p.polname),'[]')FROM pg_policy p WHERE p.polrelid=c.oid),'constraints',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',x.conname,'type',x.contype,'source_sha256',encode(sha256(convert_to(pg_get_constraintdef(x.oid,true),'UTF8')),'hex'))ORDER BY x.conname),'[]')FROM pg_constraint x WHERE x.conrelid=c.oid AND x.contype<>'n'),'triggers',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',t.tgname,'function_schema',pn.nspname,'function',p.proname,'enabled',t.tgenabled,'source_md5',md5(p.prosrc))ORDER BY t.tgname),'[]')FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace WHERE t.tgrelid=c.oid AND NOT t.tgisinternal))AS metadata FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('best_prices','delivery_quotes','receipts','shared_weeks','support_messages','support_messages_v2','support_threads','waitlist','wd_ops_alerts','wd_ops_checks','wd_proposal_plan_documents','wd_proposal_plan_policy','wd_proposal_plan_receipts','wd_proposal_plan_replay','wd_push_projects','wd_support_sends','wd_support_work') ORDER BY c.relname");
 await writeFile(join(dirname(receiptPath!),"source-qualified-legacy.json"),JSON.stringify(qualifiedLegacy.rows,null,2));
 await db.exec("set search_path=public");
 const beforeForward=await db.query("select n.nspname schema,p.proname name,pg_get_function_identity_arguments(p.oid) signature,p.proowner::regrole::text owner,p.prosecdef definer,p.proconfig config,(select coalesce(jsonb_agg(jsonb_build_array(coalesce(r.rolname,'PUBLIC'),x.privilege_type,x.is_grantable) order by coalesce(r.rolname,'PUBLIC'),x.privilege_type),'[]') from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x left join pg_roles r on r.oid=x.grantee where x.grantee<>p.proowner) grants,encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') sha from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','wd_current_private','wd_deletion_v2_private','wd_apple_private') order by n.nspname,p.proname");
 await writeFile(join(dirname(receiptPath!),"source-forward-functions.json"),JSON.stringify(beforeForward.rows,null,2));
 await apply(30);
 async function admin(sql:string,args:unknown[]=[]){
  if(/^rollback\b/i.test(sql)){await db.exec(sql);await db.exec("reset role");return {rows:[] as Data[]};}
  await db.exec("reset role");
  if(sql.includes(";")&&args.length===0){await db.exec(sql);return {rows:[] as Data[]};}
  return db.query<Data>(sql,args);
 }
 async function principal(role="service_role",id=A){await db.exec("reset role");await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role,sub:id,is_anonymous:false,amr:[{method:"password",timestamp:Math.floor(Date.now()/1000)}]})]);await db.exec("set role "+role);}
 async function rpc(name:string,action:string,body:unknown,role="service_role"){await principal(role);return(await db.query<{r:Data}>("select public."+name+"($1,$2::jsonb) r",[action,JSON.stringify(body)])).rows[0].r;}
 async function observe(q:ScopeObservationRequest,name="wd_current_sparse_auth_scope_observe"){await principal();return(await db.query<{r:Data}>("select public."+name+"($1::jsonb) r",[JSON.stringify(q)])).rows[0].r;}
 async function prepare(){
  await admin("insert into auth.users values($1),($2)",[A,B]);await admin("insert into public.wd_accounts(user_id)values($1),($2)",[A,B]);
  const operationId=randomUUID(),owner=randomUUID(),basis=await rpc("wd_apple_deletion_command","effective_basis",{userId:A});
  const original={userId:A,operationId,recoveryHash:H,expectedAccountRevision:1,identityHash:H,identityEvidence:H,appleLinkage:"none",policy,policyHash:appleDigest(policy),intentSha256:H};
  assert.equal((await rpc("wd_apple_deletion_command","admit_original",{original,basis:{userId:A,currentIdentityHash:H,identityEvidence:H,actualApple:"none",effectiveApple:"none",inventoryRevision:basis.revision,inventoryHash:basis.inventoryHash}})).outcome,"admitted");
  assert.equal((await rpc("wd_deletion_v2_account_command","confirm",{operationId,recoveryHash:H,expectedAccountRevision:1,intentSha256:H,confirmation:"DELETE MY ACCOUNT"},"authenticated")).intentState,"confirmed");
  const cmd={operationId,intentSha256:H,owner},work=(await rpc("wd_deletion_v2_worker_command","claim",cmd)).work as Data;
  assert.equal(work.owner,owner);assert.equal(work.attempt,1);
  await rpc("wd_deletion_v2_worker_command","cleanup",{...cmd,attempt:work.attempt});
  await rpc("wd_deletion_v2_worker_command","apple_unavailable",{...cmd,attempt:work.attempt});
  await rpc("wd_deletion_v2_worker_command","begin",{...cmd,attempt:work.attempt,dependency:"auth"});
  const binding={userId:A,identityHash:H,authOperationId:work.auth_operation as string,deletionOperationId:operationId,intentSha256:H,workOwner:owner,workAttempt:work.attempt as number,leaseUntil:work.lease_until as string};
  await principal();const clear=(await db.query<{r:Data}>("select public.wd_current_ephemeral_deletion_receipt_cleanup($1::jsonb)r",[JSON.stringify({...binding,accountRevision:2,policySha256:appleDigest(policy),policy})])).rows[0].r;
  assert.equal(clear.outcome,"cleared");assert.equal(clear.removed,1);
  return {binding,policySha256:appleDigest(policy),authorizationId:randomUUID(),scopeSha256:H,custodyPolicy:custody,custodyPolicySha256:appleDigest(custody)} as ScopeObservationRequest;
 }
 await admin("begin");const q=await prepare();
 await t.test("baseline observed legacy metadata matches159 exactly",async()=>{
  // PG18 duplicate NOT NULL rows are checked separately by the real SQL helper;
  // attnotnull, exact generated names and full constraint text remain bound.
  const actual=await admin("SELECT 'relation' AS kind,c.relname AS name,jsonb_build_object('owner',pg_get_userbyid(c.relowner),'kind',c.relkind,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'columns',(SELECT jsonb_agg(jsonb_build_array(a.attname,pg_catalog.format_type(a.atttypid,a.atttypmod),a.attnotnull)ORDER BY a.attnum)FROM pg_catalog.pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),'nonowner_grants',(SELECT coalesce(jsonb_agg(jsonb_build_array(coalesce(r.rolname,'PUBLIC'),x.privilege_type,x.is_grantable)ORDER BY coalesce(r.rolname,'PUBLIC'),x.privilege_type),'[]')FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))x LEFT JOIN pg_roles r ON r.oid=x.grantee WHERE x.grantee<>c.relowner),'column_acl',(SELECT coalesce(jsonb_agg(jsonb_build_array(a.attname,a.attacl::text)ORDER BY a.attnum),'[]')FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND a.attacl IS NOT NULL),'policies',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'roles',(SELECT array_agg(coalesce(r.rolname,'PUBLIC')ORDER BY coalesce(r.rolname,'PUBLIC'))FROM unnest(p.polroles)x LEFT JOIN pg_roles r ON r.oid=x),'qual_sha256',encode(sha256(convert_to(coalesce(pg_get_expr(p.polqual,p.polrelid),''),'UTF8')),'hex'),'check_sha256',encode(sha256(convert_to(coalesce(pg_get_expr(p.polwithcheck,p.polrelid),''),'UTF8')),'hex'))ORDER BY p.polname),'[]')FROM pg_policy p WHERE p.polrelid=c.oid),'constraints',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',x.conname,'type',x.contype,'source_sha256',encode(sha256(convert_to(pg_get_constraintdef(x.oid,true),'UTF8')),'hex'))ORDER BY x.conname),'[]')FROM pg_constraint x WHERE x.conrelid=c.oid AND x.contype<>'n'),'triggers',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',t.tgname,'function_schema',pn.nspname,'function',p.proname,'enabled',t.tgenabled,'source_md5',md5(p.prosrc))ORDER BY t.tgname),'[]')FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace WHERE t.tgrelid=c.oid AND NOT t.tgisinternal))AS metadata FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('best_prices','delivery_quotes','receipts','shared_weeks','support_messages','support_messages_v2','support_threads','waitlist','wd_ops_alerts','wd_ops_checks','wd_proposal_plan_documents','wd_proposal_plan_policy','wd_proposal_plan_receipts','wd_proposal_plan_replay','wd_push_projects','wd_support_sends','wd_support_work') ORDER BY c.relname");
  const values=Object.fromEntries(actual.rows.map(r=>[r.name,r.metadata]));
  assert.deepEqual(values,CURRENT_SPARSE_CATALOG_METADATA.relations);
 });
 await t.test("176 view shape/24 ACLs and177 maintained definition reproduced without view rows",async()=>{
  const rows=await admin("SELECT 'relation' AS kind,c.relname AS name,jsonb_build_object('owner',pg_get_userbyid(c.relowner),'kind',c.relkind,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'view_options',c.reloptions,'view_definition_sha256',CASE WHEN c.relkind IN('v','m')THEN encode(sha256(convert_to(pg_get_viewdef(c.oid,true),'UTF8')),'hex')ELSE NULL END,'columns',(SELECT jsonb_agg(jsonb_build_array(a.attname,pg_catalog.format_type(a.atttypid,a.atttypmod),a.attnotnull)ORDER BY a.attnum)FROM pg_catalog.pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),'nonowner_grants',(SELECT coalesce(jsonb_agg(jsonb_build_array(coalesce(r.rolname,'PUBLIC'),x.privilege_type,x.is_grantable)ORDER BY coalesce(r.rolname,'PUBLIC'),x.privilege_type),'[]')FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))x LEFT JOIN pg_roles r ON r.oid=x.grantee WHERE x.grantee<>c.relowner),'column_acl',(SELECT coalesce(jsonb_agg(jsonb_build_array(a.attname,a.attacl::text)ORDER BY a.attnum),'[]')FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND a.attacl IS NOT NULL),'policies',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'roles',(SELECT array_agg(coalesce(r.rolname,'PUBLIC')ORDER BY coalesce(r.rolname,'PUBLIC'))FROM unnest(p.polroles)x LEFT JOIN pg_roles r ON r.oid=x),'qual_sha256',encode(sha256(convert_to(coalesce(pg_get_expr(p.polqual,p.polrelid),''),'UTF8')),'hex'),'check_sha256',encode(sha256(convert_to(coalesce(pg_get_expr(p.polwithcheck,p.polrelid),''),'UTF8')),'hex'))ORDER BY p.polname),'[]')FROM pg_policy p WHERE p.polrelid=c.oid),'constraints',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',x.conname,'type',x.contype,'source_sha256',encode(sha256(convert_to(pg_get_constraintdef(x.oid,true),'UTF8')),'hex'))ORDER BY x.conname),'[]')FROM pg_constraint x WHERE x.conrelid=c.oid),'triggers',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',t.tgname,'function_schema',pn.nspname,'function',p.proname,'enabled',t.tgenabled,'source_md5',md5(p.prosrc))ORDER BY t.tgname),'[]')FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace WHERE t.tgrelid=c.oid AND NOT t.tgisinternal))AS metadata FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('best_prices','delivery_quotes','receipts','shared_weeks','store_prices','support_messages','support_messages_v2','support_threads','waitlist','wd_ops_alerts','wd_ops_checks','wd_proposal_plan_documents','wd_proposal_plan_policy','wd_proposal_plan_receipts','wd_proposal_plan_replay','wd_push_jobs','wd_push_projects','wd_push_receipts','wd_push_tokens','wd_support_sends','wd_support_work') ORDER BY c.relname");
  const view=rows.rows.find(r=>r.name==="store_prices");
  assert.ok(view);
  assert.deepEqual(view.metadata,CURRENT_SPARSE_CATALOG_METADATA.observedView);
  // The literal normalization regex contains a semicolon, not multiple SQL statements.
  const proof=await db.query<Data>("SELECT 'relation'AS kind,c.relname AS name,jsonb_build_object('owner',pg_get_userbyid(c.relowner),'options',c.reloptions,'view_definition_sha256',encode(sha256(convert_to(pg_get_viewdef(c.oid,true),'UTF8')),'hex'),'definition_matches_maintained_price_only_view',lower(regexp_replace(replace(replace(replace(pg_get_viewdef(c.oid,true),'public.',''),'prices.',''),'::text',''),'[[:space:]();]','','g'))=$check$selectdistinctonsku_id,store_id,regionsku_id,store_id,region,shelf_price,unit_price,source,confidence,as_offrompricesorderbysku_id,store_id,region,casesourcewhen'receipt'then0when'kroger-api'then1when'walmart-api'then2when'instacart-cart'then3else4end,as_ofdesc$check$,'source_literals',(SELECT array_agg(m[1]ORDER BY ord)FROM regexp_matches(pg_get_viewdef(c.oid,true),'''([^'']*)''','g')WITH ORDINALITY q(m,ord)))AS metadata FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'AND c.relname='store_prices'AND c.relkind='v'");
  assert.deepEqual(proof.rows[0].metadata,CURRENT_SPARSE_CATALOG_METADATA.observedViewProof);
  const observedView=CURRENT_SPARSE_CATALOG_METADATA.observedView;
  assert.ok(observedView&&typeof observedView==="object"&&"nonowner_grants"in observedView);
  assert.ok(Array.isArray(observedView.nonowner_grants));
  assert.equal(observedView.nonowner_grants.length,24);
 });
 await t.test("strict default stays held; sparse facts and local denial through REAL transport are positive",async()=>{
  await principal();
  const diagnostic=(await db.query("select public.wd_current_auth_scope_private($1::jsonb) private,public.wd_current_sparse_legacy_empty($1::jsonb) legacy",[JSON.stringify(q)])).rows;
  await writeFile(join(dirname(receiptPath!),"positive-stage-diagnostic.json"),JSON.stringify(diagnostic,null,2));
  assert.deepEqual(await observe(q,"wd_current_auth_scope_observe"),{outcome:"held"});
  let calls=0;const now=Date.now(),credential=Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url")+"."+Buffer.from(JSON.stringify({role:"service_role",ref:"zpvqxtklvjitofpbddrn",exp:Math.floor(now/1000)+3600})).toString("base64url")+"."+Buffer.alloc(32,1).toString("base64url");
  const ports=createCurrentSparseUuidScopeRpcPorts({origin:"https://zpvqxtklvjitofpbddrn.supabase.co",serverCredential:credential,expectedRequest:q,now:Date.now,async request(url,init){calls++;const name=new URL(String(url)).pathname.split("/").at(-1)!;assert.ok(["wd_current_sparse_auth_scope_observe","wd_current_sparse_local_deletion_barrier"].includes(name));return Response.json(await observe(JSON.parse(String(init?.body)).p_body,name));}});
  const facts=await ports.observe(q) as Data;assert.equal(facts.contract,"wd-current-auth-scope-observation-v2",JSON.stringify(facts));assert.equal(facts.accountRevision,2);assert.equal(facts.unclassifiedReferences,0);assert.equal(facts.writeFence,null);
  const denial=await ports.observeLocalDenial(q) as Data;assert.equal(denial.contract,"wd-current-local-delete-scope-v1",JSON.stringify(denial));assert.equal(denial.profile,"wd-owner-uuid-delete-v1");assert.equal(denial.providerPredicate,"account-uuid-only");assert.equal(calls,2);
  assert.equal((await admin("select count(*)::int n from wd_apple_private.auth_attempts")).rows[0].n,0);
 });
 for(const[name,sql]of Object.entries({
  viewMissingGrant:"revoke select on public.store_prices from anon",
  viewPublicGrant:"grant select on public.store_prices to public",
  viewGrantOption:"grant select on public.store_prices to authenticated with grant option",
  viewInvoker:"alter view public.store_prices set(security_invoker=false)",
  viewUnknownOption:"alter view public.store_prices set(security_barrier=true)",
  viewOwner:"alter view public.store_prices owner to authenticated",
  viewColumn:"alter view public.store_prices rename column region to unknown_region",
  viewColumnAcl:"grant select(sku_id) on public.store_prices to public",
  viewDefinition:"create or replace view public.store_prices with(security_invoker=true) as select distinct on(sku_id,store_id,region) sku_id,store_id,region,shelf_price,unit_price,source,confidence,as_of from public.prices order by sku_id,store_id,region,as_of desc",
  absentObject:"create table public.wd_support_sends(id text)",
  absentView:"create view public.best_prices as select 1 as value",
  rls:"alter table public.waitlist disable row level security",
  forceRls:"alter table public.waitlist force row level security",
  column:"alter table public.waitlist add column unknown text",
  policy:"create policy unknown on public.waitlist using(true)",
  acl:"grant select on public.waitlist to public",
  functionAcl:"grant execute on function public.wd_account_command__pre0027(text,jsonb,uuid) to public",
  additiveAcl:"grant execute on function public.wd_current_sparse_auth_scope_observe(jsonb) to public",
  additiveOverload:"create function public.wd_current_sparse_auth_scope_observe(text)returns jsonb language sql as $$select '{}'::jsonb$$",
  privateFunctionBody:"create or replace function public.wd_current_auth_scope_private(p_body jsonb)returns jsonb language plpgsql security definer set search_path='' as $$begin return '{}'::jsonb;end$$",
  notNullConstraint:"alter table public.waitlist rename constraint waitlist_email_not_null to unknown_not_null",
  trigger:"create function public.synthetic_trigger()returns trigger language plpgsql as $$begin return new;end$$;create trigger unknown before insert on public.waitlist for each row execute function public.synthetic_trigger()",
  constraint:"alter table public.waitlist drop constraint waitlist_email_key",
  owner:"alter table public.waitlist owner to authenticated",
  functionBody:"create or replace function public.wd_current_reviewed_legacy_empty(p_body jsonb)returns boolean language plpgsql security definer set search_path='' as $$begin return true;end$$",
  overload:"create function public.wd_current_auth_scope_observe(text)returns jsonb language sql as $$select '{}'::jsonb$$",
  unknownTable:"create table public.unclassified_account_rows(owner_id uuid)",
  unknownFunction:"create function public.wd_unknown()returns boolean language sql as $$select true$$",
  nonemptyForeign:"insert into public.waitlist(email,source,quiz)values('synthetic@example.invalid','fixture',jsonb_build_object('userId','"+B+"'))",
  expiredLease:"update public.wd_deletion_work set lease_until=now()-interval '1 second'",
  wrongAttempt:"update public.wd_deletion_work set attempt=attempt+1",
  wrongOwner:"update public.wd_deletion_work set owner=gen_random_uuid()",
  revision:"update public.wd_accounts set revision=revision+1",
  intent:"update wd_deletion_v2_private.intents set intent_hash=repeat('b',64)"
 }))await t.test("actual sparse SQL denies "+name,async()=>{await admin("savepoint negative");try{await admin(sql);assert.deepEqual(await observe(q),{outcome:"held"});}finally{await admin("rollback to negative");}});
 for(const patch of [{binding:{...q.binding,userId:B}},{binding:{...q.binding,intentSha256:"b".repeat(64)}},{policySha256:"b".repeat(64)}])await t.test("wrong private target/original/policy stays held",async()=>assert.deepEqual(await observe({...q,...patch}),{outcome:"held"}));
 await t.test("new RPCs are not anonymous/authenticated grants; strict functions remain unchanged",async()=>{
  for(const role of ["anon","authenticated"]){await admin("savepoint denied");try{await principal(role);await assert.rejects(db.query("select public.wd_current_sparse_auth_scope_observe($1::jsonb)",[JSON.stringify(q)]),(e:unknown)=>!!e&&typeof e==="object"&&"code"in e&&e.code==="42501");}finally{await admin("rollback to denied");}}
 });
 await admin("rollback");
 }finally{await db.close();}
});
