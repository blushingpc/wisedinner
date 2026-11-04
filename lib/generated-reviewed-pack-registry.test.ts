import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { setup } from "./generated-joined-plan.test-support.ts";
import { createReviewedPublicPackRegistry } from "./generated-reviewed-pack-registry.ts";
import { quoteRegionalEstimates } from "./generated-regional-quote.ts";
import { prepareReferencePurchaseRequirements } from "./generated-plan-quote.ts";
import { createPantryIntake } from "./generated-plan-pantry.ts";

const sha = (x: string | Uint8Array) => createHash("sha256").update(x).digest("hex");
const amount = (n: number | string, d: number | string = 1) => ({ numerator: String(n), denominator: String(d) });
const json = (x: unknown) => Buffer.from(JSON.stringify(x));
const SIGNATURE = "1".repeat(64);
function fixture() {
  const { bytes, rows } = setup(), form = { id: "food-a", name: "Synthetic only", state: "raw", unit: "g" };
  const matches = json({ matches: { [SIGNATURE]: { exact_form: form, status: "conditional-reference", record_ids: [10], flags: [], holds: [] } } });
  const records = json({ "10": { fdc_id: 10, description: "Synthetic source food", raw_food_row_sha256: "2".repeat(64), portions: [] } });
  const point = { series_id: "APU0300701312", area_code: "0300", item_code: "701312", region: "South", currency: "USD", source_kind: "bls-average-retail-price", product: "Synthetic unit-price source", period: "2026-09", unit: "lb", unit_amount: "1", value: "2.500", source_ids: ["point"] };
  const snapshot = (observations: unknown[]) => json({ schema: "wisedinner-bls-average-price-v1", source_kind: "bls-average-retail-price", currency: "USD", as_of: "2026-10-14", status: "partial-observations", observations, sources: [{ id: "point", sha256: "3".repeat(64) }] });
  const sources = { catalog: bytes, matches, records, staples: snapshot([point]), produce: snapshot([]) };
  const shared = { ingredientSignature: SIGNATURE, sourceUrl: "https://example.invalid/synthetic-only", sourceSha256: "4".repeat(64), reviewedOn: "2026-10-19", evidenceLevel: "synthetic-test-only", description: "Explicitly fictional protocol source, not food truth or market data" };
  const manifest = { schema: "wd-reviewed-public-pack-manifest-v1", catalogSha256: sha(bytes), claims: [
    { ...shared, id: "package", kind: "package-reference", purchaseState: "raw", unit: "g", nominalQuantity: amount(500) },
    { ...shared, id: "category", kind: "price-category-reference", product: point.product, priceScope: "conditional-category-unit-model" },
  ], families: [{ id: "family-a", ingredientSignature: SIGNATURE, exactForm: form, recordIds: [10], purchase: { skuId: "registry-a", state: "raw", unit: "g", category: "pantry", perishable: false }, quantityBasis: { kind: "same-state-identity" }, packageClaimId: "package", priceReviews: [{ id: "south-september", region: "South", seriesId: point.series_id, product: point.product, period: "2026-09", categoryClaimId: "category", reviewEffectiveFrom: "2026-10-19", usableThrough: "2026-10-19" }] }] };
  function config(manifestValue: unknown = manifest) { return { catalog: { sha256: sha(sources.catalog), recordCount: rows.length }, matches: { sha256: sha(sources.matches) }, records: { sha256: sha(sources.records) }, staples: { sha256: sha(sources.staples), observations: 1 }, produce: { sha256: sha(sources.produce), observations: 0 }, manifestSha256: sha(json(manifestValue)) }; }
  return { sources, manifest, config, rows, bind: () => createReviewedPublicPackRegistry(sources, json(manifest), config()) };
}
const query = (changes = {}) => ({ familyId: "family-a", region: "South", asOfDate: "2026-10-19", ...changes });
function ready(f = fixture()) { const r = f.bind(); assert.equal(r.outcome, "ready"); if (r.outcome !== "ready") throw Error("Expected private synthetic registry"); return { ...f, registry: r }; }
function prepared(f = ready()) { const r = f.registry.forPlanning(query()); assert.equal(r.outcome, "prepared"); if (r.outcome !== "prepared") throw Error("Expected reviewed private facts"); return { ...f, result: r }; }

