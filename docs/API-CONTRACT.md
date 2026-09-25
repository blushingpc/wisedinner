# API contract for the app (backend v1)

Everything the app needs from the website backend: the data snapshot, the three routes, the store picker, which
solver function each tier calls, and the caching rules. No user-facing shape carries a `source` or `confidence`
field; the solver and the app never see where a price came from beyond "this store has observed prices" (`live`).

## 1. The snapshot

One JSON bundle per version, published by the pipeline (`scripts/data/run.ts`) to Supabase Storage
(`data/snapshots/v<N>.json`, public) and recorded in `data_snapshots`. The same bundle is committed to the website
repo as `data/snapshot.json`; the app copies it into its bundle at build time (`src/data/snapshot.json`).

### Schema (`packages/solver/src/types.ts` is the source of truth)

```ts
type Snapshot = {
  version: number;             // 1, 2, 3 …
  generated_at: string;        // YYYY-MM-DD
  stores: Store[];
  skus: Sku[];
  store_prices: StorePrice[];  // observed shelf prices only (Kroger API today; Walmart, Instacart, receipts later)
  nutrition: Nutrition[];      // per 100 g from USDA FoodData Central
  recipes: Recipe[];           // 27 bases + their variants (81 today)
  recipe_ingredients: RecipeIngredient[];
  recipe_variants: RecipeVariant[];
};
type Store = { id: string; chain: string; banner: string; region_scope: string; price_index: number; live: boolean };
type Sku = { id: string; name: string; aisle: "produce"|"meat"|"dairy"|"bakery"|"frozen"|"pantry"; perishable: boolean;
  pack_qty: number; pack_unit: Unit; pack_label: string; canonical_unit: "g"|"ml"|"each"; grams_per_unit: number;
  diet_flags: ("vegetarian"|"vegan"|"gluten-free"|"dairy-free")[]; baseline_usd: number };
type StorePrice = { sku_id: string; store_id: string; region: string; shelf_price: number; unit_price: number; as_of: string };
type Nutrition = { sku_id: string; protein_g: number; kcal: number; fat_g: number; carbs_g: number; per: "100g" };
type Recipe = { id: string; name: string; meal_type: "breakfast"|"lunch"|"dinner"; tags: string[]; servings: number; minutes: number; steps: string[] };
type RecipeIngredient = { recipe_id: string; sku_id: string; qty: number; unit: Unit };
type RecipeVariant = { recipe_id: string; variant_recipe_id: string; kind: "protein_swap"|"carb_swap"|"veg_swap" };
type Unit = "g"|"kg"|"oz"|"lb"|"ml"|"l"|"fl_oz"|"cup"|"tbsp"|"tsp"|"each";
```

Rules the app can rely on:

- `store_prices` holds only observed prices. A store with at least one row is `live: true`. For any (sku, store)
  without a row the solver prices `baseline_usd × price_index` itself (an estimate); the app never computes prices.
- Prices are raw shelf prices. The +10% buffer is applied inside the solver (`PRICE_BUFFER` in
  `packages/solver/src/pricing.ts`), once. Do not buffer again.
- `recipes[].id` for the 27 bases equals the menu photo slug (`/img/menu/<id>.jpg`); a variant's photo is its base's
  (`recipe_variants` maps variant → base).
- `recipes[].tags` carry `healthy`, `would_order`, `protein:<source>` and, on variants, `variant:<kind>`.
- Diet eligibility of a recipe is the intersection of its ingredients' `diet_flags` (`templatesOf` in the solver).
- `validateSnapshot(raw)` throws with every violation listed; call it once at load.

### Sample (trimmed)

