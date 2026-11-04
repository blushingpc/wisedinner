// Synthetic protocol fixtures only. Pinned USDA metadata names are test vectors, not source-food clearance.
import test from "node:test";
import assert from "node:assert/strict";
import { sha } from "./generated-joined-plan.test-support.ts";
import { eggGroupFixture as fixture } from "./generated-reviewed-egg-group.test-support.ts";
import { canonicalReferenceData } from "./generated-plan-data.ts";
import { createReviewedPublicPackRegistry } from "./generated-reviewed-pack-registry.ts";
import { prepareReferencePurchaseRequirements } from "./generated-plan-quote.ts";
import { quoteRegionalEstimates } from "./generated-regional-quote.ts";

const FLAG = "nominal-large-egg-edible50g-not-individual-mass-or-preparation-yield";
const amount = (n: number | string, d: number | string = 1) => ({ numerator: String(n), denominator: String(d) });
const json = (v: unknown) => Buffer.from(JSON.stringify(v));
function ready(f = fixture()) { const r = f.bind(); assert.equal(r.outcome, "ready"); if (r.outcome !== "ready") throw Error("Expected synthetic v5 group"); return { ...f, registry: r }; }
function prepared(f = ready()) { const result = f.registry.forFamilies({ familyIds: f.manifest.families.map(x => x.id), region: "South", asOfDate: "2026-10-19" }); assert.equal(result.outcome, "prepared"); if (result.outcome !== "prepared") throw Error("Expected synthetic dated group"); return { ...f, result }; }

test("explicit v5 exact raw-egg forms emit one source-bound nominal carton and visible uncertainty", () => {
  const { registry, result } = prepared();
  assert.equal(result.correspondences.length, 2); assert.equal(result.pantryPurchaseBindings.length, 1); assert.equal(result.regionalPackFacts.length, 1);
  for (const c of result.correspondences) assert.deepEqual(c.factor, { min: amount(1, 50), max: amount(1, 50) });
  assert.ok(result.sourceFlags.includes(FLAG)); assert.ok(result.regionalPackFacts[0]!.flags.includes(FLAG));
  assert.deepEqual(result.regionalPackFacts[0]!.packPriceCents, { min: 236, max: 237 });
  assert.equal(result.regionalPackFacts[0]!.basis, "synthetic-test-only");
  assert.equal(result.sourceTruthEstablished, false); assert.equal(result.cookedYieldEstablished, false); assert.equal(result.sourceAdoptionGranted, false);
  const whole = registry.forPlanning({ familyId: "whole-reference", region: "South", asOfDate: "2026-10-19" }), beaten = registry.forPlanning({ familyId: "beaten-reference", region: "South", asOfDate: "2026-10-19" });
  assert.equal(whole.outcome, "prepared"); assert.equal(beaten.outcome, "prepared");
  if (whole.outcome === "prepared" && beaten.outcome === "prepared") {
    assert.deepEqual(whole.regionalPackFacts, beaten.regionalPackFacts);
    assert.deepEqual(whole.pantryPurchaseBindings, beaten.pantryPurchaseBindings);
    assert.notEqual(whole.correspondences[0]!.ingredientId, beaten.correspondences[0]!.ingredientId);
  }
});

