import { createHash } from "node:crypto";
import { createRevisedCatalogReader, CURRENT_REVISED_CATALOG_PIN } from "./generated-plan-catalog.ts";
import { copyReferenceData } from "./generated-plan-data.ts";

export const CURRENT_APPROVED_IMAGE_PINS = Object.freeze({ catalog: CURRENT_REVISED_CATALOG_PIN, mappingSha256: "ad749f977324ddc1e5a5f28786b444622493573c7621e6217045310d80d3d4eb", approvedCount: 6 });
type Data = Record<string, unknown>;
type Binding = { recipeId: string; recipeSha256: string; sourcePacketSha256: string; sourcePacketCatalogSha256: string; assetSha256: string; assetFile: string; byteLength: number; format: "png"; width: number; height: number; founderAppearanceApproved: true; priorReviewStatus: string };
type ImageEvidence = {
  readonly recipeId: string; readonly recipeSha256: string; readonly assetId: string; readonly assetSha256: string; readonly contentType: "image/png"; readonly byteLength: number; readonly width: number; readonly height: number;
  readonly appearance: { readonly status: "founder-approved"; readonly evidenceSha256: string };
  readonly fidelity: { readonly status: "prior-records-preserved-no-new-pass"; readonly priorReviewStatus: string; readonly sourceLimit: string };
  readonly delivery: { readonly status: "held"; readonly code: "asset_publication_required"; readonly url: null };
  readonly sourceProductAccepted: false; readonly newPixelReviewPerformed: false;
};
export type ImageLookupOutcome = ImageEvidence & { readonly outcome: "binding"; readonly assetBytesVerified: false } | { readonly outcome: "held"; readonly code: "reviewed_image_binding_needed" } | { readonly outcome: "error"; readonly code: string };
export type ImageResolveOutcome = ImageEvidence & { readonly outcome: "verified-local-illustration"; readonly assetBytesVerified: true; readonly headerValidation: "png-signature-and-IHDR-only" } | Exclude<ImageLookupOutcome, { outcome: "binding" }>;
export type ReviewedImageIndex = {
  readonly sourceSha256: string;
  readonly summary: { readonly catalogRecipes: number; readonly approvedAppearanceBindings: number; readonly missingImageRecipes: number; readonly newPixelReviews: 0; readonly publicationAuthorized: false };
  readonly lookup: (recipeId: unknown, recipeSha256: unknown) => ImageLookupOutcome;
  readonly resolve: (recipeId: unknown, recipeSha256: unknown, bytes: unknown) => ImageResolveOutcome;
};
type BindingResult = { readonly outcome: "ready"; readonly index: ReviewedImageIndex } | { readonly outcome: "error"; readonly code: string };
class ImageFault extends Error { readonly code: string; constructor(code: string) { super("Image binding refused"); this.code = code; } }
function invalid(): never { throw new ImageFault("invalid_image_binding_configuration"); }
function record(value: unknown, keys: readonly string[]): Data { if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join("|") !== [...keys].sort().join("|")) invalid(); return value as Data; }
function text(value: unknown): string { if (typeof value !== "string" || !value.trim() || value.length > 2000) invalid(); return value; }
function digest(value: unknown): string { const result = text(value); if (!/^[a-f0-9]{64}$/.test(result)) invalid(); return result; }
function integer(value: unknown, maximum: number): number { if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > maximum) invalid(); return value as number; }
const sha = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
function freeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype), getBuffer = Object.getOwnPropertyDescriptor(typedArrayPrototype, "buffer")!.get!, getOffset = Object.getOwnPropertyDescriptor(typedArrayPrototype, "byteOffset")!.get!, getLength = Object.getOwnPropertyDescriptor(typedArrayPrototype, "byteLength")!.get!;
function binary(value: unknown, maximum: number): Buffer {
  // Intrinsic getters ignore caller-owned accessors and reject non-byte views.
  const length = getLength.call(value) as number; if (!Number.isSafeInteger(length) || length < 1 || length > maximum) invalid();
  return Buffer.from(new Uint8Array(getBuffer.call(value) as ArrayBuffer, getOffset.call(value) as number, length));
}
function sourceBytes(value: unknown, maximum: number): Buffer { if (typeof value === "string") { if (!value.length || Buffer.byteLength(value) > maximum) invalid(); return Buffer.from(value); } return binary(value, maximum); }