```json
{
  "version": 1,
  "generated_at": "2026-09-09",
  "stores": [
    { "id": "kroger", "chain": "Kroger", "banner": "Kroger", "region_scope": "midwest-south", "price_index": 1, "live": true },
    { "id": "aldi", "chain": "Aldi", "banner": "Aldi", "region_scope": "national", "price_index": 0.85, "live": false }
  ],
  "skus": [
    { "id": "chicken-breast", "name": "chicken breast, boneless skinless", "aisle": "meat", "perishable": true,
      "pack_qty": 3, "pack_unit": "lb", "pack_label": "3 lb family pack", "canonical_unit": "g", "grams_per_unit": 1,
      "diet_flags": ["gluten-free", "dairy-free"], "baseline_usd": 8.37 }
  ],
  "store_prices": [
    { "sku_id": "chicken-breast", "store_id": "kroger", "region": "43215", "shelf_price": 7.77, "unit_price": 0.00571, "as_of": "2026-09-09" }
  ],
  "nutrition": [{ "sku_id": "chicken-breast", "protein_g": 22.5, "kcal": 106, "fat_g": 1.9, "carbs_g": 0, "per": "100g" }],
  "recipes": [
    { "id": "chicken-caesar-wrap", "name": "Chicken caesar wrap", "meal_type": "lunch",
      "tags": ["healthy", "would_order", "protein:chicken breast"], "servings": 1, "minutes": 15,
      "steps": ["Cook the chicken and slice it.", "Toss with romaine and dressing.", "Roll in the tortilla."] }
  ],
  "recipe_ingredients": [
    { "recipe_id": "chicken-caesar-wrap", "sku_id": "chicken-breast", "qty": 6, "unit": "oz" },
    { "recipe_id": "chicken-caesar-wrap", "sku_id": "flour-tortillas", "qty": 1, "unit": "each" }
  ],
  "recipe_variants": [{ "recipe_id": "chicken-caesar-wrap", "variant_recipe_id": "chicken-caesar-wrap-turkey", "kind": "protein_swap" }]
}
```

## 2. Routes (https://www.wisedinner.com)

All JSON. Server-side keys only; in-memory rate limits per IP (60/min for data, 20/min weeks, 10/min receipts).
Errors are `{ error: string }` with 400 / 404 / 413 / 429 / 502 / 503.

| Route | Purpose | Request | Response |
|---|---|---|---|
| `GET /api/data/latest` | newest snapshot pointer | none | `{ version, url, sha256, created_at }` (cache 5 min) |
| `GET /api/data/<version>` | a specific version | none | same shape (cache 1 day) |
| `POST /api/weeks` | share a week | `{ budget, protein_target, diet, household, stores: string[], week: DisplayWeek }` ≤ 32 KB | `{ id, url }` → `https://www.wisedinner.com/w/<id>` |
| `POST /api/receipts` | receipt calibration lines | `{ user_hash: hex64, store: storeId, region: zip5, observed_at?: iso, items: [{ sku: skuId, price: number }] }` ≤ 100 lines | `{ status: "ok", accepted: n }` |
| `POST /api/support` | the site's support form (not for the app) | `{ name?, email, message }` | `{ status: "ok" }` |
| `GET /api/status` | heartbeat | none | includes `snapshot: { version, created_at }` and `support: { open, escalated }` |
| `GET /api/delivery?store=<storeId>&zip=<zip5>[&list_hash=<32hex>]` | the Delivery Gap for the list screen (Courier; gate in the app) | query only | `{ store, zip, list_hash, subtotal_usd, fees_usd, total_usd, quoted_at, estimate: true, label, exact_list }` (cache 1 h); 404 `{ error: "no quote yet" }` when no quote exists |

`/api/delivery` reads `delivery_quotes`, the table `scripts/data/instacart.ts` fills from a priced Instacart cart
(the only Delivery Gap source; there is no modeled markup). Without `list_hash` it returns the store's newest quote
at that ZIP (`exact_list: false`); with it, the quote for that exact list. `list_hash` is the first 32 hex of
sha256 over the sorted `[name.toLowerCase(), qty, unit]` triples of the list lines, as `listHash()` in
`scripts/data/instacart.ts` computes it. Every figure is an estimate and the app labels it so. While no Instacart
key exists the table is empty and the route answers 404; the list screen hides the line on 404.

`DisplayWeek` for `/api/weeks` is the website's `FixtureWeek` shape (`data/fixtures.ts`): `days[5].meals[3]`
with `{ slot, menu, name, protein_g, cost_usd, img }`, `totals`, `list.items[]`, `receipt`. The share page rejects
a body that carries `source` or `confidence` keys. `user_hash` for receipts is a 64-hex hash the app derives on
device (never an email, never a device id); receipt lines are stored unverified and only verified rows feed prices.

## 3. The store picker

- The list is `snapshot.stores`, shown by `banner`, grouped by `chain` where useful (the Kroger family is one
  chain with many banners; pick the banner the user shops at).
- The user picks one to three stores and enters a ZIP. Both go into `SolveInput.stores` and `SolveInput.zip`.
- Multi-store optimisation exists only when at least two chosen stores are `live`. The solver reports what it
  could do: `modes_available` (`[]`, `["singleStore"]`, or both) and `store_mode` (`estimate` | `singleStore` |
  `bestPerItem`). Show a store's prices as estimates when the store is not `live`.
