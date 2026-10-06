import assert from "node:assert/strict";
import { test } from "node:test";
import { BASE } from "../../packages/solver/src/profiles.ts";
import { pricingStage, reviewedRequirements, weekSelectionRevision, evaluatePricedWeek } from "./store-estimate-week.ts";
import { solveReviewedRestricted, prepareReviewedSelection } from "./reviewed-selection.ts";
import { evaluateReviewedPantry, pantryBasis, REVIEWED_FAMILY_STRATEGY as STRATEGY, type OwnedPack } from "./reviewed-pantry.ts";
import { digest } from "./reviewed-week.ts";
import { evaluateWeek } from "../../packages/solver/src/engine.ts";
import { independentArithmetic } from "./reviewed-week-acceptance.ts";
import { toCanonical } from "../../packages/solver/src/units.ts";
import { decimalQuantity, multiply, ratio, quoteBaskets, strategyDigest, type QuoteRequest } from "./store-estimates.ts";
import { scopeKey, sealRecord } from "./store-estimate-model.ts";
import { fixtureModel, fixtureRequest, fixtureFacts, fixtureStores, fixtureCalibration, sourceFor, fixtureScope } from "./store-estimate-fixtures.ts";

const stage = pricingStage(), input = { ...BASE, seed: 7 }, allergies = ["soy"];
const out = solveReviewedRestricted(input, stage, allergies).out;
const ids = out.days.flatMap(d => d.items.map(i => i.recipe_id));
const sizes = Object.fromEntries(stage.edible.skus.map(s => [s.id, multiply(decimalQuantity(s.pack_qty), decimalQuantity(toCanonical(1, s.pack_unit, s)))]));
function args(profile = input, owned: OwnedPack[] = [], exclusions = allergies, legacy = false, edit?: (r: QuoteRequest) => void): Parameters<typeof quoteBaskets> {
  const requirements = reviewedRequirements(ids, profile, stage, owned, exclusions, STRATEGY);
  const model = fixtureModel([...new Set(requirements.requirements.map(r => r.category))]);
  const request = structuredClone(fixtureRequest(model, "split", fixtureStores.map(s => s.id), Math.round(profile.budget * 100)));
  request.selectionRevision = weekSelectionRevision(profile, stage, exclusions, legacy ? undefined : STRATEGY); edit?.(request);
  request.strategyPolicyDigest = strategyDigest(request);
  const facts = fixtureFacts(requirements.requirements, sizes), sources = sourceFor(facts, facts.map(f => f.cell));
  const raw = quoteBaskets(request, requirements.requirements, requirements.pantry, fixtureStores, facts, sources, model, []);
  const calibrations = [...raw.alternatives, ...(raw.split ? [raw.split] : [])].map(q => {
    assert.notEqual(q.rawCents, null);
    return fixtureCalibration(model, fixtureScope(request, requirements.requirements, q.scope.quotedStoreId), Array(9).fill(q.rawCents), `binding-test-${q.scopeDigest}`);
  });
  request.calibrationPins = calibrations.map(c => ({ scopeDigest: scopeKey(c.scope), digest: c.digest }));
  return [request, requirements.requirements, requirements.pantry, fixtureStores, facts, sources, model, calibrations];
}
const evaluate = (a = args(), profile = input, owned: OwnedPack[] = [], exclusions = allergies) => evaluatePricedWeek(ids, profile, stage, owned, exclusions, a, STRATEGY);

test("accepted soy week enters only the explicit family-preserving physical quote bridge", () => {
  const stage = pricingStage(), input = { ...BASE, seed: 7 };
  const selected = solveReviewedRestricted(input, stage, ["soy"]);
  assert.equal(selected.out.feasible, true);
  const ids = selected.out.days.flatMap(d => d.items.map(i => i.recipe_id));
  assert.throws(() => reviewedRequirements(ids, input, stage, [], ["soy"]), /not in the pool/);
  const checked = reviewedRequirements(ids, input, stage, [], ["soy"], "reviewed-family-v1");
  assert.equal(checked.food.violations.length, 0);
  assert.equal(checked.food.recipeIds.length, 15);
});

test("new policy is seed-stable and distinct; old callers and selection shapes remain unchanged", () => {
  const revision = weekSelectionRevision(input, stage, allergies, STRATEGY);
  assert.equal(revision, weekSelectionRevision({ ...input, seed: 19 }, stage, allergies, STRATEGY));
  assert.notEqual(revision, weekSelectionRevision(input, stage, allergies));
  const first = reviewedRequirements(ids, input, stage, [], allergies, STRATEGY);
  const again = reviewedRequirements(ids, { ...input, seed: 19 }, stage, [], allergies, STRATEGY);
  assert.equal(first.selection!.policyRevision, again.selection!.policyRevision);
  assert.notEqual(first.weekEvidenceDigest, again.weekEvidenceDigest);
  const normal = solveReviewedRestricted(input, stage).out.days.flatMap(d => d.items.map(i => i.recipe_id));
  const old = reviewedRequirements(normal, input, stage);
  assert.ok(!("selection" in old)); assert.ok(!("weekEvidenceDigest" in old));
  const selected = reviewedRequirements(normal, input, stage, [], [], STRATEGY);
  assert.deepEqual(old.requirements, selected.requirements); assert.deepEqual(old.pantry, selected.pantry);
  assert.deepEqual(old.food.days, selected.food.days); assert.deepEqual(old.food.rows, selected.food.rows);
  assert.throws(() => reviewedRequirements(ids, input, stage, [], allergies, "caller-policy" as never), /Unknown/);
});

