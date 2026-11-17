import packageData from "./generated-current-successor-catalog.json" with { type: "json" };
import { CURATED_LOCAL_QA_PIN as sourcePin, curatedHouseholdPolicyDescriptor, curatedQaPolicyDescriptor } from "./generated-curated-archive-v13-policy.ts";
import { createCuratedSuccessorReferencePlanner } from "./generated-joined-plan.ts";
import { createCurrentIntegrationReferenceV7, CURRENT_INTEGRATION_REFERENCE_V7_IDENTITY } from "./current-integration-reference-v7.server.ts";
import { createCurrentIntegrationReferenceV9, CURRENT_INTEGRATION_REFERENCE_V9_IDENTITY } from "./current-integration-reference-v9.server.ts";
import { createCurrentIntegrationReferenceV10, CURRENT_INTEGRATION_REFERENCE_V10_IDENTITY } from "./current-integration-reference-v10.server.ts";
import { createCurrentIntegrationReferenceV11, CURRENT_INTEGRATION_REFERENCE_V11_IDENTITY } from "./current-integration-reference-v11.server.ts";
import { createCuratedSuccessorSessionFactory } from "./generated-plan-session.ts";
import { createReferenceSnapshotClockPolicy } from "./generated-source-clock.ts";
import { NEW_WEEK_RECONFIRM_POLICY, type ReferenceStatePortV3, type ReferenceWeekV2 } from "./generated-plan-state.ts";
import { isIssuedVerifiedOwnerScope } from "./generated-owner-scope.ts";
import { sha256Hex } from "./generated-runtime-bytes.ts";
import {
  CURATED_HOUSEHOLD_REFERENCE_REVISION, CURATED_SUCCESSOR_REFERENCE_REVISION, createReviewedReferenceArchive, referenceAdmissionDigest,
  referenceConfigurationDigest, reviewedReferenceDataDigest,
} from "./generated-reviewed-reference-data.ts";
import type { CurrentIntegrationSource, CurrentIntegrationSourceIdentity } from "./current-integration-runtime.server.ts";

const packageSha256 = "72459a5032995f26f304ea4a8b5b7f1797152fb3afd86f243d0801f5afb32b13";
const expectedBasis = "0daff655141bd09a7665a34b1e6a8088ef9fe96661c6b44364cf5473b0dcc17e";

export const CURRENT_INTEGRATION_SUCCESSOR_IDENTITY: CurrentIntegrationSourceIdentity = Object.freeze({
  sourceSha256: sourcePin.sha256,
  sourcePolicyBasisSha256: expectedBasis,
  configurationSha256: "cee3660bf10db9d37862d3392c034008729198a710da7f6212de8dbb9aeeece4",
  reviewedDataSha256: "13d73b205213f85fe2a912134f1346b5b875563c37918015441ed57b8402aa3b",
  evidenceManifestSha256: "1e0b91c6b6cb367eca0cc02a65b1e237fcf48539b4447b50287d0a27ee910b3b",
  guidePolicy: Object.freeze({ version: "wd-curated-one-person-local-qa-v1",
    sha256: "574bce3925f532684fe61a825f5c1deccc1479884f2fa3e3df58016bdb44efc2" }),
  window: Object.freeze({ firstDay: "2026-11-13", lastDay: "2026-11-13", commitBefore: 1794614400000 }),
});

export const CURRENT_INTEGRATION_HOUSEHOLD_IDENTITY: CurrentIntegrationSourceIdentity = Object.freeze({
  ...CURRENT_INTEGRATION_SUCCESSOR_IDENTITY,
  sourcePolicyBasisSha256: "2b17d2bdd29098d9a9216c436b36ed82d2418b89688b4535c5b1be27db755f91",
  reviewedDataSha256: "bd7e7ee019eb468137a7fbf714f78e8511bf930747693953f49430e4a5c03151",
  evidenceManifestSha256: "8a19bf7f781abd771800e8f11fd23451da476df12fcb91275cc6427f3e12f888",
  guidePolicy: Object.freeze({ version: "wd-curated-household-v1",
    sha256: "3b7d9e5230a1f7f6c5ff9ee3ff9eece0f4d5c301fba90085d4cd2f405cda64a3" }),
});