- Region: the solver picks the observed region closest to the ZIP (exact match, else longest shared prefix, else any).

## 4. Tiers and solver functions

| Tier | Calls | Notes |
|---|---|---|
| Free (pre-order build) | `solve(input, snapshot)`; whole-week regenerate = `solve({ ...input, seed: newSeed }, snapshot)` | `mode` may be omitted; the solver downgrades to what the data supports |
| Protein Plan | + `regenerateSlot(week, slotIndex, seed, snapshot)` | the random single-meal reroll. `slotIndex = day * 3 + slot` (0..14). Candidates are the dishes **makeable from the week's existing list** (every ingredient already on the list or in the pantry; a pack count may bump on re-consolidation, a new sku never appears); the seed picks inside the 3% cost band. Returns `changed: false` with `why` "no other dinner can be made from this week's list" when nothing fits. Slot 0 takes breakfasts; slots 1 and 2 share the lunch + dinner pool |
| Courier (was Autopilot; renamed 2026-09-24) | + `swapCandidates(week, slotIndex, snapshot, n = 6, tolerance?)` and `GET /api/delivery` | the menu of substitutes for one slot. Candidates are (1) makeable from the week's list as above, (2) **protein-matched**: the candidate's `protein_g` (per person, as displayed) is within the tolerance below of the replaced meal's `protein_g`, (3) keep the week feasible. Ranked by fewest `extraPacks`, then `deltaCost`, then closest protein, then more protein. Apply one with `evaluateWeek(ids, week.input, snapshot)`. `usesExisting` is always `true` and `newItems` always `[]` now; both stay on the shape |

**Protein-match tolerance** (`packages/solver/src/makeable.ts`): `tolerance(g) = max(5, round(0.15 × g))`, applied to
the replaced meal's displayed `protein_g`. A 20 g breakfast accepts 15 to 25 g, a 40 g lunch 34 to 46 g, a 60 g
dinner 51 to 69 g. Fixed percentages alone let a 20 g breakfast swing by 3 g, which reads as "the same" but blocks
almost every option; 5 g is the floor a user notices on the day figure. The fifth argument overrides it:
`tolerance?: number | ((currentG: number) => number)`, a number is a fixed gram window, a function computes the
window from the replaced meal's displayed `protein_g`, `undefined` is the default above.

**Who recomputes what.** `regenerateSlot` returns the whole recomputed `SolveOutput` (new `days`, `list`,
`est_total`, everything). `swapCandidates` returns candidates only; the app applies one by recomputing with
`evaluateWeek`, which takes the recipe ids either as days × slots (`string[5][3]`) or flat by `slotIndex`
(`string[15]`):

```ts
const ids = week.days.flatMap((d) => d.items.map((i) => i.recipe_id)); // 15 ids, index = day * 3 + slot
ids[slotIndex] = candidate.recipe_id;
const next = evaluateWeek(ids, week.input, snapshot); // full SolveOutput: new list, new est_total, new days
```

`evaluateWeek` does not apply the $45 floor and does not search; it prices the given week as-is.

Gating lives in the app. The solver has no notion of tiers. `pantry` on the input is a list of sku ids the user
owns; those packs stay on the list at $0 with `pantry: true`.

### Request and response shapes for the app (Courier work, 2026-09-24)

On device, both functions take the `SolveOutput` the app already holds; nothing is sent to the server.

```ts
// Protein Plan: reroll one meal
regenerateSlot(week: SolveOutput, slotIndex: number /* 0..14 */, seed: number, snapshot: Snapshot)
  → SolveOutput & { changed: boolean }   // changed:false → same week, why[] gains one plain-words line

// Courier: substitutes for one meal (candidates only; apply with evaluateWeek below)
swapCandidates(week: SolveOutput, slotIndex: number /* 0..14 */, snapshot: Snapshot, n = 6,
               tolerance?: number | ((currentG: number) => number))   // default: max(5 g, round(15% × replaced meal's protein_g))
  → SwapCandidate[]                        // [] when nothing on the list makes a protein-matched dish

// apply one candidate: the app recomputes the week
const ids = week.days.flatMap((d) => d.items.map((i) => i.recipe_id));  // string[15], index = day * 3 + slot
ids[slotIndex] = candidate.recipe_id;
evaluateWeek(ids, week.input, snapshot)  → SolveOutput   // full week: new list, new est_total, new days (string[5][3] also accepted)
SwapCandidate = {
  recipe_id: string; name: string;
  protein_g: number;        // the candidate meal, per person, as displayed
  deltaCost: number;        // whole-list total after minus before (household)
  deltaProtein: number;     // that day's protein after minus before
  extraPacks: number;       // packs the list grows by (0 = same packs)
  usesExisting: true; newItems: [];   // kept for shape stability
  variantOf?: { recipe_id: string; kind: VariantKind };
}

// Courier: the Delivery Gap line on the list screen
GET https://www.wisedinner.com/api/delivery?store=kroger&zip=43215            // newest quote for the store at the ZIP
GET https://www.wisedinner.com/api/delivery?store=kroger&zip=43215&list_hash=<32hex>   // this exact list
200 { store: "kroger", zip: "43215", list_hash: "…", subtotal_usd: 68.90, fees_usd: 0, total_usd: 68.90,
      quoted_at: "2026-09-28T10:04:11Z", estimate: true, label: "Delivered, estimated", exact_list: false }
404 { error: "no quote yet" }        // hide the line
400 { error: "store and a 5-digit zip are required" } | { error: "list_hash must be 32 hex characters" }
429 { error: "too many requests" }   // 60 per minute per IP
```