test("trusted reviewed manifest binds exact sources and emits private existing fact shapes", () => {
  const { registry, result } = prepared();
  assert.equal(registry.families.length, 1); assert.equal(registry.families[0]!.recipeReferences, 1);
  assert.equal(result.correspondences.length, 1); assert.equal(result.pantryPurchaseBindings.length, 1); assert.equal(result.regionalPackFacts.length, 1);
  assert.deepEqual(result.correspondences[0]!.factor, { min: amount(1), max: amount(1) });
  assert.equal(result.regionalPackFacts[0]!.observedOn, null); assert.deepEqual(result.regionalPackFacts[0]!.monthlyPriceBasis, { observationPeriod: "2026-09", publishedOn: null, knownAvailableBy: "2026-10-14", reviewEffectiveFrom: "2026-10-19" });
  assert.equal(result.sourceAdoptionGranted, false); assert.equal(result.completeRegistryEstablished, false); assert.equal(result.regionalPackFacts[0]!.basis, "synthetic-test-only");
  assert.ok(Object.isFrozen(result.regionalPackFacts[0]!.packQuantity)); assert.ok(result.regionalPackFacts[0]!.flags.includes("integer-cent-enclosure-not-market-error-bound"));
});

test("changed missing added source bytes or wrong trusted manifest hash refuse before use", () => {
  const f = fixture();
  for (const key of Object.keys(f.sources) as (keyof typeof f.sources)[]) { const changed = { ...f.sources, [key]: Buffer.from(f.sources[key]) }; changed[key][0] ^= 1; assert.equal(createReviewedPublicPackRegistry(changed, json(f.manifest), f.config()).outcome, "error"); const missing: Record<string, unknown> = { ...f.sources }; delete missing[key]; assert.equal(createReviewedPublicPackRegistry(missing, json(f.manifest), f.config()).outcome, "error"); }
  assert.equal(createReviewedPublicPackRegistry({ ...f.sources, activation: true }, json(f.manifest), f.config()).outcome, "error");
  assert.equal(createReviewedPublicPackRegistry(f.sources, json(f.manifest), { ...f.config(), manifestSha256: "0".repeat(64) }).outcome, "error");
});

test("resealed wrong food state record category claim and identity yield cannot grant facts", () => {
  const changes = [
    (m: ReturnType<typeof fixture>["manifest"]) => { m.families[0]!.exactForm.name = "different food"; },
    (m: ReturnType<typeof fixture>["manifest"]) => { m.families[0]!.recordIds = [11]; },
    (m: ReturnType<typeof fixture>["manifest"]) => { m.families[0]!.purchase.state = "cooked"; },
    (m: ReturnType<typeof fixture>["manifest"]) => { m.families[0]!.purchase.unit = "ml"; },
    (m: ReturnType<typeof fixture>["manifest"]) => { m.claims[1]!.ingredientSignature = "f".repeat(64); },
    (m: ReturnType<typeof fixture>["manifest"]) => { m.families[0]!.priceReviews[0]!.product = "unreviewed price"; },
    (m: ReturnType<typeof fixture>["manifest"]) => { m.families[0]!.priceReviews[0]!.region = "West"; },
  ];
  for (const change of changes) { const f = fixture(), m = structuredClone(f.manifest); change(m); assert.equal(createReviewedPublicPackRegistry(f.sources, json(m), f.config(m)).outcome, "error"); }
  const f = fixture(), m = { ...f.manifest, freePrices: true }; assert.equal(createReviewedPublicPackRegistry(f.sources, json(m), f.config(m)).outcome, "error");
});

test("absent regional point and outside reviewed dates stay held without national or historical fallback", () => {
  const { registry } = ready();
  for (const asOfDate of ["2026-10-13", "2026-10-14", "2026-10-18", "2026-10-20"]) assert.equal(registry.forPlanning(query({ asOfDate })).outcome, "held");
  for (const region of ["Northeast", "Midwest", "West"]) assert.equal(registry.forPlanning(query({ region })).outcome, "held");
  assert.equal(registry.forPlanning(query({ familyId: "unknown-family" })).outcome, "held");
  for (const value of [query({ asOfDate: "2026-02-30" }), query({ region: "unknown" }), query({ accept: true })]) assert.equal(registry.forPlanning(value).outcome, "error");
});

test("date and duplicate ambiguity are explicit and no review predates source availability", () => {
  const f = fixture();
  for (const change of [(m: typeof f.manifest) => { m.families[0]!.priceReviews[0]!.reviewEffectiveFrom = "2026-10-13"; }, (m: typeof f.manifest) => { m.families[0]!.priceReviews[0]!.usableThrough = "2026-10-18"; }, (m: typeof f.manifest) => { m.families.push(structuredClone(m.families[0]!)); }]) { const m = structuredClone(f.manifest); change(m); assert.equal(createReviewedPublicPackRegistry(f.sources, json(m), f.config(m)).outcome, "error"); }
  const m = structuredClone(f.manifest); m.families[0]!.priceReviews.push({ ...m.families[0]!.priceReviews[0]!, id: "second-active-review" });
  const registry = createReviewedPublicPackRegistry(f.sources, json(m), f.config(m)); assert.equal(registry.outcome, "ready"); if (registry.outcome === "ready") assert.equal(registry.forPlanning(query()).outcome, "held");
});

