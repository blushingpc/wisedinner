import {readCurrentBundledCapsule} from "./current-bundled-capsule.server.ts";
import {createReviewedCurrentSourceBinder} from "./generated-current-reviewed-source.ts";
import {referenceConfigurationDigest} from "./generated-reviewed-reference-data.ts";
import type {CurrentIntegrationSource,CurrentIntegrationSourceIdentity} from "./current-integration-runtime.server.ts";
// New source-policy/code family. Original V9 capsule/date/price data remain unchanged.
const fixed = {
  "sourceSha256": "33e1dba41e08bec489b195a4febfe15f3e4d90f42066d763c9d0451fa9c4ecf9",
  "sourcePolicyBasisSha256": "6ca4a99713af8651eca713aa6e7f2fb60cd9238d5c1e32091a9efc0102688d7b",
  "configurationSha256": "d84f9cf6068453dfb855b7811eb20280e3642f0043ba573b959364ee0dabbd45",
  "reviewedDataSha256": "7aeef93df28463945977462d5083843cde35b44d19c60d75180b3277e512a2b8",
  "evidenceManifestSha256": "fbdaaa461122d19579cc1e68ddaa39ae5ed9d03f6ce145a78307a9305f3a1719",
  "guidePolicy": {
    "version": "wd-current-guide-policy-v1",
    "sha256": "113665b6ae58247c88a2b188de0854e679363171a8ee2a41f4714c8f74a9fbc7"
  },
  "window": {
    "firstDay": "2026-11-02",
    "lastDay": "2026-11-08",
    "commitBefore": 1794182400000
  }
} as const;
export const CURRENT_INTEGRATION_REFERENCE_V10_IDENTITY:CurrentIntegrationSourceIdentity=Object.freeze({...fixed,guidePolicy:Object.freeze(fixed.guidePolicy),window:Object.freeze(fixed.window)});
export function createCurrentIntegrationReferenceV10(now:()=>number=Date.now):CurrentIntegrationSource{
 const bound=createReviewedCurrentSourceBinder(JSON.parse(readCurrentBundledCapsule("v9",import.meta.url)),now,true);
 const p=bound.reviewedReferenceData;if(!p||p.reviewRevision!==10||!bound.guidePolicy)throw Error("profile_reference_unavailable");
 const actual={sourceSha256:bound.sourceSha256,sourcePolicyBasisSha256:bound.sourcePolicyBasisSha256,configurationSha256:p.configurationSha256,reviewedDataSha256:p.reviewedDataSha256,evidenceManifestSha256:p.evidenceManifestSha256,guidePolicy:bound.guidePolicy,window:bound.referenceWindow};
 if(referenceConfigurationDigest(actual)!==referenceConfigurationDigest(CURRENT_INTEGRATION_REFERENCE_V10_IDENTITY))throw Error("profile_reference_identity_mismatch");
 return Object.freeze({...bound,reviewedReferenceData:p,guidePolicy:bound.guidePolicy});
}
