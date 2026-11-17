import * as strictPolicy from "./generated-curated-strict-archive-policy.ts";
import strictConfiguration from "./generated-curated-strict-archive-configuration.json" with { type: "json" };
import packageData from "./generated-current-dietary-catalog.json" with { type: "json" };
import archiveMethodPackage from "./generated-current-dietary-catalog-method-archive.json" with { type: "json" };
import { CURATED_LOCAL_QA_PIN as archiveMethodPin } from "./generated-curated-archive-method-policy.ts";
import archiveDietaryPackage from "./generated-current-dietary-catalog-previous.json" with { type: "json" };
import { CURATED_LOCAL_QA_PIN as archiveDietaryPin } from "./generated-curated-archive-dietary-policy.ts";
import southArchiveConfiguration from "./generated-curated-south-archive-configuration-previous.json" with { type: "json" };
import { CURATED_LOCAL_QA_PIN as sourcePin, CURATED_SOUTH_ARCHIVE_BASIS, curatedHouseholdPolicyDescriptor } from "./generated-curated-successor-policy.ts";
import { createCuratedSouthArchivePlanner, createCuratedSuccessorReferencePlanner, createCuratedStrictArchivePlanner, CURATED_STRICT_ARCHIVE_BASIS } from "./generated-joined-plan.ts";
import { createCurrentIntegrationReferenceV7, CURRENT_INTEGRATION_REFERENCE_V7_IDENTITY } from "./current-integration-reference-v7.server.ts";
import { createCurrentIntegrationReferenceV9, CURRENT_INTEGRATION_REFERENCE_V9_IDENTITY } from "./current-integration-reference-v9.server.ts";
import { createCurrentIntegrationReferenceV10, CURRENT_INTEGRATION_REFERENCE_V10_IDENTITY } from "./current-integration-reference-v10.server.ts";
import { createCurrentIntegrationReferenceV11, CURRENT_INTEGRATION_REFERENCE_V11_IDENTITY } from "./current-integration-reference-v11.server.ts";
import { bindArchivedWeekPresenter, createCuratedSuccessorSessionFactory } from "./generated-plan-session.ts";
import { createReferenceSnapshotClockPolicy } from "./generated-source-clock.ts";
import { NEW_WEEK_RECONFIRM_POLICY, type ReferenceStatePortV3, type ReferenceWeekV2 } from "./generated-plan-state.ts";
import { isIssuedVerifiedOwnerScope } from "./generated-owner-scope.ts";
import { sha256Hex } from "./generated-runtime-bytes.ts";
import {
  CURATED_DIETARY_REFERENCE_REVISION, createReviewedReferenceArchive, referenceAdmissionDigest,
  referenceConfigurationDigest, reviewedReferenceDataDigest,
} from "./generated-reviewed-reference-data.ts";
import type { CurrentIntegrationSource, CurrentIntegrationSourceIdentity } from "./current-integration-runtime.server.ts";

import { createCurrentIntegrationSuccessorReference, CURRENT_INTEGRATION_SUCCESSOR_IDENTITY, CURRENT_INTEGRATION_HOUSEHOLD_IDENTITY } from "./current-integration-reference-successor.server.ts";
const packageSha256 = "295103126ee947ede3dfff9d7a106f3d6719e84bc4c7fb654fca7e9a15bd9ece";
const registrySha256 = "585fe4651be5ee9ff0fb420b3fc7ca4abc02f1e0fc6cf89320dd714bf04a3f75";

export const CURRENT_INTEGRATION_DIETARY_IDENTITY: CurrentIntegrationSourceIdentity = Object.freeze({
  sourceSha256: sourcePin.sha256,
  sourcePolicyBasisSha256: "0a2ad38696b4037f3700b0456654e891b9ba05ebbf45b90bfdaef688b06d0aa6",
  configurationSha256: "7c0ad63639b2e5b73ed7b5b7862c4dbcdf4814de2ec034ba33c34fa4db3af024",
  reviewedDataSha256: "5baa8f785fb512361607c01b4dfaf8ae2df7e39ef36530ea2eaada4324a01a3f",
  evidenceManifestSha256: "98a26abb48960509b000ae47a546cdc99b72ff62103cf513b93e40400274c428",
  guidePolicy: Object.freeze({"version":"wd-curated-household-v1","sha256":"d235a675359e9a4d199b7f74917ac4c8f2818705efd11a5109fac31a0aef0b20"}),
  window: Object.freeze({"firstDay":"2026-11-13","lastDay":"2026-12-13","commitBefore":1797206400000}),
});

