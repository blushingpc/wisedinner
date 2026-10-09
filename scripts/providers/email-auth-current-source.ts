import {createHash} from 'node:crypto';
import {EMAIL_AUTH_SOURCE_PINS,canonicalEmailAuthData,prepareEmailAuthChange,prepareEmailAuthRollback} from './email-auth-change-plan.ts';

// LOCAL preparation only. No provider client, credential loader or execution path.
export const CURRENT_EMAIL_AUTH_SOURCE_PINS=Object.freeze({
 backendCommit:'ea5ed119bb70296cca50c8e9ad75c44fb03f9fd5',appCommit:'83d35f7619194c12bcc23eab69ee855c45883a7c',
 backendAccount:'85b337bb5c21ac36d4f40cd3f75684414eab422b698dadd094500e2f4c28fff9',
 ownerFixture:'aed010092954fe6db8858db087be3940acd83a81dfa40b61cacdc7717ddcb1a4',
 billing:'f2db32fb4ab492df979e754843c0a934f63c5e74a45bf6ca32345cec920bab9b',
 plannerState:'dad6a958732af9245c0ace6f55014ffea782762763a237270f931646620d5708',
 nativeSdk:'19a19e274c7355aac2354d1d80de4a54b29a567ca06526040f786c96fa293352',
 session:'1a38eabf3970c974850c3807c99756ad42311db2dc94ba1600ea0a6a9458c609',
 installedAuthSdk:'7552500e375665e28acf23fb552ccbf1ef11379afab15859b2f670f1ae9aee9f',authSdkVersion:'2.117.3',
});
const POLICY_SHA='4a0697d00c4060ea2f94f48470120a2a77d408b32cdf7cc0d56a32e13a1c2fea';
const hash=(v:unknown)=>createHash('sha256').update(canonicalEmailAuthData(v)).digest('hex');
function bind(pins:unknown){if(canonicalEmailAuthData(pins)!==canonicalEmailAuthData(CURRENT_EMAIL_AUTH_SOURCE_PINS))throw Error('current_source_drift');}
function freeze<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
export function prepareCurrentEmailAuthChange(observation:unknown,sourcePins:unknown){
 bind(sourcePins);
 // Old source pins identify historical template policy only, never current API acceptance.
 const policy=prepareEmailAuthChange(observation,EMAIL_AUTH_SOURCE_PINS);
 const body={contract:'wd-email-auth-current-source-plan-local-v1',project:policy.project,
  sourcePins:CURRENT_EMAIL_AUTH_SOURCE_PINS,policyOrigin:{builderSha256:POLICY_SHA,historicalSourcePins:EMAIL_AUTH_SOURCE_PINS},
  observationProvenance:{state:'HISTORICAL_READ_ONLY_SNAPSHOT',observedAt:policy.before.observedAt,freshProviderRead:false},
  before:policy.before,expectedNonsecretAfter:policy.expectedNonsecretAfter,fields:policy.fields,
  smtpPassword:policy.smtpPassword,compatibility:policy.compatibility,holds:policy.holds,
  proofLevel:'LOCAL',state:'PREPARED_HELD',dispatchAuthority:'NONE'};
 return freeze({...body,operationId:hash(body)});
}
export function serializeCurrentEmailAuthChange(value:unknown):string{
 const bytes=canonicalEmailAuthData(value),parsed:unknown=JSON.parse(bytes);
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||!('before' in parsed)||!('sourcePins' in parsed))throw Error('current_plan_shape');
 const expected=prepareCurrentEmailAuthChange(parsed.before,parsed.sourcePins);
 if(bytes!==canonicalEmailAuthData(expected))throw Error('current_plan_drift');
 return bytes;
}
export function prepareCurrentEmailAuthRollback(observation:unknown,sourcePins:unknown,currentAfter:unknown,outcome:'known-nonsecret-after'|'unknown'){
 const forward=prepareCurrentEmailAuthChange(observation,sourcePins);
 const original=prepareEmailAuthRollback(observation,EMAIL_AUTH_SOURCE_PINS,currentAfter,outcome);
 if(!('fields' in original))return original;
 return freeze({contract:'wd-email-auth-current-source-rollback-local-v1',project:original.project,
  sourcePins:CURRENT_EMAIL_AUTH_SOURCE_PINS,forwardOperationId:forward.operationId,fields:original.fields,
  smtpPassword:original.smtpPassword,holds:original.holds,state:'PREPARED_HELD',proofLevel:'LOCAL',dispatchAuthority:'NONE'});
}
