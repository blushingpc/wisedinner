// Trusted server clock policy. It does not renew any source observation or
// change the user's planning date, budget, equipment or nutrition goals.
export type NewWeekRequestPolicy = (request: unknown) => { readonly outcome: "error"; readonly code: string } | null;
export function createReferenceSnapshotClockPolicy(firstDay: string, lastDay: string, now: () => number = Date.now) {
  const date = /^\d{4}-\d{2}-\d{2}$/;
  const end = Date.parse(lastDay + "T00:00:00.000Z") + 86400000;
  const start = Date.parse(firstDay + "T00:00:00.000Z");
  if (!date.test(firstDay) || !date.test(lastDay) || firstDay > lastDay || !Number.isSafeInteger(end)
    || !Number.isSafeInteger(start) || new Date(start).toISOString().slice(0, 10) !== firstDay
    || new Date(end - 86400000).toISOString().slice(0, 10) !== lastDay) throw Error("Invalid source clock window");
  const check: NewWeekRequestPolicy = request => {
    const timestamp = now();
    if (!Number.isSafeInteger(timestamp) || timestamp < 0) return { outcome: "error", code: "reference_clock_unavailable" };
    let today: string;
    try { today = new Date(timestamp).toISOString().slice(0, 10); } catch { return { outcome: "error", code: "reference_clock_unavailable" }; }
    if (today < firstDay || today > lastDay) return { outcome: "error", code: "reference_snapshot_expired" };
    if (!request || typeof request !== "object" || Array.isArray(request)
      || (request as Record<string, unknown>).asOfDate !== today) return { outcome: "error", code: "reference_clock_mismatch" };
    return null;
  };
  return Object.freeze({ check, commitBefore: end, firstDay, lastDay });
}

// Opt-in current-source policy: a documentary valuation date cannot admit
// planning days outside the independently reviewed source window. Legacy
// archive policies retain their original valuation-date-only behavior.
export function createReviewedWeekClockPolicy(firstDay: string, lastDay: string, now: () => number = Date.now) {
  const clock = createReferenceSnapshotClockPolicy(firstDay, lastDay, now);
  const check: NewWeekRequestPolicy = request => {
    const current = clock.check(request);
    if (current) return current;
    const descriptor = Object.getOwnPropertyDescriptor(request, "selectedDays");
    const days: unknown = descriptor && "value" in descriptor ? descriptor.value : undefined;
    if (!Array.isArray(days) || days.length === 0 || days.length > 7)
      return { outcome: "error", code: "reference_week_outside_reviewed_window" };
    for (let index = 0; index < days.length; index++) {
      const item = Object.getOwnPropertyDescriptor(days, String(index));
      const day: unknown = item && "value" in item ? item.value : undefined;
      if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day < firstDay || day > lastDay
        || !Number.isFinite(Date.parse(day + "T00:00:00Z"))
        || new Date(day + "T00:00:00Z").toISOString().slice(0, 10) !== day)
        return { outcome: "error", code: "reference_week_outside_reviewed_window" };
    }
    return null;
  };
  return Object.freeze({ ...clock, check });
}