test("related egg exclusion is bound to the actual reviewed graph and original quantities", () => {
  const selected = solveReviewedRestricted(input, stage, ["eggs"]);
  assert.equal(selected.out.feasible, true);
  const relatedIds = selected.out.days.flatMap(d => d.items.map(i => i.recipe_id));
  const checked = reviewedRequirements(relatedIds, input, stage, [], ["eggs"], STRATEGY);
  assert.equal(checked.food.violations.length, 0);
  assert.ok(!checked.requirements.some(r => r.skuId === "eggs"));
  assert.equal(independentArithmetic(selected.out, stage.edible, stage.basket, ["eggs"]).feasible, true);
  assert.notEqual(checked.selection!.policyRevision, weekSelectionRevision(input, stage, allergies, STRATEGY));
});

test("original source arithmetic and physical zero/partial/over-covered pantry remain honest", () => {
  const selection = prepareReviewedSelection(stage, input.diet, allergies);
  assert.deepEqual(evaluateWeek(ids, input, selection.snapshot), evaluateWeek(ids, input, stage.purchased));
  const checked = independentArithmetic(out, stage.edible, stage.basket, allergies);
  assert.equal(checked.feasible, true);
  const onion = stage.edible.skus.find(s => s.id === "onions")!;
  const owned = (fraction: number): OwnedPack[] => [{ skuId: onion.id, fraction, purchaseBasis: pantryBasis(onion) }];
  const base = evaluateReviewedPantry(ids, input, stage, [], allergies, STRATEGY);
  for (const fraction of [0, .5, 10]) {
    const current = evaluateReviewedPantry(ids, input, stage, owned(fraction), allergies, STRATEGY);
    assert.deepEqual(current.days, base.days);
    const a = base.rows.find(r => r.skuId === onion.id)!, b = current.rows.find(r => r.skuId === onion.id)!;
    assert.equal(a.edibleConsumed, b.edibleConsumed); assert.equal(a.trim, b.trim);
    assert.equal(b.ownedUsedPacks + b.ownedCarryoverPacks, fraction);
    assert.ok(Math.abs(b.buyPacks + b.ownedUsedPacks - b.requiredPacks - b.newCarryoverPacks) < 1e-9);
    const q = evaluate(args(input, owned(fraction)), input, owned(fraction));
    assert.equal(q.quotes.alternatives[0].foodViolations.length, 0);
  }
  for (const fraction of [-1, NaN, Infinity, 101]) assert.throws(() => reviewedRequirements(ids, input, stage, owned(fraction), allergies, STRATEGY));
  assert.throws(() => reviewedRequirements(ids, input, stage, [...owned(.5), ...owned(.5)], allergies, STRATEGY));
  assert.throws(() => reviewedRequirements(ids, input, stage, [{ ...owned(.5)[0], purchaseBasis: "stale" }], allergies, STRATEGY));
  assert.throws(() => reviewedRequirements(ids, { ...input, pantry: ["onions"] }, stage, [], allergies, STRATEGY), /infinite/);
});

test("edited/self-resealed source, ingredient, approval, family and unknown safety cannot enter bridge", () => {
  for (const mutate of [
    (s: typeof stage) => { s.basket.safety.oats.allergens = null; },
    (s: typeof stage) => { s.basket.safety.oats.status = "unreviewed"; },
    (s: typeof stage) => { s.basket.quantities.carrots.edible_per_purchased = 1; s.basket.source_digest = digest({ quantities: s.basket.quantities, safety: s.basket.safety, input_digest: s.basket.input_digest }); },
    (s: typeof stage) => { s.candidate_digest = "new approval"; },
    (s: typeof stage) => { s.purchased.recipe_variants.splice(0, 1); },
    (s: typeof stage) => { s.compiled.variants[0].recipe_id = "caller-family"; },
    (s: typeof stage) => { s.edible.recipe_ingredients[0].qty++; },
  ]) {
    const altered = structuredClone(stage); mutate(altered);
    assert.throws(() => reviewedRequirements(ids, input, altered, [], allergies, STRATEGY));
  }
  assert.throws(() => reviewedRequirements(ids, input, stage, [], ["unknown"], STRATEGY));
  assert.throws(() => reviewedRequirements(["unknown", ...ids.slice(1)], input, stage, [], allergies, STRATEGY));
});

