import test from 'node:test';
import assert from 'node:assert/strict';
import {assertSources,assertFixtureSource,parserFixture,complete,empty,draft,A} from './owner-plan.fixture.ts';
import {readFileSync} from 'node:fs';
import {canonical} from './owner-plan-codec.ts';

test('legacy fixture statically admits exactly the reviewed current source bytes',()=>{assert.doesNotThrow(assertSources);});
test('static fixture byte comparison refuses wrong hash length and same-length changed source',()=>{
 for(const p of [
  {file:'billing.ts',bytes:16178,sha256:'f2db32fb4ab492df979e754843c0a934f63c5e74a45bf6ca32345cec920bab9b'},
  {file:'planner-state.ts',bytes:21708,sha256:'dad6a958732af9245c0ace6f55014ffea782762763a237270f931646620d5708'}]){
  const bytes=readFileSync(new URL('../../wisedinner-app/src/account/'+p.file,import.meta.url));
  assert.doesNotThrow(()=>assertFixtureSource(bytes,p));
  assert.throws(()=>assertFixtureSource(bytes,{...p,sha256:'0'.repeat(64)}),/App fixture source changed/);
  assert.throws(()=>assertFixtureSource(bytes,{...p,bytes:p.bytes+1}),/App fixture source changed/);
  const changed=Buffer.from(bytes);changed[0]=changed[0]===32?33:32;
  assert.throws(()=>assertFixtureSource(changed,p),/App fixture source changed/);
 }
});
test('current real legacy parser preserves complete empty draft cents pantry nutrients list and checks',async()=>{
 const f=await parserFixture(A);
 try {
  for(const state of [complete(),empty(),draft()]){
   const expected=canonical(state);
   assert.equal(canonical(await f.planner.save(f.planner.begin(),state)),expected);
   assert.equal(canonical(await f.planner.hydrate(f.planner.begin())),expected);
  }
  const full=complete();assert.equal(full.answers!.budget,64.01);assert.equal(full.answers!.pantry[0]!.qty,0.5);
  assert.deepEqual(Object.keys(full).sort(),['answers','checks','draft','week']);
 } finally {f.dispose();}
});
test('legacy parser refuses reviewed equipment cloud authority and corrupt state as extra fields',async()=>{
 const f=await parserFixture(A);
 try {
  for(const extra of [{family:'wd-reviewed-owner-plan-local-candidate',version:1},{equipment:['stove']},{cloudCommit:{serverRevision:1}},{owner:A}])
   await assert.rejects(f.planner.save(f.planner.begin(),{...empty(),...extra}));
  const corrupt=complete();corrupt.week!.result.days[0]!.protein_g++;
  await assert.rejects(f.planner.save(f.planner.begin(),corrupt));
 } finally {f.dispose();}
});
