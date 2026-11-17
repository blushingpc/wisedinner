const recipeId = "wd-curated-plant-v1-overnight-oats";
const recipeSha256 = "93e5d8e08d942abc399563cc8eb70b08a2f8fa7d2efdfd36bc65d5d398bf0b23";
const dayMs = 86_400_000;

export function requiresPriorEvening(id: string, sha: string): boolean {
  return id === recipeId && sha === recipeSha256;
}

export function priorEveningDate(mealDate: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(mealDate)) return null;
  const time = Date.parse(mealDate + "T00:00:00Z");
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== mealDate) return null;
  return new Date(time - dayMs).toISOString().slice(0, 10);
}

export function reviewedPreparationFits(id: string, sha: string, mealDate: string, asOfDate: string): boolean {
  if (!requiresPriorEvening(id, sha)) return true;
  const prepDate = priorEveningDate(mealDate);
  // The normalized request has a civil date but no local time. Only use a
  // prep date strictly after that date so there is a full evening available.
  return prepDate !== null && asOfDate < prepDate;
}
