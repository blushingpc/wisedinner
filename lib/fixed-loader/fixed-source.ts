import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CURRENT_INTEGRATION_REBUILT_IDENTITY,
  CURRENT_INTEGRATION_REBUILT_LAST_SERVICE_DAY,
  CURRENT_INTEGRATION_REBUILT_REVISION,
} from "../current-integration-rebuilt-identity.server.ts";
import { createTwoWindowPolicy } from "../fixed-rebuilt-clock.ts";
import { FIXED_REBUILT_DONOR_PIN } from "../fixed-rebuilt-donor.ts";
import { canonicalReferenceData } from "../generated-plan-data.ts";
import type { ReviewedReferenceDataV1 } from "../generated-reviewed-reference-data.ts";
import type { NewWeekRequestPolicy } from "../generated-source-clock.ts";

const identity = CURRENT_INTEGRATION_REBUILT_IDENTITY;
const pins = Object.freeze({
  "runtime-source.jsonl": identity.sourceSha256,
  "compiled-calculator.jsonl": "2ceee0f5ed08e8b94d756acd64438dfd35173709c6a5961a1ce26737289a1d8c",
  "manifest.json": "0862c59a029c0bf375e9949211f156b320c60eb9d694b43dfeb1ecea0fee1eb1",
  "reference-packet.json": "36e98923c236d19c9d9a83e335b71dd769f43b064edfaba285424d02f32c8284",
  "private-donor-row.jsonl": "29cad9978d393b83a7f80fd006f1ccb5ccd4b37d648d3ebae9f1b6c6b0b17960",
});
const count = 1300;
const regions = ["Northeast", "Midwest", "South", "West"];
const store = "wd-reference-estimate:no-shop-preference";
type SourcePin = { sha256: string; recordCount: number };
type Context = { asOfDate: string; region: string; storeIds: readonly string[] };
type CompiledContext = Context & {
  rowSet: number;
  header: { sourceSha256: string; configurationSha256: string; sourcePolicyBasis: { basisSha256: string } };
};
type Row = { offset: number; length: number; sourceRowSha256: string; header: { id: string; recipeSha256: string } };
type Manifest = {
  contract: string; sourcePin: SourcePin; rawBytes: number; rawCodeUnits: number;
  artifactSha256: string; artifactBytes: number; configurationSha256: string; configurationBasisSha256: string;
  contexts: Context[];
};
type Artifact = {
  contract: string; sourcePin: SourcePin; rows: Row[]; summary: { total: number };
  binding: { configuration: unknown; labels: unknown; sourcePolicyBasis: ReviewedReferenceDataV1["sourcePolicyBasis"] };
  coverage: { contexts: CompiledContext[]; rowSets: unknown[][] };
};
type RecipeRow = Record<string, unknown> & { id: string; recipe_sha256: string };
type Bundle = {
  raw: string;
  packet: ReviewedReferenceDataV1;
  binding: Artifact["binding"];
  offsets: ReadonlyMap<string, Row>;
  contexts: ReadonlySet<string>;
  rows: Map<string, RecipeRow>;
};
const issued = new WeakMap<object, Bundle>();
let token: object | undefined;

const sha = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const canonical = (value: unknown) => JSON.stringify(canonicalReferenceData(value));
const hash = (value: unknown) => sha(canonical(value));
const contextKey = (asOfDate: string, region: string, storeIds: readonly string[]) => JSON.stringify([asOfDate, region, storeIds]);