export const CURRENT_INTEGRATION_STRICT_DIETARY_IDENTITY: CurrentIntegrationSourceIdentity = Object.freeze({
  sourceSha256: sourcePin.sha256, sourcePolicyBasisSha256: "120f5944476f34e1438728942ecf6a51f697a70a02a37d7751b7e5798a056211",
  configurationSha256: "d6d0445f420f8fa73b79464965dd601811d3dc93c453449e807c4c2558c843a7",
  reviewedDataSha256: "d02c75e7dbc1abac763379673b7384060bfa7fe65cf7ee01d213340f7308fe10",
  evidenceManifestSha256: "9f1787077f71f980ff11fd0dd7ac648591fa09e992946e3609e5ad740795cf90",
  guidePolicy: Object.freeze({ version: "wd-curated-household-v1", sha256: "3fae07012bc6fe01e8a21ac50306141f158abfb30936273a06f5aab551408e1c" }),
  window: Object.freeze({ firstDay: "2026-11-13", lastDay: "2026-11-13", commitBefore: 1794614400000 }),
});

export function createCurrentIntegrationDietaryReference(now: () => number = Date.now, strict = false): CurrentIntegrationSource {
  const encoded = JSON.stringify(packageData);
  if (sha256Hex(encoded) !== packageSha256) throw Error("dietary_package_integrity");
  const { source, labels } = packageData;
  const configuration = strict ? strictConfiguration : packageData.configuration;
  const dietaryReview = packageData.dietaryReview as unknown as Parameters<typeof createCuratedSuccessorReferencePlanner>[3];
  if (dietaryReview?.registrySha256 !== registrySha256) throw Error("dietary_registry_integrity");
  const policy = strict ? strictPolicy.curatedHouseholdPolicyDescriptor() : curatedHouseholdPolicyDescriptor();
  const { firstDay, lastDay, regions } = policy.scope;
  const clock = createReferenceSnapshotClockPolicy(firstDay, lastDay, now);
  const initial = strict ? createCuratedStrictArchivePlanner(source, configuration, dietaryReview) : createCuratedSuccessorReferencePlanner(source, configuration, true, dietaryReview);
  if (initial.outcome !== "ready") throw Error("dietary_reference_basis");
  const expectedBasis = initial.sourcePolicyBasis.basisSha256;
  const window = Object.freeze({ firstDay, lastDay, commitBefore: clock.commitBefore });
  const manifest = {
    reviewRevision: CURATED_DIETARY_REFERENCE_REVISION, sourcePin,
    configurationSha256: referenceConfigurationDigest(configuration), sourcePolicyBasisSha256: expectedBasis,
    window, regions,
  };
  const body = {
    schema: "wd-reviewed-reference-data-v1" as const, reviewRevision: manifest.reviewRevision, sourcePin,
    configurationSha256: manifest.configurationSha256, configuration, sourcePolicyBasis: initial.sourcePolicyBasis,
    window, regions: manifest.regions, evidenceManifestSha256: referenceAdmissionDigest(manifest),
  };
  const reviewedReferenceData = createReviewedReferenceArchive(
    source, [{ ...body, reviewedDataSha256: reviewedReferenceDataDigest(body) }], [manifest], dietaryReview,
  ).current();
  const factory = createCuratedSuccessorSessionFactory(source, configuration, reviewedReferenceData, dietaryReview);
  if (factory.outcome !== "ready") throw Error("successor_session_unavailable");
  const guidePolicy = Object.freeze({ version: policy.policy, sha256: referenceConfigurationDigest(policy) });
  const archivedSources = new Map<string, (now: () => number) => CurrentIntegrationSource>([
    [CURRENT_INTEGRATION_REFERENCE_V7_IDENTITY.sourcePolicyBasisSha256, createCurrentIntegrationReferenceV7],
    [CURRENT_INTEGRATION_REFERENCE_V9_IDENTITY.sourcePolicyBasisSha256, createCurrentIntegrationReferenceV9],
    [CURRENT_INTEGRATION_REFERENCE_V10_IDENTITY.sourcePolicyBasisSha256, createCurrentIntegrationReferenceV10],
    [CURRENT_INTEGRATION_REFERENCE_V11_IDENTITY.sourcePolicyBasisSha256, createCurrentIntegrationReferenceV11],
  ]);
  const priorCurated = new Map([
    [CURRENT_INTEGRATION_SUCCESSOR_IDENTITY.sourcePolicyBasisSha256, false],
    [CURRENT_INTEGRATION_HOUSEHOLD_IDENTITY.sourcePolicyBasisSha256, true],
  ]);
  const predecessors = new Map<string, CurrentIntegrationSource>();
  if (sha256Hex(JSON.stringify(archiveDietaryPackage)) !== "47c7cdd70e7ed9680363b2541570f6533ffe7a2007b042429651aa18efd9cc3f") throw Error("dietary_archive_integrity");
  if (sha256Hex(JSON.stringify(archiveMethodPackage)) !== "f5b08ce9a6566627fe9b3eac41b42808fb3964cacb9de7c52a72b544df60adab") throw Error("method_archive_integrity");
  const methodReview = archiveMethodPackage.dietaryReview as unknown as typeof dietaryReview;
  const archiveMethod = createCuratedSuccessorReferencePlanner(archiveMethodPackage.source, archiveMethodPackage.configuration, true, methodReview);
  const priorReview = archiveDietaryPackage.dietaryReview as unknown as typeof dietaryReview;
  const archiveDietary = createCuratedSuccessorReferencePlanner(archiveDietaryPackage.source, archiveDietaryPackage.configuration, true, priorReview);
  const strictArchive = createCuratedStrictArchivePlanner(source, strictConfiguration, dietaryReview);
  if (strictArchive.outcome !== "ready" || strictArchive.sourcePolicyBasis.basisSha256 !== CURATED_STRICT_ARCHIVE_BASIS) throw Error("strict_archive_integrity");
  const southArchive = priorReview ? createCuratedSouthArchivePlanner(archiveDietaryPackage.source, southArchiveConfiguration, priorReview) : null;
  return Object.freeze({
    sourceSha256: sourcePin.sha256, sourcePolicyBasisSha256: expectedBasis,
    reviewedReferenceData, referenceWindow: window, guidePolicy,
    async bind(owner, transactions) {
      if (!isIssuedVerifiedOwnerScope(owner)) return null;
      const strictPresenter = bindArchivedWeekPresenter(strictArchive, {
        labels, transactions: transactions as unknown as ReferenceStatePortV3, resolveScope: () => owner.scope,
      });
      const methodPresenter = archiveMethod.outcome === "ready" ? bindArchivedWeekPresenter(archiveMethod, {
        labels: archiveMethodPackage.labels, transactions: transactions as unknown as ReferenceStatePortV3, resolveScope: () => owner.scope,
      }) : undefined;
      const southPresenter = southArchive?.outcome === "ready" ? bindArchivedWeekPresenter(southArchive, {
        labels: archiveDietaryPackage.labels, transactions: transactions as unknown as ReferenceStatePortV3, resolveScope: () => owner.scope,
      }) : undefined;
      const regionalPresenter = archiveDietary.outcome === "ready" ? bindArchivedWeekPresenter(archiveDietary, {
        labels: archiveDietaryPackage.labels, transactions: transactions as unknown as ReferenceStatePortV3, resolveScope: () => owner.scope,
      }) : undefined;
      const kernel = factory.bind({
        labels, transactions: transactions as unknown as ReferenceStatePortV3,
        resolveScope: () => owner.scope, newWeekPolicy: NEW_WEEK_RECONFIRM_POLICY, newWeekRequestPolicy: clock.check,
        async archivedSavedWeek(week) {
          const basis = (week as ReferenceWeekV2).sourcePolicyBasis.basisSha256;
          if (week.sourceSha256 === sourcePin.sha256 && basis === CURATED_STRICT_ARCHIVE_BASIS) return strictPresenter?.(week);
          if (week.sourceSha256 === archiveMethodPin.sha256 && archiveMethod.outcome === "ready" &&
              basis === archiveMethod.sourcePolicyBasis.basisSha256) return methodPresenter?.(week);
          if (week.sourceSha256 === archiveDietaryPin.sha256) {
            if (basis === CURATED_SOUTH_ARCHIVE_BASIS) return southPresenter?.(week);
            if (archiveDietary.outcome === "ready" && basis === archiveDietary.sourcePolicyBasis.basisSha256) return regionalPresenter?.(week);
          }
          const create = week.sourceSha256 === CURRENT_INTEGRATION_REFERENCE_V11_IDENTITY.sourceSha256
            ? archivedSources.get(basis)
            : week.sourceSha256 === CURRENT_INTEGRATION_SUCCESSOR_IDENTITY.sourceSha256 && priorCurated.has(basis)
              ? (clock: () => number) => createCurrentIntegrationSuccessorReference(clock, priorCurated.get(basis)!) : undefined;
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