test("old versions, wrong scope/food/source and duplicate or unreviewed groups cannot grant count aliases", () => {
  const changes: ((f: ReturnType<typeof fixture>) => void)[] = [
    ...[1, 2, 3, 4].map(n => (f: ReturnType<typeof fixture>) => { f.manifest.schema = "wd-reviewed-public-pack-manifest-v" + n; }),
    f => { f.manifest.purchaseGroups[0]!.scope = "same-food-input-grams-no-physical-transition"; },
    f => { f.manifest.purchaseGroups = []; },
    f => { f.manifest.families[1]!.quantityBasis.kind = "large-raw-egg-reference"; },
    f => { f.manifest.families[1]!.purchase.skuId = "separate-carton"; },
    f => { f.manifest.families[1]!.purchase.unit = "g"; },
    f => { f.manifest.families[1]!.recordIds = [171129]; },
    f => { f.manifest.purchaseGroups[0]!.memberForms[1]!.recordIds = [171129]; },
    f => { f.manifest.purchaseGroups[0]!.memberFamilyIds = ["whole-reference"]; },
    f => { f.manifest.purchaseGroups[0]!.memberForms[1]!.ingredientSignature = "0".repeat(64); },
    f => { f.manifest.purchaseGroups[0]!.reviewedOn = "2026-10-18"; },
    f => { f.manifest.families[1]!.priceReviews = structuredClone(f.manifest.families[0]!.priceReviews); },
    f => { const claim = f.manifest.claims[2]!; if ("nominalQuantity" in claim) claim.nominalQuantity = amount(6); else throw Error("Expected synthetic package claim"); },
  ];
  for (const change of changes) { const f = fixture(); change(f); assert.equal(f.bind().outcome, "error"); }
  for (const state of ["raw, shell included", "cooked, scrambled", "raw egg white", "raw, shell removed, beaten "]) {
    const f = fixture(), form = { ...f.forms[1]!, state };
    f.manifest.families[1]!.exactForm = form; f.manifest.purchaseGroups[0]!.memberForms[1]!.exactForm = form;
    const matches = JSON.parse(f.sources.matches.toString()); matches.matches["2".repeat(64)].exact_form = form; f.sources.matches = json(matches);
    const rows = f.sources.catalog.toString().trim().split("\n").map(l => JSON.parse(l)); rows[1].recipe.ingredients[0].state = state;
    rows[1].recipe_sha256 = sha(JSON.stringify(canonicalReferenceData(rows[1].recipe))); rows[1].nutrition.source_refresh.exact_recipe_body_sha256 = rows[1].recipe_sha256; rows[1].nutrition.source_refresh.recipe_sha256_unchanged = rows[1].recipe_sha256;
    f.sources.catalog = Buffer.from(rows.map(r => JSON.stringify(r)).join("\n") + "\n"); f.manifest.catalogSha256 = sha(f.sources.catalog);
    assert.equal(f.bind().outcome, "error");
  }
});

test("resealed altered USDA portion/source metadata is refused, and source/date holds stay explicit", () => {
  for (const [key, value] of [["gram_weight", "49"], ["modifier", "medium"], ["raw_row_sha256", "0".repeat(64)], ["amount", "2"]]) {
    const f = fixture(), records = JSON.parse(f.sources.records.toString()); records["171287"].portions[0][key!] = value; f.sources.records = json(records); assert.equal(f.bind().outcome, "error");
  }
  const { registry } = ready();
  for (const region of ["Northeast", "Midwest", "West"]) assert.equal(registry.forFamilies({ familyIds: ["whole-reference", "beaten-reference"], region, asOfDate: "2026-10-19" }).outcome, "held");
  for (const asOfDate of ["2026-10-18", "2026-10-20"]) assert.equal(registry.forFamilies({ familyIds: ["whole-reference", "beaten-reference"], region: "South", asOfDate }).outcome, "held");
});