test("exact derived pack price and pantry conservation agree with independent rational inequalities", () => {
  const { result } = prepared(), fact = result.regionalPackFacts[0]!, correspondence = result.correspondences[0]!;
  //500g times2.5USD/lb; exact cents=12500000000/45359237, not a new market interval.
  assert.deepEqual(fact.packPriceCents, { min: 275, max: 276 });
  for (let n = 0; n <= 50; n++) for (const d of [1, 2, 3, 7]) {
    const demands = [{ assignmentId: "private", recipeId: "a", recipeSha256: "e".repeat(64), ingredientId: "food-a", preparedState: "raw", baseUnit: "g", amount: amount(n * 100, d) }];
    const p = prepareReferencePurchaseRequirements(demands, [correspondence]); assert.equal(p.outcome, "prepared"); if (p.outcome !== "prepared") throw Error("Expected same-state reference");
    if (!n) { assert.equal(p.requirements.length, 0); continue; }
    const q = quoteRegionalEstimates({ region: "South", storeIds: ["unchanged-store"], asOfDate: "2026-10-19", budgetCents: 10000 }, p.requirements, [{ skuId: fact.skuId, unit: "g", formDigest: fact.formDigest, quantity: { numerator: 100, denominator: 1 } }], [fact]); assert.equal(q.outcome, "quoted"); if (q.outcome !== "quoted") throw Error("Expected fixture quote");
    const short = Math.max(n * 100 - d * 100, 0), packs = Math.ceil(short / (d * 500)), row = q.rows[0]!; assert.equal(row.packCount, packs); assert.deepEqual(q.estimatedTotalCents, { min: 275 * packs, max: 276 * packs });
    assert.equal(BigInt(row.purchasedLeftover.numerator) * BigInt(d), BigInt(packs * 500 * d - short) * BigInt(row.purchasedLeftover.denominator));
  }
  const intake = createPantryIntake({ measureFacts: [], purchaseBindings: result.pantryPurchaseBindings }); assert.equal(intake.outcome, "ready"); if (intake.outcome !== "ready") throw Error("Expected same-state binding");
  assert.equal(intake.prepare([{ pantryId: "unknown-bag", kind: "known", ingredientId: "food-a", preparedState: "raw", baseUnit: "g", amount: amount(1, 2), unit: "package-fraction" }]).outcome, "held");
});

test("source manifest configuration and typed-array mutation cannot change a constructed registry", () => {
  const f = fixture(), config = f.config(), manifestBytes = json(f.manifest), registry = createReviewedPublicPackRegistry(f.sources, manifestBytes, config); assert.equal(registry.outcome, "ready"); if (registry.outcome !== "ready") return;
  const before = registry.forPlanning(query()); f.sources.staples[0] ^= 1; manifestBytes[0] ^= 1; config.catalog.sha256 = "0".repeat(64); f.manifest.families[0]!.purchase.skuId = "changed";
  assert.deepEqual(registry.forPlanning(query()), before); assert.equal(Object.isFrozen(config), false); assert.equal(Object.isFrozen(config.catalog), false);
});

test("constructor/query getters sparse unknown grants and JSON duplicate keys refuse without invocation", () => {
  const f = fixture(); let reads = 0;
  const sources = Object.defineProperty({ ...f.sources }, "catalog", { enumerable: true, get() { reads++; throw Error("Not invoked"); } });
  assert.equal(createReviewedPublicPackRegistry(sources, json(f.manifest), f.config()).outcome, "error");
  const config = Object.defineProperty({ ...f.config() }, "manifestSha256", { enumerable: true, get() { reads++; throw Error("Not invoked"); } }); assert.equal(createReviewedPublicPackRegistry(f.sources, json(f.manifest), config).outcome, "error");
  const { registry } = ready(); const q = Object.defineProperty(query(), "asOfDate", { enumerable: true, get() { reads++; throw Error("Not invoked"); } }); assert.equal(registry.forPlanning(q).outcome, "error");
  const duplicate = Buffer.from('{"schema":"wd-reviewed-public-pack-manifest-v1","schema":"forged"}'); assert.equal(createReviewedPublicPackRegistry(f.sources, duplicate, { ...f.config(), manifestSha256: sha(duplicate) }).outcome, "error"); assert.equal(reads, 0);
  const sparse = { ...f.manifest, families: new Array(1) }; assert.equal(createReviewedPublicPackRegistry(f.sources, json(sparse), f.config(sparse)).outcome, "error");
  const hostileBytes = new Uint8Array(f.sources.catalog); Object.defineProperty(hostileBytes, "byteLength", { get() { reads++; throw Error("Native bytes only"); } });
  assert.equal(createReviewedPublicPackRegistry({ ...f.sources, catalog: hostileBytes }, json(f.manifest), f.config()).outcome, "ready"); assert.equal(reads, 0);
});

