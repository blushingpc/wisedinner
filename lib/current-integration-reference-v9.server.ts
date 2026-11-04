import { readCurrentBundledCapsule } from "./current-bundled-capsule.server.ts";
import { createReviewedCurrentSourceBinder } from "./generated-current-reviewed-source.ts";
import { referenceConfigurationDigest } from "./generated-reviewed-reference-data.ts";
import type { CurrentIntegrationSource, CurrentIntegrationSourceIdentity } from "./current-integration-runtime.server.ts";

// Exact private source selection only. Import/construction reads no env, clock,
// provider or source. Main must explicitly configure this identity and factory;
// the actual canonical V5 host selection is deliberately untouched.
const identity = {
  "sourceSha256": "33e1dba41e08bec489b195a4febfe15f3e4d90f42066d763c9d0451fa9c4ecf9",
  "sourcePolicyBasisSha256": "598d01f89535091345c4727422c74654f70de49db170729b27787ab59bd51ea1",
  "configurationSha256": "d84f9cf6068453dfb855b7811eb20280e3642f0043ba573b959364ee0dabbd45",
  "reviewedDataSha256": "cfe49e82537927bbab054f930c335bff8b667db6284dccc95a82428d24240cb3",
  "evidenceManifestSha256": "3539fd624f3a063a8aae848af1906cc855766563e4f662db3cbb463d2c3c85bd",
  "guidePolicy": {
    "version": "wd-current-guide-policy-v1",
    "sha256": "d13d721f10e36b9dd76fe8a5d57c5989daa695ede7193b3bc73e535899340bbb"
  },
  "window": {
    "firstDay": "2026-11-02",
    "lastDay": "2026-11-08",
    "commitBefore": 1794182400000
  }
} as const;
export const CURRENT_INTEGRATION_REFERENCE_V9_IDENTITY: CurrentIntegrationSourceIdentity = Object.freeze({
  ...identity, guidePolicy: Object.freeze(identity.guidePolicy), window: Object.freeze(identity.window),
});
export function createCurrentIntegrationReferenceV9(now: () => number = Date.now): CurrentIntegrationSource {
  // Fixed bundled asset, no filesystem discovery or caller-selected source path.
  const capsule = JSON.parse(readCurrentBundledCapsule("v9", import.meta.url));
  const bound = createReviewedCurrentSourceBinder(capsule, now);
  if (bound.reviewedReferenceData?.reviewRevision !== 9 || !bound.guidePolicy) throw Error("reference_v9_unavailable");
  const p = bound.reviewedReferenceData;
  const actual = { sourceSha256: bound.sourceSha256, sourcePolicyBasisSha256: bound.sourcePolicyBasisSha256,
    configurationSha256: p.configurationSha256, reviewedDataSha256: p.reviewedDataSha256,
    evidenceManifestSha256: p.evidenceManifestSha256, guidePolicy: bound.guidePolicy, window: bound.referenceWindow };
  if (referenceConfigurationDigest(actual) !== referenceConfigurationDigest(CURRENT_INTEGRATION_REFERENCE_V9_IDENTITY)) throw Error("reference_v9_identity_mismatch");
  return Object.freeze({ ...bound, reviewedReferenceData: p, guidePolicy: bound.guidePolicy });
}
