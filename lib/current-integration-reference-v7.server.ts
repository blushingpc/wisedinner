import { readCurrentBundledCapsule } from "./current-bundled-capsule.server.ts";
import { createReviewedCurrentSourceBinder } from "./generated-current-reviewed-source.ts";
import { referenceConfigurationDigest } from "./generated-reviewed-reference-data.ts";
import type { CurrentIntegrationSource, CurrentIntegrationSourceIdentity } from "./current-integration-runtime.server.ts";

// Exact private source selection only. Import/construction reads no env, clock,
// provider or source. Main must explicitly configure this identity and factory;
// the actual canonical V5 host selection is deliberately untouched.
const identity = {
  "sourceSha256": "0bfee847772f64713c84914b0e6c988a1a50eb27da0ad0fc120c7d5fd7a443a5",
  "sourcePolicyBasisSha256": "0dc85c145d393eee2487d5bf5e869dfb01111222a2dbb8674bd06ff018f38393",
  "configurationSha256": "7460f4ab419268719a4e5d553dce8bd2ee8f21dbd3f549756cb4859233c55709",
  "reviewedDataSha256": "704f37c2e291a15e80985e126b3395f6304952dc85a644397bacac6f77b23a41",
  "evidenceManifestSha256": "bab17a26220571453e31bc89fcfa00d0ee7d571f7a5e6e09bd4fe6a81c3048f5",
  "guidePolicy": {
    "version": "wd-current-guide-policy-v1",
    "sha256": "be2bfc9b5226a4055ee21b3cd723f5e1cb09a01888109e83dd3c3c0b99105ac4"
  },
  "window": {
    "firstDay": "2026-11-01",
    "lastDay": "2026-11-01",
    "commitBefore": 1793577600000
  }
} as const;
export const CURRENT_INTEGRATION_REFERENCE_V7_IDENTITY: CurrentIntegrationSourceIdentity = Object.freeze({
  ...identity, guidePolicy: Object.freeze(identity.guidePolicy), window: Object.freeze(identity.window),
});
export function createCurrentIntegrationReferenceV7(now: () => number = Date.now): CurrentIntegrationSource {
  // Fixed bundled asset, no filesystem discovery or caller-selected source path.
  const capsule = JSON.parse(readCurrentBundledCapsule("v7", import.meta.url));
  const bound = createReviewedCurrentSourceBinder(capsule, now);
  if (bound.reviewedReferenceData?.reviewRevision !== 7 || !bound.guidePolicy) throw Error("reference_v7_unavailable");
  const p = bound.reviewedReferenceData;
  const actual = { sourceSha256: bound.sourceSha256, sourcePolicyBasisSha256: bound.sourcePolicyBasisSha256,
    configurationSha256: p.configurationSha256, reviewedDataSha256: p.reviewedDataSha256,
    evidenceManifestSha256: p.evidenceManifestSha256, guidePolicy: bound.guidePolicy, window: bound.referenceWindow };
  if (referenceConfigurationDigest(actual) !== referenceConfigurationDigest(CURRENT_INTEGRATION_REFERENCE_V7_IDENTITY)) throw Error("reference_v7_identity_mismatch");
  return Object.freeze({ ...bound, reviewedReferenceData: p, guidePolicy: bound.guidePolicy });
}
