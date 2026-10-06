// Exclusive offline evidence. All prices, offers and measurement units are explicitly fictional.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import { platform, totalmem } from "node:os";
import { BASE, PROFILES } from "../../packages/solver/src/profiles.ts";
import type { SolveInput } from "../../packages/solver/src/types.ts";
import { evaluateWeek } from "../../packages/solver/src/engine.ts";
import { toCanonical } from "../../packages/solver/src/units.ts";
import { prepareReviewedSelection, solveReviewedRestricted, reviewedCandidates } from "./reviewed-selection.ts";
import { digest } from "./reviewed-week.ts";
import { independentArithmetic } from "./reviewed-week-acceptance.ts";
import { independentQuote } from "./store-estimate-acceptance.ts";
import { pricingStage, reviewedRequirements, weekSelectionRevision, evaluatePricedWeek } from "./store-estimate-week.ts";
import { pantryBasis, REVIEWED_FAMILY_STRATEGY as STRATEGY, type OwnedPack } from "./reviewed-pantry.ts";
import { quoteBaskets, formKey, ratio, decimalQuantity, multiply, strategyDigest, type Requirement } from "./store-estimates.ts";
import { scopeKey, verifyPhaseSeparation, sealRecord, evaluateHeldOut, type Calibration, type BasketObservation } from "./store-estimate-model.ts";
import { fixtureModel, fixtureRequest, fixtureFacts, fixtureStores, fixtureCalibration, sourceFor, evidence, fixturePolicy } from "./store-estimate-fixtures.ts";

