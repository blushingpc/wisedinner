// SHOWCASE NUMBERS (founder rule, 2026-09-12). Marketing and showcase surfaces (the pre-order band, share-page
// titles and headlines, the share OG, the drop page sub, the hero callout) print whole dollars, rounded UP, so a
// claim is never under the real solve. Itemized rows, list totals and the app-screen mocks keep exact cents
// (data/fixtures.ts `usd`), because the app does. Every value here is read from the week it is given, never typed,
// so the Sunday fixture regeneration cannot make the copy wrong.

// $56.97 -> "$57", $57.00 -> "$57" (rounded to cents first so float noise never adds a dollar)
export const wholeUsd = (n: number) => `$${Math.ceil(Math.round(n * 100) / 100)}`;

// a budget is an input typed in whole dollars, so it prints exactly: 57 -> "$57"
export const budgetUsd = (n: number) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);

// "under a $57 budget" when the week lands under its budget, "on a $57 budget" when it lands exactly on it, "" when
// the week carries no budget (a shared week from the API may not). The under-budget amount itself is never printed
// on a showcase surface: at a $57 budget it is cents, and rounding it up would overstate it.
export function budgetPhrase(w: { budget_usd?: number; totals: { under_budget_by_usd: number } }) {
  if (typeof w.budget_usd !== "number" || !(w.budget_usd > 0)) return "";
  return `${w.totals.under_budget_by_usd > 0 ? "under" : "on"} a ${budgetUsd(w.budget_usd)} budget`;
}
