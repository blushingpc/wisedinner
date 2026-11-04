import { readCurrentBundledCapsule } from "./current-bundled-capsule.server.ts";
import { createReviewedCurrentSourceBinder } from "./generated-current-reviewed-source.ts";
import { referenceConfigurationDigest } from "./generated-reviewed-reference-data.ts";
import type { CurrentIntegrationSource, CurrentIntegrationSourceIdentity } from "./current-integration-runtime.server.ts";

// Exact private source selection only. Import/construction reads no env, clock,
// provider or source. Main must explicitly configure this identity and factory;
// the existing host's default V4 loader is deliberately untouched.
const identity = {
  "sourceSha256": "4c4e64e9c7030ac588cd665a16786620a066d23c7fc409a086d12ac3d393051c",
  "sourcePolicyBasisSha256": "defcd71a6a55162049be3ec9b311c4cd952fa6dd9cd5b7ebcf692440b06d5de1",
  "configurationSha256": "cb9d5965ac9c81a9c6a28dee3aaf598b556d2fda5ef956609a32d9afdebbe027",
  "reviewedDataSha256": "6f8084cfd4f14529c835442f691cd1a310ea1fba0c8ae1efc2e523bc7240b8be",
  "evidenceManifestSha256": "fa20242d4c7ee71ecd21a0f8ded3b735b1f1c8c6f110db008283f6a77b1d75a4",
  "guidePolicy": {
    "version": "wd-current-guide-policy-v1",
    "sha256": "90d6f9e1453a910513d6adeaf29997e52fc943e01ce189cf0bb07cb6aeab45bc"
  },
  "window": {
    "firstDay": "2026-11-01",
    "lastDay": "2026-11-30",
    "commitBefore": 1796083200000
  }
} as const;
export const CURRENT_INTEGRATION_REFERENCE_V5_IDENTITY: CurrentIntegrationSourceIdentity = Object.freeze({
  ...identity, guidePolicy: Object.freeze(identity.guidePolicy), window: Object.freeze(identity.window),
});
export function createCurrentIntegrationReferenceV5(now: () => number = Date.now): CurrentIntegrationSource {
  // Fixed bundled asset, no filesystem discovery or caller-selected source path.
  const capsule = JSON.parse(readCurrentBundledCapsule("v5", import.meta.url));
  const bound = createReviewedCurrentSourceBinder(capsule, now);
  if (bound.reviewedReferenceData?.reviewRevision !== 5 || !bound.guidePolicy) throw Error("reference_v5_unavailable");
  const p = bound.reviewedReferenceData;
  const actual = { sourceSha256: bound.sourceSha256, sourcePolicyBasisSha256: bound.sourcePolicyBasisSha256,
    configurationSha256: p.configurationSha256, reviewedDataSha256: p.reviewedDataSha256,
    evidenceManifestSha256: p.evidenceManifestSha256, guidePolicy: bound.guidePolicy, window: bound.referenceWindow };
  if (referenceConfigurationDigest(actual) !== referenceConfigurationDigest(CURRENT_INTEGRATION_REFERENCE_V5_IDENTITY)) throw Error("reference_v5_identity_mismatch");
  return Object.freeze({ ...bound, reviewedReferenceData: p, guidePolicy: bound.guidePolicy });
}
