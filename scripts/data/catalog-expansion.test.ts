import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { generateCandidates, assessCandidates, candidateDigest, candidateIdentity, compileCandidate, compileApproved } from "./catalog-expansion.ts";
import { reviewNutrition } from "./catalog-review.ts";
import { loadUsdaMap } from "./usda.ts";
import { SAFETY } from "./ingredient-safety.ts";
import type { SourceFood } from "./catalog-evidence.ts";

const map = loadUsdaMap();
const foods: SourceFood[] = JSON.parse(readFileSync("docs/ingredient-catalog/usda-evidence.json", "utf8")).foods;
const reviews = reviewNutrition(map, foods);
const candidates = generateCandidates();

test("offline generator has thousands of distinct preparations but drafts cannot approve themselves", () => {
  const assessed = assessCandidates(candidates, map, reviews);
  assert.ok(assessed.counts.generated > 3000);
  assert.equal(assessed.counts.generated, assessed.counts.unique);
  assert.equal(assessed.counts.validated, assessed.counts.unique);
  assert.equal(assessed.counts.eligible, 0);
  assert.equal(assessed.counts.quarantined, candidates.length);
  assert.equal(candidateDigest(candidates), candidateDigest(generateCandidates()));
});
test("cosmetic titles, new IDs, meal slots and portion tweaks are not new preparations", () => {
  const copy = structuredClone(candidates[0]);
  copy.recipe.name = "Another name"; copy.recipe.id = "another-id"; copy.recipe.meal_type = "breakfast";
  copy.recipe.ingredients[0][1] += 1;
  assert.equal(candidateIdentity(copy), candidateIdentity(candidates[0]));
  const assessed = assessCandidates([candidates[0], copy], map, reviews);
  assert.equal(assessed.counts.unique, 1); assert.match(assessed.quarantine[1].reasons.join(" "), /Duplicate/);
});
test("compiler rejects missing, contradictory and duplicate ingredient instructions", () => {
  for (const alter of [
    (c: typeof candidates[number]) => { c.recipe.steps = []; },
    (c: typeof candidates[number]) => { c.recipe.steps[1] = "Serve the raw chicken with soy sauce."; },
    (c: typeof candidates[number]) => { c.recipe.ingredients.push(c.recipe.ingredients[0]); },
    (c: typeof candidates[number]) => { c.recipe.ingredients[0][1] = 999; },
    (c: typeof candidates[number]) => { c.parts[0].role = "grain"; },
    (c: typeof candidates[number]) => { c.recipe.minutes = 5; },
  ]) { const copy = structuredClone(candidates[0]); alter(copy); assert.throws(() => compileCandidate(copy)); }
});
test("explicit approval still cannot bypass nutrition, safety or stale evidence gates", () => {
  const selected = [candidates[0]];
  const approval = { candidate_digest: candidateDigest(selected), recipe_ids: selected.map(c => c.recipe.id), reviewed_at: "2026-10-04" };
  assert.equal(assessCandidates(selected, map, reviews, approval).counts.eligible, 1);
  const stale = structuredClone(map); stale["chicken-breast"].protein_g += 5;
  assert.equal(assessCandidates(selected, stale, reviews, approval).counts.eligible, 0);
  const unknown = { ...SAFETY, "frozen-broccoli": { ...SAFETY["frozen-broccoli"], status: "unreviewed" as const, allergens: null } };
  assert.equal(assessCandidates(selected, map, reviews, approval, unknown).counts.eligible, 0);
  const wrong = { ...approval, candidate_digest: "wrong" };
  assert.throws(() => assessCandidates(selected, map, reviews, wrong), /stale/);
});
test("approved variants reuse the authored compiler with their own quantities and directions", () => {
  const subset = candidates.filter(c => c.method === "bowl" && c.recipe.meal_type === "dinner" && c.parts.some(p => p.row[0] === "white-rice") && c.parts.filter(p => p.role === "vegetable").length === 1 && c.parts.some(p => p.row[0] === "frozen-broccoli"));
  const compiled = compileApproved(subset);
  assert.equal(compiled.authored.length, 1);
  assert.equal(compiled.variants.length, subset.length - 1);
  for (const c of subset) {
    const single = compileCandidate(c);
    assert.deepEqual(compiled.recipes.find(r => r.id === c.recipe.id), single.recipes[0].id === compiled.authored[0].id ? single.recipes[0] : { ...single.recipes[0], tags: [...single.recipes[0].tags, "variant:protein_swap"] });
    assert.deepEqual(compiled.ingredients.filter(i => i.recipe_id === c.recipe.id).sort((a,b) => a.sku_id.localeCompare(b.sku_id)), single.ingredients.sort((a,b) => a.sku_id.localeCompare(b.sku_id)));
  }
});

test("saved initial approval is exactly 66 eligible preparations and 4638 quarantined drafts", () => {
  const approval = JSON.parse(readFileSync("docs/ingredient-catalog/approval.json", "utf8"));
  const assessed = assessCandidates(candidates, map, reviews, approval);
  assert.deepEqual(assessed.counts, { generated: 4704, unique: 4704, validated: 4704, reviewReady: 66, eligible: 66, quarantined: 4638 });
  const compiled = compileApproved(assessed.eligible);
  assert.equal(compiled.authored.length, 9); assert.equal(compiled.variants.length, 57);
  for (const c of assessed.eligible) assert.equal(c.photo, null);
});