test("subcent and huge modeled packs hold without zero prices or unsafe numeric conversion", () => {
  for (const quantity of [amount(1, 1000000), amount("1" + "0".repeat(100))]) {
    const f = fixture(), m = structuredClone(f.manifest), packageClaim = m.claims[0]!; if (!("nominalQuantity" in packageClaim)) throw Error("Expected package fixture"); packageClaim.nominalQuantity = quantity;
    const registry = createReviewedPublicPackRegistry(f.sources, json(m), f.config(m)); assert.equal(registry.outcome, "ready"); if (registry.outcome !== "ready") throw Error("Valid reference with quote capacity hold");
    const result = registry.forPlanning(query()); assert.deepEqual(result, { outcome: "held", code: "reviewed_pack_price_capacity", regionalPackFacts: [] });
  }
});

test("absent explicit month cannot borrow latest point and dimension gaps remain held", () => {
  const f = fixture(), m = structuredClone(f.manifest); m.families[0]!.priceReviews[0]!.period = "2026-08";
  const missing = createReviewedPublicPackRegistry(f.sources, json(m), f.config(m)); assert.equal(missing.outcome, "ready"); if (missing.outcome === "ready") assert.deepEqual(missing.forPlanning(query()), { outcome: "held", code: "reviewed_public_price_unavailable", regionalPackFacts: [] });
  const changed = fixture(), data = JSON.parse(changed.sources.staples.toString()); data.observations[0].unit = "gallon"; changed.sources.staples = json(data);
  const dimensions = changed.bind(); assert.equal(dimensions.outcome, "ready"); if (dimensions.outcome === "ready") assert.equal(dimensions.forPlanning(query()).outcome, "held");
});

test("nominal package source and source-defined pack claim cannot override physical/category review", () => {
  const f = fixture();
  const invalid = [
    { ...f.manifest, claims: f.manifest.claims.map((x, i) => i === 1 ? { ...x, priceScope: "source-defined-dozen-pack" } : x) },
    { ...f.manifest, claims: f.manifest.claims.map((x, i) => i === 0 ? { ...x, nominalQuantity: amount(1, 0) } : x) },
    { ...f.manifest, families: [{ ...f.manifest.families[0]!, quantityBasis: { kind: "invented-cooked-yield", factor: amount(3) } }] },
    { ...f.manifest, families: [{ ...f.manifest.families[0]!, quantityBasis: { kind: "large-raw-egg-reference" } }] },
  ];
  for (const m of invalid) assert.equal(createReviewedPublicPackRegistry(f.sources, json(m), f.config(m)).outcome, "error");
});

test("claim ordering and unused reference additions do not silently reprice or change selected fact proof", () => {
  const f = fixture(), first = prepared(ready(f)).result;
  const m = { ...f.manifest, claims: [...f.manifest.claims].reverse() };
  const reordered = createReviewedPublicPackRegistry(f.sources, json(m), f.config(m)); assert.equal(reordered.outcome, "ready"); if (reordered.outcome === "ready") assert.deepEqual(reordered.forPlanning(query()), first);
  const unused = { ...f.manifest, claims: [...f.manifest.claims, { ...f.manifest.claims[0]!, id: "unused-claim" }] };
  const expanded = createReviewedPublicPackRegistry(f.sources, json(unused), f.config(unused)); assert.equal(expanded.outcome, "ready"); if (expanded.outcome === "ready") assert.deepEqual(expanded.forPlanning(query()), first);
});

test("empty partial registry stays explicitly incomplete and oversized manifest is rejected before parse", () => {
  const f = fixture(), m = { ...f.manifest, families: [] };
  const empty = createReviewedPublicPackRegistry(f.sources, json(m), f.config(m)); assert.equal(empty.outcome, "ready"); if (empty.outcome === "ready") { assert.deepEqual(empty.families, []); assert.equal(empty.completeRegistryEstablished, false); assert.equal(empty.forPlanning(query()).outcome, "held"); }
  const oversized = Buffer.alloc(1024 * 1024 + 1, " "); assert.equal(createReviewedPublicPackRegistry(f.sources, oversized, { ...f.config(), manifestSha256: sha(oversized) }).outcome, "error");
});

