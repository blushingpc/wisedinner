import { fixtures, type FixtureWeek } from "@/data/fixtures";
import { configured, select } from "@/app/api/db";

// a shared week: the two committed fixtures first, then shared_weeks by id (POST /api/weeks). the stored `week`
// must already be the display shape (FixtureWeek); anything else is treated as missing.
const ID = /^[a-z0-9]{8}$/;

function isFixtureWeek(w: unknown): w is FixtureWeek {
  if (!w || typeof w !== "object") return false;
  const o = w as Record<string, unknown>;
  const totals = o.totals as Record<string, unknown> | undefined;
  const list = o.list as Record<string, unknown> | undefined;
  return (
    Array.isArray(o.days) &&
    o.days.length === 5 &&
    o.days.every((d) => d && typeof d === "object" && Array.isArray((d as { meals?: unknown }).meals)) &&
    !!totals &&
    typeof totals.est_total_usd === "number" &&
    typeof totals.protein_per_day_g === "number" &&
    !!list &&
    Array.isArray(list.items) &&
    typeof list.est_total_usd === "number"
  );
}

export async function loadWeek(id: string): Promise<FixtureWeek | null> {
  if (fixtures[id]) return fixtures[id];
  if (!ID.test(id) || !configured()) return null;
  try {
    const rows = await select<{ id: string; week: unknown }>("shared_weeks", `select=id,week&id=eq.${id}&limit=1`);
    const w = rows[0]?.week;
    if (!isFixtureWeek(w)) return null;
    return { ...w, id, list: { ...w.list, delivery_label: w.list.delivery_label ?? "", delivery_est_usd: w.list.delivery_est_usd ?? 0, delivery_saves_usd: w.list.delivery_saves_usd ?? 0 } };
  } catch {
    return null;
  }
}
