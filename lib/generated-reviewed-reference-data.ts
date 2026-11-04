import {FINAL_DERIVED_PIN} from "./generated-final-source-admission.ts";
import {createJoinedReferencePlannerV4,createJoinedReferencePlannerV3} from "./generated-joined-plan.ts";
import { canonicalReferenceData, copyReferenceData } from "./generated-plan-data.ts";
import { sha256Hex, utf8ByteLength } from "./generated-runtime-bytes.ts";
import { createJoinedReferencePlannerV2 } from "./generated-joined-plan.ts";
import type { SourcePolicyBasisV2 } from "./generated-source-policy-basis-v2.ts";

export const REVIEWED_REFERENCE_DATA = "wd-reviewed-reference-data-v1";
const regions = ["Northeast", "Midwest", "South", "West"] as const;
type Data = Record<string, unknown>;
export type ReviewedReferenceDataV1 = Readonly<{
  schema: typeof REVIEWED_REFERENCE_DATA; reviewRevision: number;
  sourcePin: Readonly<{ sha256: string; recordCount: number }>;
  configurationSha256: string; configuration: unknown; sourcePolicyBasis: SourcePolicyBasisV2;
  window: Readonly<{ firstDay: string; lastDay: string; commitBefore: number }>;
  regions: readonly string[]; evidenceManifestSha256: string; reviewedDataSha256: string;
}>;
export type ReferenceAdmissionManifest = Omit<ReviewedReferenceDataV1, "schema" | "configuration" | "sourcePolicyBasis" | "evidenceManifestSha256" | "reviewedDataSha256"> & { sourcePolicyBasisSha256: string };
export const reviewedReferenceDataDigest = (value: unknown) => sha256Hex(JSON.stringify(canonicalReferenceData([REVIEWED_REFERENCE_DATA, value])));
export const referenceAdmissionDigest = (value: unknown) => sha256Hex(JSON.stringify(canonicalReferenceData(["wd-reviewed-reference-admission-v1", value])));
function invalid(): never { throw Error("invalid_reviewed_reference_data"); }
function object(value: unknown, keys: readonly string[]): Data {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join() !== [...keys].sort().join()) invalid();
  return value as Data;
}
function hash(value: unknown): string { if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) invalid(); return value; }
function freeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
export function referenceConfigurationDigest(value: unknown): string { return sha256Hex(JSON.stringify(canonicalReferenceData(value))); }
export function referenceAdmissionFor(packet: ReviewedReferenceDataV1): ReferenceAdmissionManifest {
  return freeze({ reviewRevision: packet.reviewRevision, sourcePin: packet.sourcePin, configurationSha256: packet.configurationSha256,
    sourcePolicyBasisSha256: packet.sourcePolicyBasis.basisSha256, window: packet.window, regions: packet.regions });
}
// Byte/schema agreement only. A successful parser is NOT source-review authority.
// The host must separately match the exact packet to its trusted admission list.
export function readReviewedReferenceDataV1(source: unknown, input: unknown): { outcome: "ready"; packet: ReviewedReferenceDataV1 } | { outcome: "error"; code: "invalid_reviewed_reference_data" } {
  try {
    const row = object(copyReferenceData(input), ["schema", "reviewRevision", "sourcePin", "configurationSha256", "configuration", "sourcePolicyBasis", "window", "regions", "evidenceManifestSha256", "reviewedDataSha256"]);
    if (row.schema !== REVIEWED_REFERENCE_DATA || !Number.isSafeInteger(row.reviewRevision) || (row.reviewRevision as number) < 1 || utf8ByteLength(JSON.stringify(row)) > 16 * 1024 * 1024) invalid();
    const pin = object(row.sourcePin, ["sha256", "recordCount"]); hash(pin.sha256);
    if (!Number.isSafeInteger(pin.recordCount) || (pin.recordCount as number) < 1) invalid();
    const window = object(row.window, ["firstDay", "lastDay", "commitBefore"]);
    for (const k of ["firstDay", "lastDay"]) if (typeof window[k] !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(window[k] as string) || !Number.isFinite(Date.parse(window[k] + "T00:00:00Z")) || new Date(window[k] + "T00:00:00Z").toISOString().slice(0, 10) !== window[k]) invalid();
    if ((window.firstDay as string) > (window.lastDay as string) || window.commitBefore !== Date.parse(window.lastDay + "T00:00:00Z") + 86400000) invalid();
    if (!Array.isArray(row.regions) || row.regions.length !== regions.length || !regions.every(r => (row.regions as unknown[]).includes(r))) invalid();
    if (hash(row.configurationSha256) !== referenceConfigurationDigest(row.configuration)) invalid();
    const config = row.configuration as Data;
    if (referenceConfigurationDigest(config.sourcePin) !== referenceConfigurationDigest(pin)) invalid();
    const final=pin.sha256===FINAL_DERIVED_PIN.sha256;
    if(final&&row.reviewRevision!==7&&row.reviewRevision!==9&&row.reviewRevision!==10&&row.reviewRevision!==11)invalid();
    const binding = (final?((row.reviewRevision===10||row.reviewRevision===11)?createJoinedReferencePlannerV4:createJoinedReferencePlannerV3):createJoinedReferencePlannerV2)(source, config);
    if (binding.outcome !== "ready" || binding.source.sha256 !== pin.sha256 || binding.source.recordCount !== pin.recordCount || referenceConfigurationDigest(binding.sourcePolicyBasis) !== referenceConfigurationDigest(row.sourcePolicyBasis)) invalid();
    const { reviewedDataSha256, ...body } = row;
    if (hash(reviewedDataSha256) !== reviewedReferenceDataDigest(body)) invalid();
    const packet = row as unknown as ReviewedReferenceDataV1;
    if (hash(packet.evidenceManifestSha256) !== referenceAdmissionDigest(referenceAdmissionFor(packet))) invalid();
    return { outcome: "ready", packet: freeze(packet) };
  } catch { return { outcome: "error", code: "invalid_reviewed_reference_data" }; }
}

