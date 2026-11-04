import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { canonicalReferenceData, copyReferenceData } from "./generated-plan-data.ts";
import { createReferenceSessionFactoryV2, createReferenceSessionFactoryV3, createReferenceSessionFactoryV4 } from "./generated-plan-session.ts";
import { NEW_WEEK_RECONFIRM_POLICY } from "./generated-plan-state.ts";
import { createReferenceSnapshotClockPolicy, createReviewedWeekClockPolicy } from "./generated-source-clock.ts";
import { isIssuedVerifiedOwnerScope } from "./generated-owner-scope.ts";
import type { CurrentOwnerServiceDependencies } from "./generated-current-owner-service.ts";
import { createReviewedReferenceArchive, referenceAdmissionDigest, reviewedReferenceDataDigest, type ReviewedReferenceDataV1, type ReferenceAdmissionManifest } from "./generated-reviewed-reference-data.ts";

export const createReviewedCurrentReferenceArchive = createReviewedReferenceArchive;
import { createCurrentGuidePolicy, CURRENT_GUIDE_POLICY } from "./generated-current-guide-policy.ts";

const snapshots = Object.freeze([Object.freeze({
  source: "4c4e64e9c7030ac588cd665a16786620a066d23c7fc409a086d12ac3d393051c", bytes: 11357533,
  configuration: "65c3698898c173cb30c17a048fd2907204f6ecb2344bba2fff8177d2dbd0e6fe",
  labels: "15e7b81dfe39f300a3d3036ffc03ce3d6fee417562d083e4e612a823c0cded36",
  capsule: "93b11865b4a0ab7a68cde411988288da4a5c7db68ae9b098208b0c1ab613414d",
  firstDay: "2026-10-30", lastDay: "2026-10-30", reviewRevision: 2,
}), Object.freeze({
  source: "4c4e64e9c7030ac588cd665a16786620a066d23c7fc409a086d12ac3d393051c", bytes: 11357533,
  configuration: "bf0f69504a37467d11dce2b7ddc3826197f6d45c0741a5054c641ee5a88af55b",
  labels: "15e7b81dfe39f300a3d3036ffc03ce3d6fee417562d083e4e612a823c0cded36",
  capsule: "01df5c4218fd2e55a3e28eec0e789c905ad15404fbe60ce0f7393e0a935990d5",
  firstDay: "2026-10-30", lastDay: "2026-11-05", reviewRevision: 4,
}), Object.freeze({"source":"4c4e64e9c7030ac588cd665a16786620a066d23c7fc409a086d12ac3d393051c","bytes":11357533,"configuration":"cb9d5965ac9c81a9c6a28dee3aaf598b556d2fda5ef956609a32d9afdebbe027","labels":"dbbbcdf491ab53ef32233ea1dbd7a189dc4f20dd4d1a86bce4c12924d70b91b5","capsule":"1cb71b80aae0013065e25d1154bae2931acde32ae16a51f04099e6f1c3580c3f","firstDay":"2026-11-01","lastDay":"2026-11-30","reviewRevision":5}), Object.freeze({"source":"4c4e64e9c7030ac588cd665a16786620a066d23c7fc409a086d12ac3d393051c","bytes":11357533,"configuration":"2f673b2c4796a69746a48afc18a6a17fa494cf38c57b5bcc99aa51c5d335de3d","labels":"5f5651d01b21d1b65f76198544574df375c9ee738bba220efee0fbc61f02e2c2","capsule":"49087c3af5069a558cb7ba3c0f322d75bfa4176687e273e924429ba82dc5de4f","firstDay":"2026-11-01","lastDay":"2026-11-01","reviewRevision":6}), Object.freeze({"source":"33e1dba41e08bec489b195a4febfe15f3e4d90f42066d763c9d0451fa9c4ecf9","bytes":13491337,"configuration":"d84f9cf6068453dfb855b7811eb20280e3642f0043ba573b959364ee0dabbd45","labels":"b77fb63fa89dd7f437e94f7be6f5d619fb7e23db1de6a98c152accbb2fb33a7d","capsule":"4d5869766b1835fbfb12ba7a22c4e68125aaba37c2e6f9582bac119c21f9040b","firstDay":"2026-11-01","lastDay":"2026-11-01","reviewRevision":7}), Object.freeze({"source":"33e1dba41e08bec489b195a4febfe15f3e4d90f42066d763c9d0451fa9c4ecf9","bytes":13491337,"configuration":"d84f9cf6068453dfb855b7811eb20280e3642f0043ba573b959364ee0dabbd45","labels":"b77fb63fa89dd7f437e94f7be6f5d619fb7e23db1de6a98c152accbb2fb33a7d","capsule":"ec65dd749a1eda418dea74055092ee1d23dd24ae2e92b2f00ea34a8e3fe19243","firstDay":"2026-11-02","lastDay":"2026-11-08","reviewRevision":9}), Object.freeze({"source":"33e1dba41e08bec489b195a4febfe15f3e4d90f42066d763c9d0451fa9c4ecf9","bytes":13491337,"configuration":"d84f9cf6068453dfb855b7811eb20280e3642f0043ba573b959364ee0dabbd45","labels":"b77fb63fa89dd7f437e94f7be6f5d619fb7e23db1de6a98c152accbb2fb33a7d","capsule":"b3f226ef20e10ebca71b8c1e9873732e2ab7b4b0a38197f9985a550982e8de07","firstDay":"2026-11-02","lastDay":"2026-11-15","reviewRevision":11})]);
const sha = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");

