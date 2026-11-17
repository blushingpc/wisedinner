import {
  CURRENT_INTEGRATION_REBUILT_IDENTITY,
  CURRENT_INTEGRATION_REBUILT_REVISION,
} from "./current-integration-rebuilt-identity.server.ts";
import type { CurrentIntegrationSource, CurrentIntegrationSourceIdentity } from "./current-integration-runtime.server.ts";
import { referenceConfigurationDigest } from "./generated-reviewed-reference-data.ts";

export async function createCurrentIntegrationRebuiltReference(now: () => number = Date.now): Promise<CurrentIntegrationSource> {
  const { createFixedRebuiltBinder } = await import("./fixed-rebuilt-binder.ts");
  const bound = await createFixedRebuiltBinder(now);
  const reference = bound.reviewedReferenceData;
  const actual: CurrentIntegrationSourceIdentity = {
    sourceSha256: bound.sourceSha256,
    sourcePolicyBasisSha256: bound.sourcePolicyBasisSha256,
    configurationSha256: reference.configurationSha256,
    reviewedDataSha256: reference.reviewedDataSha256,
    evidenceManifestSha256: reference.evidenceManifestSha256,
    guidePolicy: bound.guidePolicy,
    window: bound.referenceWindow,
  };
  if (reference.reviewRevision !== CURRENT_INTEGRATION_REBUILT_REVISION ||
      referenceConfigurationDigest(actual) !== referenceConfigurationDigest(CURRENT_INTEGRATION_REBUILT_IDENTITY)) {
    throw Error("rebuilt_reference_identity_mismatch");
  }
  return bound;
}
