import type { NewWeekRequestPolicy } from "./generated-source-clock.ts";

const dayMs = 86_400_000;
const dayStart = (day: string) => Date.parse(day + "T00:00:00.000Z");

function validDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const start = dayStart(value);
  return Number.isFinite(start) && new Date(start).toISOString().slice(0, 10) === value;
}

function ownValue(value: object, name: string): unknown {
  const field = Object.getOwnPropertyDescriptor(value, name);
  return field && "value" in field ? field.value : undefined;
}

export function createTwoWindowPolicy({ valuationFirst, valuationLast, serviceLast, now }: {
  valuationFirst: string;
  valuationLast: string;
  serviceLast: string;
  now: () => number;
}) {
  if (![valuationFirst, valuationLast, serviceLast].every(validDay) ||
      valuationFirst > valuationLast || valuationLast > serviceLast || typeof now !== "function") {
    throw Error("invalid_review_window");
  }

  const outside = { outcome: "error", code: "reference_week_outside_reviewed_window" } as const;
  const commitBefore = dayStart(valuationLast) + dayMs;
  const check: NewWeekRequestPolicy = request => {
    const time = now();
    if (!Number.isSafeInteger(time) || time < 0 || !Number.isFinite(new Date(time).getTime())) {
      return { outcome: "error", code: "reference_clock_unavailable" };
    }
    const today = new Date(time).toISOString().slice(0, 10);
    if (today < valuationFirst || today > valuationLast) {
      return { outcome: "error", code: "reference_snapshot_expired" };
    }
    if (!request || typeof request !== "object" || Array.isArray(request) || ownValue(request, "asOfDate") !== today) {
      return { outcome: "error", code: "reference_clock_mismatch" };
    }
    const days = ownValue(request, "selectedDays");
    if (!Array.isArray(days) || days.length !== 7) return outside;
    const first = ownValue(days, "0");
    if (!validDay(first) || first < today) return outside;
    const start = dayStart(first);
    for (let i = 0; i < days.length; i++) {
      const day = ownValue(days, String(i));
      if (!validDay(day) || day > serviceLast || dayStart(day) !== start + i * dayMs) return outside;
    }
    return null;
  };

  return Object.freeze({ valuationFirst, valuationLast, serviceLast, commitBefore, check });
}