// Server-only sealed data, supplied by the deployment entry point. No source
// download, filesystem discovery, credentials or request DTO can admit a source.
export function createReviewedCurrentSourceBinder(capsuleValue: unknown, now: () => number = Date.now, profileMethods = false): {
  readonly bind: CurrentOwnerServiceDependencies["bind"];
  readonly sourceSha256: string; readonly sourcePolicyBasisSha256: string;
  readonly referenceWindow: { readonly firstDay: string; readonly lastDay: string; readonly commitBefore: number };
  readonly reviewedReferenceData?: ReviewedReferenceDataV1;
  readonly guidePolicy?: Readonly<{ version: string; sha256: string }>;
} {
  if (!capsuleValue || typeof capsuleValue !== "object" || Array.isArray(capsuleValue)) throw Error("Current source capsule unavailable");
  const encoded = JSON.stringify(capsuleValue);
  if (encoded.length > 3 * 1024 * 1024) throw Error("Current source capsule seal mismatch");
  const capsuleSha = sha(encoded), pins = snapshots.find(row => row.capsule === capsuleSha);
  if (!pins) throw Error("Current source capsule seal mismatch");
  const capsule = JSON.parse(encoded) as { schema: string; sourceGzipBase64: string; configuration: unknown; labels: unknown };
  if (capsule.schema !== "wd-current-server-source-capsule-v2" || typeof capsule.sourceGzipBase64 !== "string") throw Error("Current source capsule invalid");
  const configuration = copyReferenceData(capsule.configuration), labels = copyReferenceData(capsule.labels);
  if (sha(JSON.stringify(canonicalReferenceData(configuration))) !== pins.configuration || sha(JSON.stringify(canonicalReferenceData(labels))) !== pins.labels) throw Error("Current source configuration mismatch");
  const sourceBytes = gunzipSync(Buffer.from(capsule.sourceGzipBase64, "base64"), { maxOutputLength: pins.bytes + 1 });
  if (sourceBytes.length !== pins.bytes || sha(sourceBytes) !== pins.source) throw Error("Current source body mismatch");
  const source = new TextDecoder("utf-8", { fatal: true }).decode(sourceBytes);
  if(profileMethods && pins.reviewRevision!==9 && pins.reviewRevision!==11) throw Error("profile_method_archive_mismatch");
  const revision=profileMethods?(pins.reviewRevision===11?11:10):pins.reviewRevision;
  const createFactory = profileMethods ? createReferenceSessionFactoryV4 : (pins.reviewRevision === 7 || pins.reviewRevision === 9) ? createReferenceSessionFactoryV3 : createReferenceSessionFactoryV2;
  const initial = createFactory(source, configuration);
  if (initial.outcome !== "ready" || initial.source.sha256 !== pins.source || initial.source.recordCount !== 1300) throw Error("Current source not admitted");
  // Each closed snapshot has its separately recorded review window. Capture
  // dates and prices are unchanged; no request can renew or select a new lease.
  const clock = (profileMethods ? createReviewedWeekClockPolicy : createReferenceSnapshotClockPolicy)(pins.firstDay, pins.lastDay, now);
  // Closed V4 and explicit V5 snapshots retain their own current handoff. The
  // older accepted capsule still binds its original legacy sessions unchanged.
  let reviewed: ReviewedReferenceDataV1 | undefined;
  if (pins.reviewRevision === 4 || pins.reviewRevision === 5 || pins.reviewRevision === 6 || pins.reviewRevision === 7 || pins.reviewRevision === 9 || pins.reviewRevision === 11) {
    const manifest: ReferenceAdmissionManifest = Object.freeze({ reviewRevision: revision, sourcePin: initial.source,
      configurationSha256: pins.configuration, sourcePolicyBasisSha256: initial.sourcePolicyBasis.basisSha256,
      window: Object.freeze({ firstDay: pins.firstDay, lastDay: pins.lastDay, commitBefore: clock.commitBefore }),
      regions: Object.freeze(["Northeast", "Midwest", "South", "West"]) });
    const body = { schema: "wd-reviewed-reference-data-v1" as const, reviewRevision: manifest.reviewRevision,
      sourcePin: { sha256: pins.source, recordCount: 1300 }, configurationSha256: pins.configuration, configuration,
      sourcePolicyBasis: initial.sourcePolicyBasis, window: manifest.window, regions: manifest.regions,
      evidenceManifestSha256: referenceAdmissionDigest(manifest) };
    const archive = createReviewedCurrentReferenceArchive(source, [{ ...body, reviewedDataSha256: reviewedReferenceDataDigest(body) }], [manifest]);
    reviewed = archive.current();
  }
  const guidePolicy = reviewed ? createCurrentGuidePolicy(source, configuration, profileMethods) : undefined;
  const factory = reviewed ? createFactory(source, configuration, { reviewedReferenceData: reviewed, currentGuidePolicy: guidePolicy }) : initial;
  if (factory.outcome !== "ready") throw Error("Current source handoff mismatch");
  return Object.freeze({ sourceSha256: pins.source, sourcePolicyBasisSha256: factory.sourcePolicyBasis.basisSha256,
    ...(reviewed ? { reviewedReferenceData: reviewed } : {}),
    ...(guidePolicy ? { guidePolicy: Object.freeze({ version: CURRENT_GUIDE_POLICY, sha256: guidePolicy.sha256 }) } : {}),
    referenceWindow: Object.freeze({ firstDay: clock.firstDay, lastDay: clock.lastDay, commitBefore: clock.commitBefore }),
    bind: async (owner, transactions) => {
      if (!isIssuedVerifiedOwnerScope(owner)) return null;
      // The existing durable port stores opaque bounded JSON; source-selected repositories validate each version.
      const kernel = factory.bind({ labels, transactions: transactions as unknown as import("./generated-plan-state.ts").ReferenceStatePortV2 & import("./generated-plan-state.ts").ReferenceStatePortV3, resolveScope: () => owner.scope,
        newWeekPolicy: NEW_WEEK_RECONFIRM_POLICY, newWeekRequestPolicy: clock.check });
      if (kernel.outcome !== "ready") return null;
      return Object.freeze({ newWeekCommitBefore: clock.commitBefore, async handle(request: Request) {
        const response = await kernel.handle(request);
        response.headers.set("X-WiseDinner-Reference-Through", clock.lastDay);
        response.headers.set("X-WiseDinner-Source", pins.source);
        if (guidePolicy) {
          response.headers.set("X-WiseDinner-Guide-Policy", CURRENT_GUIDE_POLICY);
          response.headers.set("X-WiseDinner-Guide-Policy-Sha256", guidePolicy.sha256);
        }
        // Header generation must never discard a committed acknowledgement.
        try { response.headers.set("X-WiseDinner-Clock-Utc", new Date(now()).toISOString()); } catch { /* retain response */ }
        return response;
      } });
    },
  });
}
