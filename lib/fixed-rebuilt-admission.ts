import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { readCurrentBundledCapsule } from "./current-bundled-capsule.server.ts";
import { CURRENT_INTEGRATION_REBUILT_IDENTITY } from "./current-integration-rebuilt-identity.server.ts";
import { loadFixedRebuiltSource, readFixedRecipe } from "./fixed-loader/fixed-source.ts";
import { isFinalDerivedRow } from "./generated-final-source-admission.ts";
import { canonicalReferenceData } from "./generated-plan-data.ts";
import { reviewedMethodNutritionParent } from "./generated-reviewed-method-lineage.ts";
import { makeHalfBatchValidator } from "./half-batch-validator.ts";

const identity = CURRENT_INTEGRATION_REBUILT_IDENTITY;
export const FIXED_REBUILT_PIN = Object.freeze({ sha256: identity.sourceSha256, recordCount: 1300 });
export const FIXED_REBUILT_UTILITY_SHA = "0bc58527f19dfaeaadf8c1e3920794496fbbbd6c7d9394b67e879968c3cc4170";

const original = Object.freeze({
  source: "33e1dba41e08bec489b195a4febfe15f3e4d90f42066d763c9d0451fa9c4ecf9",
  capsule: "b3f226ef20e10ebca71b8c1e9873732e2ab7b4b0a38197f9985a550982e8de07",
  bytes: 13_491_337,
});
const sha = (text: string | Uint8Array) => createHash("sha256").update(text).digest("hex");
const hash = (value: unknown) => sha(JSON.stringify(canonicalReferenceData(value)));

type ParentData = {
  parents: ReadonlyMap<string, string>;
  rebuilt: ReturnType<typeof loadFixedRebuiltSource>;
  accepted: Map<string, { rowSha256: string; nutritionBody: string }>;
};
let cached: ParentData | undefined;

function parentData(): ParentData {
  if (cached) return cached;
  const capsule = JSON.parse(readCurrentBundledCapsule("v11", import.meta.url));
  if (sha(JSON.stringify(capsule)) !== original.capsule ||
      capsule.schema !== "wd-current-server-source-capsule-v2" ||
      typeof capsule.sourceGzipBase64 !== "string") {
    throw Error("parent_capsule_integrity_held");
  }
  const bytes = gunzipSync(Buffer.from(capsule.sourceGzipBase64, "base64"), {
    maxOutputLength: original.bytes + 1,
  });
  if (bytes.length !== original.bytes || sha(bytes) !== original.source) throw Error("parent_source_integrity_held");
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const lines = source.trimEnd().split("\n");
  const parents = new Map<string, string>(lines.map(line => [JSON.parse(line).id, line]));
  if (lines.length !== FIXED_REBUILT_PIN.recordCount || parents.size !== lines.length) throw Error("parent_source_integrity_held");
  cached = { parents, rebuilt: loadFixedRebuiltSource(), accepted: new Map() };
  return cached;
}

export function fixedRebuiltNutritionParent(row: Record<string, unknown>): string | null {
  if (typeof row.id !== "string") return null;
  try {
    const { parents, rebuilt, accepted } = parentData();
    const rowSha256 = hash(row);
    const previous = accepted.get(row.id);
    if (previous) return previous.rowSha256 === rowSha256 ? previous.nutritionBody : null;

    const exact = readFixedRecipe(rebuilt, row.id);
    const parentLine = parents.get(row.id);
    if (!exact || !parentLine || rowSha256 !== hash(exact)) return null;
    const parent = JSON.parse(parentLine);
    const validate = makeHalfBatchValidator({
      parentLine,
      parent,
      seal: {
        id: row.id,
        source: original.source,
        line: sha(parentLine),
        parentRecipe: parent.recipe_sha256,
        parentNutrition: hash(parent.nutrition),
        childRecipe: exact.recipe_sha256,
        childNutrition: hash(exact.nutrition),
        lineage: hash(exact.half_batch_lineage),
      },
      sha256: sha,
      authenticateDerivedParent: isFinalDerivedRow,
      authenticatePreparationParent: reviewedMethodNutritionParent,
    });
    const nutritionBody = validate(exact);
    if (nutritionBody) accepted.set(row.id, { rowSha256, nutritionBody });
    return nutritionBody;
  } catch {
    return null;
  }
}

export function fixedRebuiltConfigurationMatches(value: unknown): boolean {
  try {
    return hash(value) === identity.configurationSha256;
  } catch {
    return false;
  }
}
