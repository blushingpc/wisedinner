import {readCurrentBundledCapsule} from "./current-bundled-capsule.server.ts";
import {createReviewedCurrentSourceBinder} from "./generated-current-reviewed-source.ts";
import {referenceConfigurationDigest} from "./generated-reviewed-reference-data.ts";
import type {CurrentIntegrationSource,CurrentIntegrationSourceIdentity} from "./current-integration-runtime.server.ts";
// New source-policy/code family. Documentary11admission; originalV9/V10capsules,sourcefactsanddates remain unchanged.
const fixed = {
  "sourceSha256": "33e1dba41e08bec489b195a4febfe15f3e4d90f42066d763c9d0451fa9c4ecf9",
  "sourcePolicyBasisSha256": "6ca4a99713af8651eca713aa6e7f2fb60cd9238d5c1e32091a9efc0102688d7b",
  "configurationSha256": "d84f9cf6068453dfb855b7811eb20280e3642f0043ba573b959364ee0dabbd45",
  "reviewedDataSha256": "a7f747e01c4440d12b517658fc89bd8dc11ffa10e78e5330c3924a52eaad8038",
  "evidenceManifestSha256": "6f581bc46574da7ddf1df179f609b066f85350894f460a63fe421c0c340c764d",
  "guidePolicy": {
    "version": "wd-current-guide-policy-v1",
    "sha256": "113665b6ae58247c88a2b188de0854e679363171a8ee2a41f4714c8f74a9fbc7"
  },
  "window": {
    "firstDay": "2026-11-02",
    "lastDay": "2026-11-15",
    "commitBefore": 1794787200000
  }
} as const;
export const CURRENT_INTEGRATION_REFERENCE_V11_IDENTITY:CurrentIntegrationSourceIdentity=Object.freeze({...fixed,guidePolicy:Object.freeze(fixed.guidePolicy),window:Object.freeze(fixed.window)});
export function createCurrentIntegrationReferenceV11(now:()=>number=Date.now):CurrentIntegrationSource{
 const bound=createReviewedCurrentSourceBinder(JSON.parse(readCurrentBundledCapsule("v11",import.meta.url)),now,true);
 const p=bound.reviewedReferenceData;if(!p||p.reviewRevision!==11||!bound.guidePolicy)throw Error("profile_reference_unavailable");
 const actual={sourceSha256:bound.sourceSha256,sourcePolicyBasisSha256:bound.sourcePolicyBasisSha256,configurationSha256:p.configurationSha256,reviewedDataSha256:p.reviewedDataSha256,evidenceManifestSha256:p.evidenceManifestSha256,guidePolicy:bound.guidePolicy,window:bound.referenceWindow};
 if(referenceConfigurationDigest(actual)!==referenceConfigurationDigest(CURRENT_INTEGRATION_REFERENCE_V11_IDENTITY))throw Error("profile_reference_identity_mismatch");
 return Object.freeze({...bound,reviewedReferenceData:p,guidePolicy:bound.guidePolicy});
}
