import type { CurrentIntegrationSource } from "./current-integration-runtime.server.ts";
import {
  CURRENT_INTEGRATION_REBUILT_IDENTITY,
} from "./current-integration-rebuilt-identity.server.ts";
import {
  fixedReviewedRequestPolicy,
  loadFixedRebuiltSource,
  readFixedDonorRawSource,
  readFixedRawSource,
  readFixedRebuiltSource,
} from "./fixed-loader/fixed-source.ts";
import { fixedArchiveResolver } from "./fixed-rebuilt-archives.ts";
import { createFixedRebuiltGuidePolicy } from "./fixed-rebuilt-guide.ts";
import { FIXED_REBUILT_DONOR_BASIS_SHA256, FIXED_REBUILT_DONOR_PIN } from "./fixed-rebuilt-donor.ts";
import { createFixedRebuiltPairedPolicy } from "./fixed-rebuilt-paired-policy.ts";
import { isIssuedVerifiedOwnerScope } from "./generated-owner-scope.ts";
import { createReferenceSessionFactoryV4 } from "./generated-plan-session.ts";
import { NEW_WEEK_RECONFIRM_POLICY, type ReferenceStatePortV3 } from "./generated-plan-state.ts";
import { createReviewedReferenceArchive, referenceAdmissionFor } from "./generated-reviewed-reference-data.ts";

export function createFixedRebuiltBinder(now: () => number = Date.now): CurrentIntegrationSource {
  const identity = CURRENT_INTEGRATION_REBUILT_IDENTITY;
  const handle = loadFixedRebuiltSource();
  const fixed = readFixedRebuiltSource(handle);
  const source = readFixedRawSource(handle);
  const newWeekRequestPolicy = fixedReviewedRequestPolicy(handle, now);
  if (!fixed || !source || !newWeekRequestPolicy) throw Error("fixed_source_handle_invalid");

  const { packet, binding } = fixed;
  const { configuration, labels } = binding;
  const archive = createReviewedReferenceArchive(source, [packet], [referenceAdmissionFor(packet)]);
  const reviewedReferenceData = archive.current();
  const guide = createFixedRebuiltGuidePolicy(source, configuration);
  if (guide.sha256 !== identity.guidePolicy.sha256) throw Error("fixed_guide_integrity_held");

  const factory = createReferenceSessionFactoryV4(source, configuration, {
    reviewedReferenceData,
    currentGuidePolicy: guide,
  });
  if (factory.outcome !== "ready" ||
      factory.source.sha256 !== identity.sourceSha256 ||
      factory.sourcePolicyBasis.basisSha256 !== identity.sourcePolicyBasisSha256) {
    throw Error("fixed_factory_integrity_held");
  }
  let paired: ReturnType<typeof createFixedRebuiltPairedPolicy> | undefined;
  function loadPairedPolicy() {
    if (!paired) {
      const successor = readFixedDonorRawSource(handle);
      if (!successor || !source) return undefined;
      paired = createFixedRebuiltPairedPolicy(source, successor, configuration, guide);
    }
    return paired;
  }
  function resolveSavedWeekEvaluator(sourceSha256: string, basisSha256: string) {
    if (sourceSha256 !== FIXED_REBUILT_DONOR_PIN.sha256 || basisSha256 !== FIXED_REBUILT_DONOR_BASIS_SHA256) return undefined;
    return loadPairedPolicy()?.evaluator;
  }

  return Object.freeze({
    sourceSha256: factory.source.sha256,
    sourcePolicyBasisSha256: factory.sourcePolicyBasis.basisSha256,
    reviewedReferenceData,
    referenceWindow: packet.window,
    guidePolicy: identity.guidePolicy,
    async bind(owner, transactions) {
      if (!isIssuedVerifiedOwnerScope(owner)) return null;
      const kernel = factory.bind({
        labels,
        transactions: transactions as unknown as ReferenceStatePortV3,
        resolveScope: () => owner.scope,
        newWeekPolicy: NEW_WEEK_RECONFIRM_POLICY,
        newWeekRequestPolicy,
        resolveSavedWeekEvaluator,
        pairedReplacement: () => loadPairedPolicy()?.policy,
        archivedSavedWeek: fixedArchiveResolver(owner, transactions, now),
      });
      if (kernel.outcome !== "ready") return null;
      return Object.freeze({
        newWeekCommitBefore: packet.window.commitBefore,
        presentSavedWeek: kernel.presentSavedWeek,
        handle: kernel.handle,
      });
    },
  } satisfies CurrentIntegrationSource);
}
