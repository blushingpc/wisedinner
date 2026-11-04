import { readFileSync } from "node:fs";
import { createReviewedCurrentSourceBinder } from "./generated-current-reviewed-source.ts";
import { referenceConfigurationDigest } from "./generated-reviewed-reference-data.ts";
import type { CurrentIntegrationSource, CurrentIntegrationSourceIdentity } from "./current-integration-runtime.server.ts";

// Exact private source selection only. Import/construction reads no env, clock,
// provider or source. Main must explicitly configure this identity and factory;
// the actual canonical V5 host selection is deliberately untouched.
const identity = {
  "sourceSha256": "4c4e64e9c7030ac588cd665a16786620a066d23c7fc409a086d12ac3d393051c",
  "sourcePolicyBasisSha256": "dd0a41f0d18db6b72750ae9e6c26966d8e16d28bfe9960f98ba6698dceaa18e2",
  "configurationSha256": "2f673b2c4796a69746a48afc18a6a17fa494cf38c57b5bcc99aa51c5d335de3d",
  "reviewedDataSha256": "ce0df591d426a90653b396224cb6fc898589842e1ab5c921de725ca002cba913",
  "evidenceManifestSha256": "fad4c0b9d9982d5b2c43687ac9164e0bd2fbc2d13893a4a5b5f781db98471688",
  "guidePolicy": {
    "version": "wd-current-guide-policy-v1",
    "sha256": "c8c48431db80c0bb0114d3e0ca0087412aacd0ff9ceb1e1e7f61ac14c7cc7910"
  },
  "window": {
    "firstDay": "2026-11-01",
    "lastDay": "2026-11-01",
    "commitBefore": 1793577600000
  }
} as const;
export const CURRENT_INTEGRATION_REFERENCE_V6_IDENTITY: CurrentIntegrationSourceIdentity = Object.freeze({
  ...identity, guidePolicy: Object.freeze(identity.guidePolicy), window: Object.freeze(identity.window),
});
export function createCurrentIntegrationReferenceV6(now: () => number = Date.now): CurrentIntegrationSource {
  // Fixed bundled asset, no filesystem discovery or caller-selected source path.
  const capsule = JSON.parse(readFileSync(new URL("./generated-current-source-capsule-v6.json", import.meta.url), "utf8"));
  const bound = createReviewedCurrentSourceBinder(capsule, now);
  if (bound.reviewedReferenceData?.reviewRevision !== 6 || !bound.guidePolicy) throw Error("reference_v6_unavailable");
  const p = bound.reviewedReferenceData;
  const actual = { sourceSha256: bound.sourceSha256, sourcePolicyBasisSha256: bound.sourcePolicyBasisSha256,
    configurationSha256: p.configurationSha256, reviewedDataSha256: p.reviewedDataSha256,
    evidenceManifestSha256: p.evidenceManifestSha256, guidePolicy: bound.guidePolicy, window: bound.referenceWindow };
  if (referenceConfigurationDigest(actual) !== referenceConfigurationDigest(CURRENT_INTEGRATION_REFERENCE_V6_IDENTITY)) throw Error("reference_v6_identity_mismatch");
  return Object.freeze({ ...bound, reviewedReferenceData: p, guidePolicy: bound.guidePolicy });
}
