import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {CURRENT_EMAIL_AUTH_SOURCE_PINS,prepareCurrentEmailAuthChange,prepareCurrentEmailAuthRollback,serializeCurrentEmailAuthChange} from './email-auth-current-source.ts';
import {EMAIL_AUTH_SOURCE_PINS,prepareEmailAuthChange,prepareEmailAuthRollback,canonicalEmailAuthData} from './email-auth-change-plan.ts';
// Reuse the existing exact nonsecret policy test fixture, not an external provider read.
const text=readFileSync(new URL('./email-auth-change-plan.test.ts',import.meta.url),'utf8');
const capture=text.match(/const captured = (\{[\s\S]*?\n\});/);
if(!capture?.[1])throw Error('historical_test_fixture_missing');
const observation:unknown=JSON.parse(capture[1]);
const pins=()=>structuredClone(CURRENT_EMAIL_AUTH_SOURCE_PINS);
const make=()=>prepareCurrentEmailAuthChange(observation,pins());
test('current successor binds repaired account and fixture while preserving exact eleven-field policy',()=>{
 const p=make(),old=prepareEmailAuthChange(observation,EMAIL_AUTH_SOURCE_PINS);
 assert.notEqual(p.operationId,old.operationId);assert.equal(p.sourcePins.backendAccount,'85b337bb5c21ac36d4f40cd3f75684414eab422b698dadd094500e2f4c28fff9');
 for(const k of ['before','expectedNonsecretAfter','fields','smtpPassword','compatibility','holds'] as const)assert.deepEqual(p[k],old[k]);
 assert.equal(Object.keys(p.fields).length,11);assert.equal(p.observationProvenance.freshProviderRead,false);
 assert.equal(p.observationProvenance.state,'HISTORICAL_READ_ONLY_SNAPSHOT');assert.equal(p.dispatchAuthority,'NONE');assert.equal(Object.isFrozen(p),true);
 assert.equal(serializeCurrentEmailAuthChange(p),canonicalEmailAuthData(make()));
});
test('current successor refuses stale account fixture app and SDK bindings rather than adopting them',()=>{
 for(const field of Object.keys(CURRENT_EMAIL_AUTH_SOURCE_PINS))assert.throws(()=>prepareCurrentEmailAuthChange(observation,{...pins(),[field]:'stale'}),/current_source_drift/);
 assert.throws(()=>prepareCurrentEmailAuthChange(observation,EMAIL_AUTH_SOURCE_PINS),/current_source_drift/);
});
test('current envelope corruption forged dispatch and getters cannot grant or serialize a change',()=>{
 const p=make();
 for(const changed of [{...p,dispatchAuthority:'APPROVED'},{...p,operationId:'0'.repeat(64)},{...p,fields:{...p.fields,mailer_otp_length:8}},{...p,observationProvenance:{...p.observationProvenance,freshProviderRead:true}}])assert.throws(()=>serializeCurrentEmailAuthChange(changed),/current_plan_drift/);
 let gets=0;const forged={...p};Object.defineProperty(forged,'before',{enumerable:true,get(){gets++;return p.before;}});
 assert.throws(()=>serializeCurrentEmailAuthChange(forged),/descriptor_shape/);assert.equal(gets,0);
});
test('current known rollback preserves owned nulls and source binding with a distinct forward operation',()=>{
 const p=make(),rollback=prepareCurrentEmailAuthRollback(observation,pins(),p.expectedNonsecretAfter,'known-nonsecret-after'),old=prepareEmailAuthRollback(observation,EMAIL_AUTH_SOURCE_PINS,p.expectedNonsecretAfter,'known-nonsecret-after');
 assert.ok('fields' in rollback&&'fields' in old);if(!('fields' in rollback)||!('fields' in old))throw Error('missing_fields');
 assert.deepEqual(rollback.fields,old.fields);assert.deepEqual(rollback.smtpPassword,old.smtpPassword);
 assert.equal(rollback.forwardOperationId,p.operationId);assert.deepEqual(rollback.sourcePins,pins());assert.equal(rollback.dispatchAuthority,'NONE');
});
test('current unknown outcome holds without a body replay or external request capability',()=>{
 assert.deepEqual(prepareCurrentEmailAuthRollback(observation,pins(),null,'unknown'),{state:'HELD',reason:'unknown-outcome-no-replay',dispatchAuthority:'NONE'});
});
test('current successor retains other actor shared guard template and secret drift refusals',()=>{
 const p=make(),after=structuredClone(p.expectedNonsecretAfter);after.guards.rate_limit_email_sent={present:true,value:5};
 assert.throws(()=>prepareCurrentEmailAuthRollback(observation,pins(),after,'known-nonsecret-after'),/after_drift/);
 assert.throws(()=>prepareCurrentEmailAuthChange({...p.before,smtp_pass:'synthetic-not-a-credential'},pins()),/field_shape/);
 assert.equal(Object.hasOwn(p.fields,'smtp_pass'),false);
 const before=structuredClone(p.before);before.owned.mailer_templates_confirmation_content={present:true,value:'changed'};
 assert.throws(()=>prepareCurrentEmailAuthChange(before,pins()),/template_correspondence/);
});
