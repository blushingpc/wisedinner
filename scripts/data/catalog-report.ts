import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { reviewNutrition } from "./catalog-review.ts";
import { SAFETY } from "./ingredient-safety.ts";
import { loadUsdaMap } from "./usda.ts";
import type { SourceFood } from "./catalog-evidence.ts";

// Local reports only. No assembly runner, DB, storage, fixtures or public pointer imports.
const dir = "docs/ingredient-catalog";
const foods: SourceFood[] = JSON.parse(readFileSync(`${dir}/usda-evidence.json`, "utf8")).foods;
const reviews = reviewNutrition(loadUsdaMap(), foods);
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/nutrition-review.json`, JSON.stringify(reviews, null, 2) + "\n");
writeFileSync(`${dir}/safety-review.json`, JSON.stringify(Object.values(SAFETY), null, 2) + "\n");
writeFileSync(`${dir}/nutrition-review.md`, `# Nutrition review, October 4 local session\n\nUSDA lookup access dates are UTC (October 5). ${reviews.length} active IDs reviewed for an outcome; ${reviews.filter(r => r.status === "generic-reviewed").length} generic ingredient references accepted, ${reviews.filter(r => r.status === "blocked").length} blocked. This is not complete branded-package validation. Source extracts: usda-evidence.json. Exact original precision restored for ground turkey, ground beef, eggs, lentils, white rice, quinoa and edamame. No public snapshot was regenerated.\n\n| Stable ID | Outcome | Original source | Basis and unresolved work | Conversion |\n|---|---|---|---|---|\n` + reviews.map(r => `| ${r.sku_id} | ${r.status} | ${r.source ? `[FDC ${r.fdc_id}](${r.source}), accessed ${r.accessed}` : "No original label evidence"} | ${r.basis} ${r.reasons.join(" ")} | ${r.conversion} |`).join("\n") + "\n");
console.log(JSON.stringify({ nutrition: { total: reviews.length, reviewed: reviews.filter(r => r.status === "generic-reviewed").length, blocked: reviews.filter(r => r.status === "blocked").length }, safety: { total: Object.keys(SAFETY).length, reviewed: Object.values(SAFETY).filter(r => r.status === "reviewed").length, unreviewed: Object.values(SAFETY).filter(r => r.status === "unreviewed").length } }));