export function runReviewedQuoteAcceptance(target: string) {
  const root = resolve("C:/Users/borgh/.codex/.chatgpt-projects/g-p-6abe316af67c8191ad1f0305474b416f/backend-loop/runs");
  const output = resolve(target), rel = relative(root, output);
  if (!isAbsolute(target) || rel.startsWith("..") || isAbsolute(rel) || !rel || existsSync(output)) throw Error("New exclusive run evidence directory required");
  mkdirSync(output);
  const save = (name: string, value: unknown) => writeFileSync(resolve(output, name), JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
  const started = performance.now();
  save("started.json", { startedAt: new Date().toISOString(), fixtureOnly: true, strategy: STRATEGY });
  const stage = pricingStage(), model = fixtureModel([...new Set(stage.edible.skus.map(s => s.aisle))]);
  const packSizes = Object.fromEntries(stage.edible.skus.map(s => [s.id, multiply(decimalQuantity(s.pack_qty), decimalQuantity(toCanonical(1, s.pack_unit, s)))]));
  // One frozen offer table for this experiment: recipe ordering cannot rewrite an offer's price.
  const allRequirements: Requirement[] = stage.edible.skus.map(sku => {
    const review = stage.basket.quantities[sku.id];
    return { skuId: sku.id, category: sku.aisle, unit: sku.canonical_unit, perishable: sku.perishable, purchasedNeed: ratio(1),
      formDigest: formKey({ skuId: sku.id, unit: sku.canonical_unit, identity: review.identity, sourceBasis: review.source_basis,
        source: review.source, yield: review.edible_per_purchased, sourceDigest: stage.basket.source_digest }) };
  });
  const facts = fixtureFacts(allRequirements, packSizes), sources = sourceFor(facts, facts.map(f => f.cell));
  const frozenFacts = digest(facts), onion = stage.edible.skus.find(s => s.id === "onions")!;
  const owned = (fraction: number): OwnedPack[] => [{ skuId: onion.id, fraction, purchaseBasis: pantryBasis(onion) }];
  const idsOf = (out: ReturnType<typeof solveReviewedRestricted>["out"]) => out.days.flatMap(d => d.items.map(i => i.recipe_id));
  const allCal: BasketObservation[] = [], allHeld: BasketObservation[] = [];
  const summaries: object[] = [], phases: object[] = [], originalFiles = new Map<string, string>();
  const selection = prepareReviewedSelection(stage, "none", ["soy"]);
  save("pins.json", { strategy: STRATEGY, counts: stage.counts, sourceDigest: stage.basket.source_digest, catalogDigest: digest(stage.edible),
    candidateDigest: stage.candidate_digest, purchaseDigest: digest(stage.purchased), modelDigest: model.digest, factsDigest: frozenFacts,
    soyProjectionDigest: selection.projectionDigest, provenance: selection.provenance });
  save("model.json", model); save("fixed-fictional-offers.json", { facts, sources, originalReviewedPackSizes: packSizes, order: stage.edible.skus.map(s => s.id) });
  const failingInput = { ...BASE, seed: 7 }, failingIds = idsOf(solveReviewedRestricted(failingInput, stage, ["soy"]).out);
  assert.throws(() => reviewedRequirements(failingIds, failingInput, stage, [], ["soy"]), /not in the pool/);
  save("legacy-rejection.json", { actualSelectedIds: failingIds, input: failingInput, allergies: ["soy"], legacyRejected: true,
    optIn: reviewedRequirements(failingIds, failingInput, stage, [], ["soy"], STRATEGY) });

  function foodCheck(ids: string[], input: SolveInput, allergies: string[], pantry: OwnedPack[]) {
    const projected = prepareReviewedSelection(stage, input.diet, allergies);
    const original = evaluateWeek(ids, input, stage.purchased);
    assert.deepEqual(original, evaluateWeek(ids, input, projected.snapshot));
    const independent = independentArithmetic(original, stage.edible, stage.basket, allergies);
    const checked = reviewedRequirements(ids, input, stage, pantry, allergies, STRATEGY);
    for (const row of independent.rows) {
      const r = checked.requirements.find(r => r.skuId === row.sku_id)!;
      assert(Math.abs(r.purchasedNeed.numerator / r.purchasedNeed.denominator - row.usedPurchased) < 1e-8);
      const balance = checked.food.rows.find(r => r.skuId === row.sku_id)!;
      assert.equal(balance.edibleConsumed, row.edible); assert.equal(balance.trim, row.preparationRefuse);
      assert(Math.abs(balance.buyPacks + balance.ownedUsedPacks - balance.requiredPacks - balance.newCarryoverPacks) < 1e-8);
      assert.equal(balance.ownedUsedPacks + balance.ownedCarryoverPacks, pantry.find(p => p.skuId === row.sku_id)?.fraction ?? 0);
    }
    assert.deepEqual(checked.food.days, independent.days);
    return { checked, independent, projectedFamilyDigest: digest(projected.provenance.members), originalFamilies: independent.repeats };
  }
  function prepare(input: SolveInput, allergies: string[], name: string, storeIds = fixtureStores.map(s => s.id)) {
    const request = structuredClone(fixtureRequest(model, storeIds.length === 1 ? "alternatives" : "split", storeIds, Math.round(input.budget * 100)));
    request.selectionRevision = weekSelectionRevision(input, stage, allergies, STRATEGY); request.strategyPolicyDigest = strategyDigest(request);
    const groups = new Map<string, { scope: Calibration["scope"]; raw: number[]; traces: object[] }>();
    for (let seed = 101; seed <= 109; seed++) {
      const profile = { ...input, seed }, selected = solveReviewedRestricted(profile, stage, allergies);
      assert.deepEqual(selected.out, solveReviewedRestricted(profile, stage, allergies).out);
      assert(selected.searchedSnapshot.recipes.length <= 96);
      const ids = idsOf(selected.out), pantry = seed % 2 ? owned(.25) : [], proof = foodCheck(ids, profile, allergies, pantry);
      const raw = quoteBaskets(request, proof.checked.requirements, proof.checked.pantry, fixtureStores, facts, sources, model, []);
      for (const q of [...raw.alternatives, ...(raw.split ? [raw.split] : [])]) {
        assert.notEqual(q.rawCents, null, q.reasons.join(";")); independentQuote(q, undefined, request, facts, model);
        const key = scopeKey(q.scope), g = groups.get(key) ?? { scope: q.scope, raw: [], traces: [] };
        g.raw.push(q.rawCents!); g.traces.push({ seed, recipeIds: ids, input: profile, owned: pantry, independent: proof.independent,
          requirements: proof.checked.requirements, pantry: proof.checked.pantry, weekEvidenceDigest: proof.checked.weekEvidenceDigest,
          familyCounts: proof.originalFamilies, rawQuote: q, requestDigest: raw.requestDigest, inputDigest: raw.inputDigest }); groups.set(key, g);
      }
    }
    const calibrations = [...groups.entries()].map(([key, g]) => {
      assert.equal(g.raw.length, 9);
      const calibration = fixtureCalibration(model, g.scope, g.raw, `reviewed-binding-${name}-${key}`);
      allCal.push(...calibration.rows); phases.push({ name, key, calibrationDigest: calibration.digest });
      save(`calibration-${name}-${key}.json`, { calibration, traces: g.traces, limits: "Fictional independent units and synthetic error measurements, not real-store evidence." });
      return calibration;
    });
    request.calibrationPins = calibrations.map(c => ({ scopeDigest: scopeKey(c.scope), digest: c.digest }));
    verifyPhaseSeparation(model.samples, allCal, allHeld);
    return { request, calibrations };
  }
  function assess(ids: string[], input: SolveInput, allergies: string[], pantry: OwnedPack[], bundle: ReturnType<typeof prepare>) {
    const proof = foodCheck(ids, input, allergies, pantry);
    const args: Parameters<typeof quoteBaskets> = [bundle.request, proof.checked.requirements, proof.checked.pantry, fixtureStores, facts, sources, model, bundle.calibrations];
    const evaluated = evaluatePricedWeek(ids, input, stage, pantry, allergies, args, STRATEGY);
    assert.deepEqual(evaluated, evaluatePricedWeek(ids, input, stage, pantry, allergies, args, STRATEGY));
    for (const q of [...evaluated.quotes.alternatives, ...(evaluated.quotes.split ? [evaluated.quotes.split] : [])]) {
      independentQuote(q, bundle.calibrations.find(c => scopeKey(c.scope) === scopeKey(q.scope)), bundle.request, facts, model);
      for (const line of q.lines) {
        const p = proof.checked.pantry.find(p => p.skuId === line.skuId), required = line.required.numerator / line.required.denominator;
        const amount = p ? p.quantity.numerator / p.quantity.denominator : 0;
        assert(Math.abs(line.ownedUsed.numerator / line.ownedUsed.denominator - Math.min(amount, required)) < 1e-8);
        assert(Math.abs(line.ownedCarryover.numerator / line.ownedCarryover.denominator - Math.max(0, amount - required)) < 1e-8);
      }
    }
    return { evaluated, independent: proof.independent, familyCounts: proof.originalFamilies, owned: pantry,
      requirements: proof.checked.requirements, pantry: proof.checked.pantry, deterministic: true };
  }
  // Exact replay of eighteen historical legacy bridge outputs against their original frozen inputs.
  const legacyRoot = resolve("data/pipeline/store-estimates/2026-10-05-cli-final");
  const load = (name: string) => { const file = resolve(legacyRoot, name), bytes = readFileSync(file, "utf8"); originalFiles.set(file, digest(bytes)); return JSON.parse(bytes); };
  const legacyModel = load("model.json"); let legacyCount = 0;
  for (const [name] of PROFILES) {
    const calibrations = load(`calibration-${name}.json`).map((r: { calibration: Calibration }) => r.calibration);
    for (const seed of [0, 7, 19]) {
      const row = load(`week-${name}-${seed}.json`), ids = row.out.days.flatMap((d: { items: { recipe_id: string }[] }) => d.items.map(i => i.recipe_id));
      const i = row.inputs;
      assert.deepEqual(evaluatePricedWeek(ids, row.input, stage, [], [], [i.request, i.requirements, i.pantry, fixtureStores, i.facts, i.sources, legacyModel, calibrations]), row.evaluated);
      legacyCount++;
    }
  }
  const profiles: { name: string; input: SolveInput; allergies: string[] }[] = PROFILES.map(([name, input]) => ({ name: name.replace(/[^a-z0-9]+/g, "-"), input, allergies: [] }));
  profiles.push({ name: "soy-typical", input: BASE, allergies: ["soy"] }, { name: "soy-household", input: { ...BASE, budget: 120, household: 2 }, allergies: ["soy"] });
  const bundles = new Map(profiles.map(p => [p.name, prepare(p.input, p.allergies, p.name)]));
  const singleBundle = prepare(BASE, ["soy"], "soy-single", [fixtureStores[0].id]);
  let candidateCount = 0, zeroSlots = 0, cappedSlots = 0, candidatePricePass = 0, candidateFoodPass = 0, heldOverruns = 0, maximumOverrunCents = 0;
  for (const p of profiles) for (const seed of [0, 7, 19]) {
    const input = { ...p.input, seed }, t = performance.now(), selected = solveReviewedRestricted(input, stage, p.allergies), out = selected.out;
    const solveMs = performance.now() - t, ids = idsOf(out); assert.equal(out.feasible, true);
    assert.deepEqual(out, solveReviewedRestricted(input, stage, p.allergies).out);
    const bundle = bundles.get(p.name)!, checks = [[], owned(.5), owned(10)].map(pantry => assess(ids, input, p.allergies, pantry, bundle));
    assert.deepEqual(checks[0].evaluated.days, checks[1].evaluated.days); assert.deepEqual(checks[0].evaluated.days, checks[2].evaluated.days);
    assert.notEqual(checks[0].evaluated.weekEvidenceDigest, checks[1].evaluated.weekEvidenceDigest);
    assert.notEqual(checks[0].evaluated.quotes.inputDigest, checks[1].evaluated.quotes.inputDigest);
    const held = [...checks[0].evaluated.quotes.alternatives, checks[0].evaluated.quotes.split!].map(q => {
      assert.notEqual(q.rawCents, null);
      const id = `held-binding-${p.name}-${seed}-${q.scopeDigest}`, calibration = bundle.calibrations.find(c => scopeKey(c.scope) === scopeKey(q.scope))!;
      const measurement = sealRecord({ id, evidence: evidence(id, "2026-10-03T12:00:00Z"), independentUnit: `${id}-fictional-unit`, scope: q.scope,
        rawPredictionCents: q.rawCents!, actualCents: q.rawCents! + Math.ceil(q.rawCents! * [3, 10, 12][[0, 7, 19].indexOf(seed)] / 100),
        basketDigest: digest([id, ids, checks[0].requirements]), priceBasis: "raw" as const });
      allHeld.push(measurement); verifyPhaseSeparation(model.samples, allCal, allHeld);
      const result = evaluateHeldOut(model, calibration, [measurement], sourceFor([measurement], facts.map(f => f.cell)), fixturePolicy);
      heldOverruns += result.overrunCount; maximumOverrunCents = Math.max(maximumOverrunCents, result.maximumOverrunCents);
      return { measurement, result };
    });
    const slots = p.allergies.length ? Array.from({ length: 15 }, (_, slot) => {
      const candidates = reviewedCandidates(out, slot, stage, p.allergies);
      if (!candidates.length) zeroSlots++; if (candidates.length === 6) cappedSlots++;
      return { slot, count: candidates.length, cappedAtSix: candidates.length === 6, candidates: candidates.map(candidate => {
        const next = [...ids]; next[slot] = candidate.recipe_id;
        const checked = assess(next, input, p.allergies, owned(.5), bundle);
        assert.equal(checked.evaluated.quotes.alternatives[0].foodViolations.length, 0);
        candidateCount++; candidateFoodPass++;
        if (checked.evaluated.quotes.split!.feasible) candidatePricePass++;
        return { candidate, recipeIds: next, ...checked, groceryChanges: { previous: checks[1].evaluated.quotes.split!.lines, next: checked.evaluated.quotes.split!.lines } };
      }) };
    }) : [];
    const quotes = checks.map(c => ({ foodViolations: c.evaluated.quotes.alternatives[0].foodViolations,
      alternatives: c.evaluated.quotes.alternatives.map(q => ({ storeId: q.scope.quotedStoreId, totalCents: q.totalCents, feasible: q.feasible })),
      split: { totalCents: c.evaluated.quotes.split!.totalCents, feasible: c.evaluated.quotes.split!.feasible } }));
    summaries.push({ name: p.name, seed, recipeIds: ids, solveMs, legacyReferenceCents: Math.round(out.est_total * 100), quotes, slots: slots.map(s => ({ slot: s.slot, count: s.count, cappedAtSix: s.cappedAtSix,
      foodPassed: s.candidates.length, syntheticPricePassed: s.candidates.filter(c => c.evaluated.quotes.split!.feasible).length })) });
    save(`week-${p.name}-${seed}.json`, { input, allergies: p.allergies, out, selectedProjectionDigest: selected.projectionDigest, provenance: selected.provenance, checks, held, slots });
    process.stdout.write(`${p.name}/${seed}: ${slots.reduce((n, s) => n + s.count, 0)} candidates; food ${quotes[0].foodViolations.length ? "miss" : "pass"}; split ${quotes[0].split.totalCents}c\n`);
  }
  const single = assess(failingIds, failingInput, ["soy"], [], singleBundle);
  assert.equal(single.evaluated.quotes.split, null); assert.equal(single.evaluated.quotes.alternatives.length, 1); save("single-chosen-store.json", single);
  const misses: object[] = [];
  for (const [name, input, allergies] of [
    ["soy-floor", PROFILES[1][1], ["soy"]], ["soy-180", PROFILES[5][1], ["soy"]], ["vegan-soy", PROFILES[3][1], ["soy"]],
    ["vegetarian-soy", PROFILES[4][1], ["soy"]], ["gluten-soy", { ...BASE, diet: "gluten-free" }, ["soy"]], ["egg-soy", BASE, ["eggs", "soy"]],
  ] as [string, SolveInput, string[]][]) {
    const projection = prepareReviewedSelection(stage, input.diet, allergies);
    const breakfast = projection.snapshot.recipes.filter(r => r.meal_type === "breakfast").length, mains = projection.snapshot.recipes.length - breakfast;
    if (!breakfast || !mains) { assert.throws(() => solveReviewedRestricted(input, stage, allergies)); misses.push({ name, breakfast, mains, status: "missing-slot" }); continue; }
    const out = solveReviewedRestricted({ ...input, seed: 0 }, stage, allergies).out;
    const check = foodCheck(idsOf(out), out.input, allergies, []);
    assert.equal(out.feasible, false); misses.push({ name, status: "bounded-reference-miss", out, independent: check.independent, pantryFoodViolations: check.checked.food.violations,
      note: "No global minimum or source-aware price search proof. A reference-budget miss is separate from raw fictional-price evaluation." });
  }
  for (const [file, hash] of originalFiles) assert.equal(digest(readFileSync(file, "utf8")), hash);
  assert.equal(digest(facts), frozenFacts); verifyPhaseSeparation(model.samples, allCal, allHeld);
  save("phase-evidence.json", { modelFit: model.samples, calibration: allCal, heldOut: allHeld, scopes: phases,
    limits: "Fictional declared independent physical units only; fit Sept30 frozen Oct1, calibration Oct2 frozen Oct2, held-out Oct3, fixture clock Oct5. No statistical independence or real-store accuracy claimed." });
  const acceptance = { fixtureOnly: true, strategy: STRATEGY, gate: "LOCAL trusted selection/physical pantry/fixture quote binding", counts: stage.counts,
    legacyExactReplays: legacyCount, frozenLegacyFiles: Object.fromEntries(originalFiles), fixedOffers: facts.length, fixedOffersDigest: frozenFacts,
    weeks: summaries, weekCount: summaries.length, pantryCases: summaries.length * 3, soySlots: 90, candidateCount, candidateFoodPass, candidatePricePass, zeroSlots, cappedSlots,
    fitUnitCount: model.samples.length, calibrationUnitCount: allCal.length, calibrationScopeCount: phases.length, heldOutUnitCount: allHeld.length, heldOverruns, maximumOverrunCents, misses,
    deterministic: true, elapsedMs: performance.now() - started, environment: { node: process.version, platform: platform(), totalMemoryMiB: totalmem() / 1048576, rssMiB: process.memoryUsage().rss / 1048576 },
    limits: "Private offline proof only. Original portions/families/caps and consumed-only nutrients unchanged. Bounded search retains reference-price selection, not global price-aware optimality. Offers/errors fictional; no kitchen/cross-contact/real-store/provider/hosted/native proof or reroll-shopping/price policy. Timings are warmed desktop process, not device measurements." };
  save("acceptance.json", acceptance); return acceptance;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = runReviewedQuoteAcceptance(process.argv[2]); process.stdout.write(JSON.stringify({ weeks: result.weekCount, candidates: result.candidateCount, legacyReplays: result.legacyExactReplays }) + "\n");
}