Output fields the app may show: everything on `SolveOutput` except `input` (echo) and `seed`. `store_mode`,
`modes_available`, `stores[]` (subtotal per store) and `alt_total` are display-ready.

### Budget minimum

The minimum weekly budget is **$45** (`MIN_BUDGET` in `packages/solver/src/engine.ts`, exported from the package
index). The app enforces the same floor in its on-device copy of the solver (the budget control never offers a value
under 45), and the solver enforces it again: for `budget < 45`, `solve()` does not search. It returns the ordinary
`SolveOutput`. Verbatim output for `budget: 40`, 150 g, Kroger 43215 on snapshot v4:

```json
{
  "feasible": false,
  "days": [
    { "day": "mon", "items": [], "protein_g": 0, "kcal": 0 },
    { "day": "tue", "items": [], "protein_g": 0, "kcal": 0 },
    { "day": "wed", "items": [], "protein_g": 0, "kcal": 0 },
    { "day": "thu", "items": [], "protein_g": 0, "kcal": 0 },
    { "day": "fri", "items": [], "protein_g": 0, "kcal": 0 }
  ],
  "list": [],
  "est_total": 0,
  "protein_per_day": 0,
  "kcal_per_day": 0,
  "protein_shortfall_g": 750,
  "price_as_of": "2026-09-12",
  "distinct_skus": 0,
  "protein_sources": 0,
  "seed": 0,
  "why": ["budget below the $45 minimum"],
  "input": { "budget": 40, "protein_per_day": 150, "kcal_min": 1800, "kcal_max": 2800, "diet": "none", "household": 1, "stores": ["kroger"], "zip": "43215" },
  "store_mode": "singleStore",
  "modes_available": ["singleStore"],
  "stores": []
}
```

`protein_shortfall_g` is `protein_per_day × 5` (the whole week's target is missing) and `price_as_of` is the
snapshot's `generated_at`. `why` is the same plain-words field every infeasible week carries; there is no separate
error shape and no exception. `regenerateSlot` on a week whose `input.budget` is under 45 returns it unchanged
(`changed: false`, with the same `why` line); `swapCandidates` returns `[]`. `evaluateWeek(ids, input, snapshot)`
prices a given list of recipe ids as-is (fixtures, tests) and does not apply the floor. At or above $45 a week can
still come back `feasible: false` for the ordinary reasons (protein target, calorie band, variety floors), with those
reasons in `why`.

## 5. Caching and refresh

- Bundle `data/snapshot.json` at build. Offline always works on the bundled copy.
- On launch (at most once per 24 h, and never in Build 1 where no network is allowed), `GET /api/data/latest`. If
  `version` is higher than the bundled or cached one, download `url`, verify `sha256`, run `validateSnapshot`, then
  swap atomically. Keep the last good snapshot if any step fails.
- A week solved on version N stays valid on version N+1; re-solve only when the user asks.
- Photos are `/img/menu/<base id>.jpg` on the website; the app ships them in its bundle (Metro needs static requires).

## 6. Porting the solver

Copy `packages/solver/src` into `src/solver/core` (relative `.ts` imports only, no dependencies) and delete the
app's `pricing.ts` (the buffer now lives in the package), `meal-display.json` (`recipe.name` is the display name,
`recipe.id` the photo slug) and `aisles.json.byStaple` (`sku.aisle`). Templates are no longer a static import:
`templatesOf(snapshot)` builds them from the snapshot.