// Pure pinned metadata lookup and supplied-byte verification. No filesystem,
// image decoding, pixel review, edits, uploads, generation or public delivery.
// The current approved six are PNG; other formats require a separate reviewed
// binding path, never an extension-based conversion or silent reinterpretation.
export function createReviewedImageIndex(sourceValue: unknown, mappingValue: unknown, trustedPins: unknown = CURRENT_APPROVED_IMAGE_PINS): BindingResult {
  try {
    const pin = record(copyReferenceData(trustedPins), ["catalog", "mappingSha256", "approvedCount"]), catalogPin = record(pin.catalog, ["sha256", "recordCount"]), mappingSha256 = digest(pin.mappingSha256), approvedCount = integer(pin.approvedCount, 1300);
    const source = createRevisedCatalogReader(catalogPin)(sourceBytes(sourceValue, 64 * 1024 * 1024)); if (source.outcome !== "success") return source;
    const bytes = sourceBytes(mappingValue, 8 * 1024 * 1024); if (sha(bytes) !== mappingSha256) return { outcome: "error", code: "image_mapping_hash_mismatch" };
    const mapping = record(copyReferenceData(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))), ["schema", "catalogSha256", "approvalEvidenceSha256", "contactSheetEvidenceSha256", "appearanceApprovalCount", "publicationAuthorized", "sourceFidelityLimit", "bindings", "limits"]);
    if (mapping.schema !== "wd-reviewed-local-image-bindings-v1" || digest(mapping.catalogSha256) !== source.sourceSha256 || mapping.publicationAuthorized !== false || mapping.appearanceApprovalCount !== approvedCount || !Array.isArray(mapping.bindings) || mapping.bindings.length !== approvedCount || approvedCount > source.recipes.length) invalid();
    const approvalHash = digest(mapping.approvalEvidenceSha256); digest(mapping.contactSheetEvidenceSha256); const sourceLimit = text(mapping.sourceFidelityLimit);
    if (!Array.isArray(mapping.limits) || mapping.limits.length > 20) invalid(); mapping.limits.forEach(text);
    const recipes = new Map(source.recipes.map(row => [row.id, row.recipeSha256])), bindings = new Map<string, Binding>(), assetHashes = new Set<string>();
    for (const value of mapping.bindings) {
      const row = record(value, ["recipeId", "recipeSha256", "sourcePacketSha256", "sourcePacketCatalogSha256", "assetSha256", "assetFile", "byteLength", "format", "width", "height", "founderAppearanceApproved", "priorReviewStatus"]);
      const file = text(row.assetFile); if (!/^[A-Za-z0-9_./-]+$/.test(file) || file.split("/").some(part => !part || part === "." || part === "..")) invalid();
      const recipeId = text(row.recipeId), recipeSha256 = digest(row.recipeSha256), sourcePacketCatalogSha256 = digest(row.sourcePacketCatalogSha256), assetSha256 = digest(row.assetSha256);
      if (recipes.get(recipeId) !== recipeSha256 || sourcePacketCatalogSha256 !== source.sourceSha256 || bindings.has(recipeId) || assetHashes.has(assetSha256) || row.founderAppearanceApproved !== true || row.format !== "png") invalid();
      const binding: Binding = { recipeId, recipeSha256, sourcePacketSha256: digest(row.sourcePacketSha256), sourcePacketCatalogSha256, assetSha256, assetFile: file, byteLength: integer(row.byteLength, 32 * 1024 * 1024), format: "png", width: integer(row.width, 8192), height: integer(row.height, 8192), founderAppearanceApproved: true, priorReviewStatus: text(row.priorReviewStatus) };
      bindings.set(recipeId, freeze(binding)); assetHashes.add(assetSha256);
    }
    function lookup(id: unknown, recipeHash: unknown): ImageLookupOutcome {
      if (typeof id !== "string" || !recipes.has(id)) return { outcome: "error", code: "image_recipe_missing" };
      if (typeof recipeHash !== "string" || recipes.get(id) !== recipeHash) return { outcome: "error", code: "image_recipe_source_mismatch" };
      const binding = bindings.get(id); if (!binding) return { outcome: "held", code: "reviewed_image_binding_needed" };
      return freeze({ outcome: "binding", recipeId: id, recipeSha256: recipeHash, assetId: "meal-image-" + binding.assetSha256, assetSha256: binding.assetSha256, contentType: "image/png", byteLength: binding.byteLength, width: binding.width, height: binding.height, appearance: { status: "founder-approved", evidenceSha256: approvalHash }, fidelity: { status: "prior-records-preserved-no-new-pass", priorReviewStatus: binding.priorReviewStatus, sourceLimit }, delivery: { status: "held", code: "asset_publication_required", url: null }, sourceProductAccepted: false, newPixelReviewPerformed: false, assetBytesVerified: false });
    }
    function resolve(id: unknown, recipeHash: unknown, value: unknown): ImageResolveOutcome {
      const result = lookup(id, recipeHash); if (result.outcome !== "binding") return result;
      try {
        const asset = binary(value, 32 * 1024 * 1024); if (asset.length !== result.byteLength || sha(asset) !== result.assetSha256) return { outcome: "error", code: "image_asset_hash_mismatch" };
        if (asset.length < 33 || asset.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || asset.readUInt32BE(8) !== 13 || asset.toString("ascii", 12, 16) !== "IHDR" || asset.readUInt32BE(16) !== result.width || asset.readUInt32BE(20) !== result.height) return { outcome: "error", code: "image_header_mismatch" };
        return freeze({ ...result, outcome: "verified-local-illustration", assetBytesVerified: true, headerValidation: "png-signature-and-IHDR-only" });
      } catch { return { outcome: "error", code: "invalid_image_bytes" }; }
    }
    return freeze({ outcome: "ready", index: { sourceSha256: source.sourceSha256, summary: { catalogRecipes: recipes.size, approvedAppearanceBindings: bindings.size, missingImageRecipes: recipes.size - bindings.size, newPixelReviews: 0, publicationAuthorized: false }, lookup, resolve } });
  } catch (error) { return { outcome: "error", code: error instanceof ImageFault ? error.code : "invalid_image_binding_configuration" }; }
}
