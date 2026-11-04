import { sha256Hex } from "./generated-runtime-bytes.ts";
import practicalSeals from "./generated-reviewed-practical-seals-v2.json" with { type: "json" };

// Independently compared against the sealed 1,300-row native parent and App v9
// afterimages on 2026-10-30. This admits unchanged conditional input-nutrition
// evidence for exactly three authored method bodies. It grants neither kitchen
// acceptance nor a general way to rebind historical nutrition to edited dishes.
type Review = Readonly<{ id: string; parent: string; child: string; nutrition: string; metadata: string; lineage: string; practical?: boolean }>;
const reviews: readonly Review[] = Object.freeze([
  { id: "WD-R6-M-229a763292298d2a", parent: "61351ba0e367600c86bb2590190202cbbf341110768824af29273b1fa7f0d767", child: "f4e020ae407c00b01f131ff44376d6ae251d072027c53620c1ae3c0e4feea1fa", nutrition: "2ec3559f1bdcf4773a043790f3447a1e9a92867801385a30873739de8affe2eb", metadata: "0cd291d3225a85a9c4d06f36a635ed56ce69b91a59abb8888639731f79e75cd3", lineage: "325eaf0b246c83d46e68a0dc8c2fbfe138174a86355a4e88e0e04d8840d9b2c2" },
  { id: "WD-R6-M-431627cc2c407495", parent: "66aa9c670eefaa7d9983c0da44c663b4bf2d0c7e3565746d615a202321bee117", child: "a58b59e85e82934970fda63fd5053ce8123f1d3a12a6c492059f657fb9e6d33f", nutrition: "fe89064321c4fff88f8acf192ae6b4a335d3eccdadf444ba9e15f4cccb2a0911", metadata: "6991d3f2264230c2236e913052e74c508d64c7c214625b1217a38a20d8f97b83", lineage: "51cc2ed39c2b9f7c744dc01b3ef3aa7a74357064f52950046eedeb0d1d4caec8" },
  { id: "WD-R6-B-0104", parent: "7ff9cfc5e430123a0f33d4f1662cfe53748c2eec51fc79b9134920fa07b6726d", child: "864e9f8317d2d83e4817302903dd2e7677ec70954dcf04aa2c1d2236c84e6a69", nutrition: "caa5f304589b9ca56c15068c7b8923acbccba77200e7296e31532c55e8eee722", metadata: "97848e7ed60d1943952d315a8c82b79f585e60e5e45ab9507646a4d75270bcfb", lineage: "80bfbf8e34bcf957775beeef30e9b293fce93a405c5f2141036de4e6da3862d7" },
  ...practicalSeals,
].map(value => Object.freeze(value)));

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, nested]) => [key, stable(nested)]));
  return value;
}
const hash = (value: unknown) => sha256Hex(JSON.stringify(stable(value)));

export function isReviewedMethodBodySha(value: unknown): boolean { return reviews.some(review => review.child === value); }

export function reviewedMethodNutritionParent(row: Readonly<Record<string, unknown>>): string | null {
  const review = reviews.find(value => value.id === row.id && value.child === row.recipe_sha256);
  if (!review || !Object.hasOwn(row, "preparation_lineage")) return null;
  if (hash(row.recipe) !== review.child || hash(row.nutrition) !== review.nutrition || hash(row.preparation_lineage) !== review.lineage) return null;
  const metadata = Object.fromEntries(Object.entries(row).filter(([key]) => !["recipe", "recipe_sha256", "preparation_lineage"].includes(key)));
  return hash(metadata) === review.metadata ? review.parent : null;
}

const practicalServings = Object.freeze(["1", "2"] as const);
// Only the final three exact reviewed children carry this kitchen-method
// domain. Original recipes and historical static v9 evidence are unchanged.
export function reviewedMethodSourceServings(row: Readonly<Record<string, unknown>>): readonly string[] | null {
  const review = reviews.find(value => value.id === row.id && value.child === row.recipe_sha256 && value.practical === true);
  return review && reviewedMethodNutritionParent(row) !== null ? practicalServings : null;
}