function requireIntegrity(value: unknown): asserts value {
  if (!value) throw Error("fixed_rebuilt_source_integrity_held");
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function read(name: keyof typeof pins): Buffer {
  const adjacent = new URL("./bundle/" + name, import.meta.url);
  const file = adjacent.protocol === "file:" && existsSync(adjacent)
    ? adjacent : join(process.cwd(), "lib", "fixed-loader", "bundle", name);
  const bytes = readFileSync(file);
  requireIntegrity(sha(bytes) === pins[name]);
  return bytes;
}

export function loadFixedRebuiltSource(): object {
  if (token) return token;
  const rawBytes = read("runtime-source.jsonl");
  const artifactBytes = read("compiled-calculator.jsonl");
  const manifest = JSON.parse(read("manifest.json").toString("utf8")) as Manifest;
  const packet = JSON.parse(read("reference-packet.json").toString("utf8")) as ReviewedReferenceDataV1;
  const raw = new TextDecoder("utf-8", { fatal: true }).decode(rawBytes);
  const artifact = JSON.parse(artifactBytes.toString("utf8")) as Artifact;
  requireIntegrity(manifest.sourcePin.sha256 === identity.sourceSha256 && manifest.sourcePin.recordCount === count &&
    manifest.rawBytes === rawBytes.length && manifest.rawCodeUnits === raw.length &&
    manifest.artifactSha256 === pins["compiled-calculator.jsonl"] && manifest.artifactBytes === artifactBytes.length &&
    manifest.configurationSha256 === identity.configurationSha256 && manifest.configurationBasisSha256 === identity.sourcePolicyBasisSha256);

  const { configuration, sourcePolicyBasis } = artifact.binding;
  requireIntegrity(artifact.contract === manifest.contract && artifact.sourcePin.sha256 === identity.sourceSha256 &&
    artifact.sourcePin.recordCount === count && artifact.rows.length === count && artifact.summary.total === count &&
    hash(configuration) === identity.configurationSha256 && sourcePolicyBasis.basisSha256 === identity.sourcePolicyBasisSha256 &&
    sourcePolicyBasis.catalogSha256 === identity.sourceSha256);
  requireIntegrity(packet.schema === "wd-reviewed-reference-data-v1" && packet.reviewRevision === CURRENT_INTEGRATION_REBUILT_REVISION &&
    packet.sourcePin.sha256 === identity.sourceSha256 && packet.sourcePin.recordCount === count &&
    packet.configurationSha256 === identity.configurationSha256 && hash(packet.configuration) === identity.configurationSha256 &&
    packet.sourcePolicyBasis.basisSha256 === identity.sourcePolicyBasisSha256 && packet.sourcePolicyBasis.catalogSha256 === identity.sourceSha256 &&
    packet.evidenceManifestSha256 === identity.evidenceManifestSha256 && packet.reviewedDataSha256 === identity.reviewedDataSha256 &&
    canonical(packet.window) === canonical(identity.window) && canonical(packet.regions) === canonical(regions));
  const { reviewedDataSha256, ...body } = packet;
  const admission = {
    reviewRevision: packet.reviewRevision, sourcePin: packet.sourcePin, configurationSha256: packet.configurationSha256,
    sourcePolicyBasisSha256: packet.sourcePolicyBasis.basisSha256, window: packet.window, regions: packet.regions,
  };
  requireIntegrity(hash(["wd-reviewed-reference-data-v1", body]) === reviewedDataSha256 &&
    hash(["wd-reviewed-reference-admission-v1", admission]) === identity.evidenceManifestSha256);

  const { contexts, rowSets } = artifact.coverage;
  requireIntegrity(contexts.length === 168 && manifest.contexts.length === contexts.length &&
    rowSets.every(rows => rows.length === count));
  const reviewedContexts = new Set<string>();
  for (const context of contexts) {
    const { asOfDate, region, storeIds, header, rowSet } = context;
    const key = contextKey(asOfDate, region, storeIds);
    requireIntegrity(!reviewedContexts.has(key) && regions.includes(region) &&
      asOfDate >= identity.window.firstDay && asOfDate <= identity.window.lastDay &&
      storeIds.length === 1 && storeIds[0] === store &&
      header.sourceSha256 === identity.sourceSha256 && header.configurationSha256 === identity.configurationSha256 &&
      header.sourcePolicyBasis.basisSha256 === identity.sourcePolicyBasisSha256 &&
      Number.isSafeInteger(rowSet) && rowSet >= 0 && rowSet < rowSets.length);
    reviewedContexts.add(key);
  }
  requireIntegrity(canonical(contexts.map(({ asOfDate, region, storeIds }) => ({ asOfDate, region, storeIds }))) === canonical(manifest.contexts));

  const offsets = new Map<string, Row>();
  let offset = 0;
  for (const row of artifact.rows) {
    requireIntegrity(row.offset === offset && Number.isSafeInteger(row.length) && row.length > 0 &&
      raw[row.offset + row.length] === "\n" && !offsets.has(row.header.id));
    offsets.set(row.header.id, freeze(row));
    offset += row.length + 1;
  }
  requireIntegrity(offset === raw.length);
  const handle = Object.freeze({});
  issued.set(handle, {
    raw, packet: freeze(packet), binding: freeze(artifact.binding), offsets, contexts: reviewedContexts, rows: new Map(),
  });
  token = handle;
  return handle;
}

export function readFixedRebuiltSource(handle: object) {
  const bundle = issued.get(handle);
  return bundle ? Object.freeze({ binding: bundle.binding, packet: bundle.packet }) : null;
}

export function readFixedRawSource(handle: object): string | null {
  return issued.get(handle)?.raw ?? null;
}

export function readFixedDonorRawSource(handle: object): string | null {
  const bundle = issued.get(handle);
  if (!bundle) return null;
  const line = new TextDecoder("utf-8", { fatal: true }).decode(read("private-donor-row.jsonl"));
  const successor = bundle.raw + line;
  requireIntegrity(sha(successor) === FIXED_REBUILT_DONOR_PIN.sha256);
  return successor;
}

export function readFixedRecipe(handle: object, id: string): RecipeRow | null {
  const bundle = issued.get(handle);
  const item = bundle?.offsets.get(id);
  if (!bundle || !item) return null;
  const previous = bundle.rows.get(id);
  if (previous) return previous;
  const line = bundle.raw.slice(item.offset, item.offset + item.length);
  requireIntegrity(sha(line) === item.sourceRowSha256);
  const row = JSON.parse(line) as RecipeRow;
  requireIntegrity(row.id === id && row.recipe_sha256 === item.header.recipeSha256 &&
    hash(row.recipe) === item.header.recipeSha256);
  const result = freeze(row);
  bundle.rows.set(id, result);
  return result;
}

export function fixedReviewedRequestPolicy(handle: object, now: () => number): NewWeekRequestPolicy | null {
  const bundle = issued.get(handle);
  if (!bundle) return null;
  const clock = createTwoWindowPolicy({
    valuationFirst: identity.window.firstDay,
    valuationLast: identity.window.lastDay,
    serviceLast: CURRENT_INTEGRATION_REBUILT_LAST_SERVICE_DAY,
    now,
  });
  return request => {
    const time = clock.check(request);
    if (time) return time;
    const fields = Object.getOwnPropertyDescriptors(request as object);
    const date = fields.asOfDate?.value;
    const region = fields.region?.value;
    const stores = fields.storeIds?.value;
    const item = Array.isArray(stores) && stores.length === 1 ? Object.getOwnPropertyDescriptor(stores, "0") : undefined;
    return typeof date === "string" && typeof region === "string" && item && "value" in item &&
      typeof item.value === "string" && bundle.contexts.has(contextKey(date, region, [item.value]))
      ? null : { outcome: "error", code: "reference_context_required" };
  };
}