test("reviewed quantity bindings remain usable for fully owned food without a missing-price zero fallback", () => {
  const f = fixture(), m = structuredClone(f.manifest); m.families[0]!.priceReviews = [];
  const registry = createReviewedPublicPackRegistry(f.sources, json(m), f.config(m)); assert.equal(registry.outcome, "ready"); if (registry.outcome !== "ready") throw Error("Expected unpriced reviewed quantity");
  assert.equal(registry.forPlanning(query()).outcome, "held");
  const quantity = registry.quantityForFamily({ familyId: "family-a" }); assert.equal(quantity.outcome, "prepared"); if (quantity.outcome !== "prepared") throw Error("Expected independent quantity binding"); assert.equal(quantity.regionalPricesIncluded, false);
  const prepared = prepareReferencePurchaseRequirements([{ assignmentId: "owned", recipeId: "a", recipeSha256: "e".repeat(64), ingredientId: "food-a", preparedState: "raw", baseUnit: "g", amount: amount(500) }], quantity.correspondences); assert.equal(prepared.outcome, "prepared"); if (prepared.outcome !== "prepared") throw Error("Expected demand");
  const c = quantity.correspondences[0]!, request = { region: "South", storeIds: ["unchanged-store"], budgetCents: 0, asOfDate: "2026-10-19" };
  const owned = (n: number) => [{ skuId: c.skuId, unit: c.purchaseUnit, formDigest: c.formDigest, quantity: { numerator: n, denominator: 1 } }];
  const covered = quoteRegionalEstimates(request, prepared.requirements, owned(600), []); assert.equal(covered.outcome, "quoted"); if (covered.outcome === "quoted") { assert.deepEqual(covered.estimatedTotalCents, { min: 0, max: 0 }); assert.deepEqual(covered.ownedRemaining[0]!.quantity, amount(100)); }
  assert.deepEqual(quoteRegionalEstimates(request, prepared.requirements, owned(499), []), { outcome: "held", code: "regional_pack_fact_needed" });
  assert.equal(registry.quantityForFamily({ familyId: "missing" }).outcome, "held"); assert.equal(registry.quantityForFamily({ familyId: "family-a", region: "South" }).outcome, "error");
});

test("adding a price review cannot relabel an unchanged original pantry quantity mapping", () => {
  const f = fixture(), unpriced = structuredClone(f.manifest); unpriced.families[0]!.priceReviews = [];
  const before = createReviewedPublicPackRegistry(f.sources, json(unpriced), f.config(unpriced)), after = f.bind(); assert.equal(before.outcome, "ready"); assert.equal(after.outcome, "ready"); if (before.outcome !== "ready" || after.outcome !== "ready") throw Error("Expected separate quantity/price stages");
  assert.deepEqual(after.quantityForFamily({ familyId: "family-a" }), before.quantityForFamily({ familyId: "family-a" }));
});

test("original source warnings survive quantity and price preparation without clearing source holds", () => {
  const f = fixture(), original = JSON.parse(f.sources.matches.toString());
  original.matches[SIGNATURE].flags = ["original-source-warning"];
  f.sources.matches = json(original);
  const { registry, result } = prepared(ready(f));
  assert.deepEqual(registry.families[0]!.sourceFlags, ["original-source-warning"]);
  const quantity = registry.quantityForFamily({ familyId: "family-a" });
  assert.equal(quantity.outcome, "prepared");
  if (quantity.outcome !== "prepared") throw Error("Expected quantity with retained warning");
  assert.deepEqual(quantity.sourceFlags, ["original-source-warning"]);
  assert.deepEqual(result.sourceFlags, ["original-source-warning"]);
  assert.ok(result.regionalPackFacts[0]!.flags.includes("original-source-warning"));
});

test("held or malformed original source uncertainty refuses even with newly reviewed manifest pins", () => {
  for (const fields of [
    { flags: [], holds: ["pending-source-evidence"] },
    { flags: [42], holds: [] }, { flags: [], holds: "not-an-array" },
    { flags: Array.from({ length: 51 }, (_, i) => "warning-" + i), holds: [] },
    { flags: [""], holds: [] },
  ]) {
    const f = fixture(), original = JSON.parse(f.sources.matches.toString());
    Object.assign(original.matches[SIGNATURE], fields); f.sources.matches = json(original);
    assert.deepEqual(f.bind(), { outcome: "error", code: "invalid_reviewed_pack_evidence" });
  }
});