test("new fixture quotes separate food/price and preserve cents and per-week bindings", () => {
  const a = args(), week = evaluate(a);
  assert.equal(week.quotes.alternatives.length, 3); assert.equal(week.quotes.split!.feasible, true);
  assert.deepEqual(week, evaluate(a));
  const edited = { ...input, protein_per_day: 300 }, cheap = evaluate(args(edited), edited);
  assert.equal(cheap.quotes.alternatives[0].withinBudget, true); assert.equal(cheap.quotes.alternatives[0].feasible, false);
  assert.ok(cheap.quotes.alternatives[0].failureKinds.includes("food"));
  assert.throws(() => evaluate(a, edited), /selection/);
  assert.doesNotThrow(() => evaluate(args({ ...input, budget: 64.01 }), { ...input, budget: 64.01 }));
  assert.throws(() => evaluate(args({ ...input, budget: 64.011 }), { ...input, budget: 64.011 }), /budget/);
  const changed = structuredClone(a); changed[1][0].purchasedNeed = ratio(1); assert.throws(() => evaluate(changed), /requirements/);
  const changedPantry = structuredClone(a); changedPantry[2].push({ skuId: a[1][0].skuId, unit: a[1][0].unit, formDigest: a[1][0].formDigest, quantity: ratio(1) });
  assert.throws(() => evaluate(changedPantry), /pantry/);
  assert.throws(() => evaluate(a, input, [], ["eggs"]), /selection/);
  assert.throws(() => evaluate(args(input, [], allergies, true)), /selection/);
});

test("old calibration or changed order/channel/charges/eligibility yields no usable total", () => {
  for (const edit of [
    (a: Parameters<typeof quoteBaskets>) => { a[0].storeIds.reverse(); },
    (a: Parameters<typeof quoteBaskets>) => { a[0].channel = "pickup"; },
    (a: Parameters<typeof quoteBaskets>) => { a[0].charges.push({ id: "fixture-charge", cents: 10, storeId: null }); a[0].strategyPolicyDigest = strategyDigest(a[0]); },
    (a: Parameters<typeof quoteBaskets>) => { a[0].membershipIds.push("fixture-member"); a[0].strategyPolicyDigest = strategyDigest(a[0]); },
    (a: Parameters<typeof quoteBaskets>) => { a[0].calibrationPins[0].digest = "stale"; },
    (a: Parameters<typeof quoteBaskets>) => { for (const c of a[7]) c.scope.selectionRevision = weekSelectionRevision(input, stage, allergies); },
  ]) {
    const a = args(); edit(a); const q = evaluate(a).quotes;
    if (a[0].calibrationPins[0].digest === "stale") assert.equal(q.alternatives[0].totalCents, null);
    else assert.ok([...q.alternatives, q.split!].every(x => x.totalCents === null && x.feasible === false));
  }
  const region = args(); region[0].region = "unknown"; assert.throws(() => evaluate(region), /region/);
  const stale = args(); stale[0].policy.asOf = "2026-10-20T18:00:00Z"; assert.throws(() => evaluate(stale), /stale/);
  const observed = args(); observed[4][0].evidence.kind = "observed"; assert.throws(() => evaluate(observed), /fixture-only/);
});

test("missing offers, raw baseline cells, unavailable stock and search bounds fail closed", () => {
  const remove = args(); const sku = remove[1][0].skuId; remove[4] = remove[4].filter(f => f.skuId !== sku);
  assert.ok([...evaluate(remove).quotes.alternatives, evaluate(remove).quotes.split!].every(q => q.totalCents === null));
  const unavailable = args(); unavailable[4] = unavailable[4].map(f => sealRecord({ ...f, availablePacks: 0 })); unavailable[5] = sourceFor(unavailable[4], unavailable[4].map(f => f.cell));
  assert.equal(evaluate(unavailable).quotes.split!.totalCents, null);
  const unsupported = args(); unsupported[4] = unsupported[4].map(f => sealRecord({ ...f, mode: "baseline", cell: { ...f.cell, channel: "pickup" } }));
  unsupported[0].channel = "pickup"; unsupported[5] = sourceFor(unsupported[4], unsupported[4].map(f => f.cell));
  assert.equal(evaluate(unsupported).quotes.split!.rawCents, null);
  const bounded = args(); bounded[4] = bounded[4].map(f => sealRecord({ ...f, packQuantity: ratio(1, 100000), availablePacks: 1000 })); bounded[5] = sourceFor(bounded[4], bounded[4].map(f => f.cell));
  const bound = evaluate(bounded).quotes.split!; assert.equal(bound.rawCents, null); assert.ok(bound.reasons.some(r => r.includes("search bound")));
  const one = args(input, [], allergies, false, r => { r.storeIds = [fixtureStores[0].id]; r.intent = "alternatives"; });
  const single = evaluate(one); assert.equal(single.quotes.split, null); assert.equal(single.quotes.alternatives.length, 1); assert.equal(single.quotes.alternatives[0].feasible, true);
});