test("mixed raw forms combine once and independent fractional demand/stock/whole-carton arithmetic holds", () => {
  const { result, forms } = prepared(), fact = result.regionalPackFacts[0]!;
  for (let n = 0; n <= 25; n++) for (const d of [1, 3]) for (const owned of [0, 3, 12]) {
    const totalG = BigInt(n * 13 + (25 - n) * 17), denominator = BigInt(d * 50), heldCount = BigInt(owned);
    const demands = forms.map((f, i) => ({ assignmentId: "person-" + i, recipeId: "fixture-" + i, recipeSha256: "a".repeat(64), ingredientId: f.id, preparedState: f.state, baseUnit: "g", amount: amount(i ? (25 - n) * 17 : n * 13, d) }));
    const p = prepareReferencePurchaseRequirements(demands, result.correspondences); assert.equal(p.outcome, "prepared"); if (p.outcome !== "prepared") continue; assert.equal(p.requirements.length, 1);
    const q = quoteRegionalEstimates({ region: "South", storeIds: [], asOfDate: "2026-10-19", budgetCents: 10000 }, p.requirements, [{ skuId: fact.skuId, unit: "each", formDigest: fact.formDigest, quantity: { numerator: owned, denominator: 1 } }], result.regionalPackFacts);
    assert.equal(q.outcome, "quoted"); if (q.outcome !== "quoted") continue;
    const short = totalG > heldCount * denominator ? totalG - heldCount * denominator : BigInt(0), packs = (short + denominator * BigInt(12) - BigInt(1)) / (denominator * BigInt(12)), used = totalG < heldCount * denominator ? totalG : heldCount * denominator, row = q.rows[0]!;
    assert.equal(row.packCount, Number(packs)); assert.deepEqual(q.estimatedTotalCents, { min: Number(packs) * 236, max: Number(packs) * 237 });
    assert.equal(BigInt(row.ownedUsed.numerator) * denominator, used * BigInt(row.ownedUsed.denominator));
    assert.equal(BigInt(row.purchasedLeftover.numerator) * denominator, (packs * BigInt(12) * denominator - short) * BigInt(row.purchasedLeftover.denominator));
    assert.equal(q.uniqueBuyItemCount, packs ? 1 : 0);
  }
});

test("old original egg bridge is unchanged and new group has a distinct pantry/source basis", () => {
  const f = fixture(), old = { ...f.manifest, schema: "wd-reviewed-public-pack-manifest-v4", purchaseGroups: [], families: [{ ...f.manifest.families[0]!, quantityBasis: { kind: "large-raw-egg-reference", groupId: "" } }] };
  // Old basis has no groupId at all.
  const oldManifest = JSON.parse(JSON.stringify(old)); delete oldManifest.families[0].quantityBasis.groupId;
  const before = createReviewedPublicPackRegistry(f.sources, json(oldManifest), f.config(oldManifest)); assert.equal(before.outcome, "ready"); if (before.outcome !== "ready") return;
  const previous = before.quantityForFamily({ familyId: "whole-reference" }), current = ready(f).registry.quantityForFamily({ familyId: "whole-reference" });
  assert.equal(previous.outcome, "prepared"); assert.equal(current.outcome, "prepared");
  if (previous.outcome === "prepared" && current.outcome === "prepared") {
    assert.deepEqual(previous.correspondences[0]!.factor, current.correspondences[0]!.factor);
    assert.equal(previous.correspondences[0]!.formDigest, current.correspondences[0]!.formDigest);
    assert.notEqual(previous.correspondences[0]!.sourceSha256, current.correspondences[0]!.sourceSha256);
    assert.ok(!previous.sourceFlags.includes(FLAG)); assert.ok(current.sourceFlags.includes(FLAG));
  }
});

test("caller mutation, getters and duplicate batch requests cannot change or forge a count group", () => {
  const f = ready(), before = f.registry.quantityForFamily({ familyId: "beaten-reference" });
  f.manifest.purchaseGroups[0]!.sourceSha256 = "0".repeat(64); f.sources.records.fill(0);
  assert.deepEqual(f.registry.quantityForFamily({ familyId: "beaten-reference" }), before);
  let reads = 0; const query = { get familyIds() { reads++; return ["whole-reference"]; } };
  assert.equal(f.registry.quantityForFamilies(query).outcome, "error"); assert.equal(reads, 0);
  assert.equal(f.registry.forFamilies({ familyIds: ["whole-reference", "whole-reference"], region: "South", asOfDate: "2026-10-19" }).outcome, "error");
});