export function createCurrentIntegrationSuccessorReference(now: () => number = Date.now, household = false): CurrentIntegrationSource {
  const encoded = JSON.stringify(packageData);
  if (sha256Hex(encoded) !== packageSha256) throw Error("successor_package_integrity");
  const { source, configuration, labels } = JSON.parse(encoded) as typeof packageData;
  const policy = household ? curatedHouseholdPolicyDescriptor() : curatedQaPolicyDescriptor();
  const expected = household ? CURRENT_INTEGRATION_HOUSEHOLD_IDENTITY : CURRENT_INTEGRATION_SUCCESSOR_IDENTITY;
  const expectedBasis = expected.sourcePolicyBasisSha256;
  const { firstDay, lastDay, region } = policy.scope;
  const clock = createReferenceSnapshotClockPolicy(firstDay, lastDay, now);
  const initial = createCuratedSuccessorReferencePlanner(source, configuration, household);
  if (initial.outcome !== "ready" || initial.sourcePolicyBasis.basisSha256 !== expectedBasis) {
    throw Error("successor_reference_basis");
  }
  const window = Object.freeze({ firstDay, lastDay, commitBefore: clock.commitBefore });
  const manifest = {
    reviewRevision: household ? CURATED_HOUSEHOLD_REFERENCE_REVISION : CURATED_SUCCESSOR_REFERENCE_REVISION, sourcePin,
    configurationSha256: referenceConfigurationDigest(configuration), sourcePolicyBasisSha256: expectedBasis,
    window, regions: [region],
  };
  const body = {
    schema: "wd-reviewed-reference-data-v1" as const, reviewRevision: manifest.reviewRevision, sourcePin,
    configurationSha256: manifest.configurationSha256, configuration, sourcePolicyBasis: initial.sourcePolicyBasis,
    window, regions: manifest.regions, evidenceManifestSha256: referenceAdmissionDigest(manifest),
  };
  const reviewedReferenceData = createReviewedReferenceArchive(
    source, [{ ...body, reviewedDataSha256: reviewedReferenceDataDigest(body) }], [manifest],
  ).current();
  const factory = createCuratedSuccessorSessionFactory(source, configuration, reviewedReferenceData);
  if (factory.outcome !== "ready") throw Error("successor_session_unavailable");
  const guidePolicy = Object.freeze({ version: policy.policy, sha256: referenceConfigurationDigest(policy) });
  const archivedSources = new Map([
    [CURRENT_INTEGRATION_REFERENCE_V7_IDENTITY.sourcePolicyBasisSha256, createCurrentIntegrationReferenceV7],
    [CURRENT_INTEGRATION_REFERENCE_V9_IDENTITY.sourcePolicyBasisSha256, createCurrentIntegrationReferenceV9],
    [CURRENT_INTEGRATION_REFERENCE_V10_IDENTITY.sourcePolicyBasisSha256, createCurrentIntegrationReferenceV10],
    [CURRENT_INTEGRATION_REFERENCE_V11_IDENTITY.sourcePolicyBasisSha256, createCurrentIntegrationReferenceV11],
  ]);
  const predecessors = new Map<string, CurrentIntegrationSource>();
  return Object.freeze({
    sourceSha256: sourcePin.sha256, sourcePolicyBasisSha256: expectedBasis,
    reviewedReferenceData, referenceWindow: window, guidePolicy,
    async bind(owner, transactions) {
      if (!isIssuedVerifiedOwnerScope(owner)) return null;
      const kernel = factory.bind({
        labels, transactions: transactions as unknown as ReferenceStatePortV3,
        resolveScope: () => owner.scope, newWeekPolicy: NEW_WEEK_RECONFIRM_POLICY, newWeekRequestPolicy: clock.check,
        async archivedSavedWeek(week) {
          const basis = (week as ReferenceWeekV2).sourcePolicyBasis.basisSha256;
          const create = week.sourceSha256 === CURRENT_INTEGRATION_REFERENCE_V11_IDENTITY.sourceSha256
            ? archivedSources.get(basis)
            : household && week.sourceSha256 === sourcePin.sha256 && basis === CURRENT_INTEGRATION_SUCCESSOR_IDENTITY.sourcePolicyBasisSha256
              ? createCurrentIntegrationSuccessorReference : undefined;
          if (!create) return undefined;
          const predecessor = predecessors.get(basis) ?? create(now);
          if (predecessor.sourcePolicyBasisSha256 !== basis) return undefined;
          predecessors.set(basis, predecessor);
          const archivedKernel = await predecessor.bind(owner, transactions);
          return archivedKernel?.presentSavedWeek?.(week);
        },
      });
      if (kernel.outcome !== "ready") return null;
      return Object.freeze({
        newWeekCommitBefore: clock.commitBefore,
        presentSavedWeek: kernel.presentSavedWeek,
        async handle(request: Request) {
          const response = await kernel.handle(request);
          response.headers.set("X-WiseDinner-Reference-Through", clock.lastDay);
          response.headers.set("X-WiseDinner-Source", sourcePin.sha256);
          response.headers.set("X-WiseDinner-Guide-Policy", guidePolicy.version);
          response.headers.set("X-WiseDinner-Guide-Policy-Sha256", guidePolicy.sha256);
          try { response.headers.set("X-WiseDinner-Clock-Utc", new Date(now()).toISOString()); } catch { /* Preserve the response. */ }
          return response;
        },
      });
    },
  } satisfies CurrentIntegrationSource);
}