// Trusted code/host input only. The production binder supplies its closed
// manifests; request JSON and successful packet parsing never populate them.
export function createReviewedReferenceArchive(source: unknown, entries: readonly unknown[], trustedManifests: readonly ReferenceAdmissionManifest[]) {
  if (!Array.isArray(entries) || !entries.length || entries.length > 64 || !Array.isArray(trustedManifests) || !trustedManifests.length || trustedManifests.length > 64) invalid();
  const manifests = copyReferenceData(trustedManifests) as ReferenceAdmissionManifest[];
  const packets: ReviewedReferenceDataV1[] = [], revisions = new Map<number, string>();
  for (const entry of entries) {
    const read = readReviewedReferenceDataV1(source, entry); if (read.outcome !== "ready") invalid();
    const p = read.packet, digest = referenceAdmissionDigest(referenceAdmissionFor(p));
    if (!manifests.some(m => referenceAdmissionDigest(m) === digest)) invalid();
    if (revisions.has(p.reviewRevision) && revisions.get(p.reviewRevision) !== p.reviewedDataSha256) invalid();
    if (!packets.some(x => x.reviewedDataSha256 === p.reviewedDataSha256)) packets.push(p);
    revisions.set(p.reviewRevision, p.reviewedDataSha256);
  }
  packets.sort((a, b) => a.reviewRevision - b.reviewRevision);
  return Object.freeze({ current: () => packets.at(-1)!, getOriginal(query: { sourceSha256: string; sourcePolicyBasisSha256: string; configurationSha256?: string; reviewRevision?: number }) {
    const q = copyReferenceData(query) as Data;
    if (Object.keys(q).some(k => !["sourceSha256", "sourcePolicyBasisSha256", "configurationSha256", "reviewRevision"].includes(k))) invalid();
    hash(q.sourceSha256); hash(q.sourcePolicyBasisSha256);
    if (q.configurationSha256 !== undefined) hash(q.configurationSha256);
    if (q.reviewRevision !== undefined && (!Number.isSafeInteger(q.reviewRevision) || (q.reviewRevision as number) < 1)) invalid();
    const matches = packets.filter(p => p.sourcePin.sha256 === q.sourceSha256 && p.sourcePolicyBasis.basisSha256 === q.sourcePolicyBasisSha256 && (q.configurationSha256 === undefined || p.configurationSha256 === q.configurationSha256) && (q.reviewRevision === undefined || p.reviewRevision === q.reviewRevision));
    return matches.length === 1 ? { outcome: "ready" as const, packet: matches[0]! } : { outcome: "held" as const, code: matches.length ? "original_reference_data_ambiguous" : "original_reference_data_unavailable" };
  } });
}
