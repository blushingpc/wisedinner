import { staples } from "@/data/staples";
import { rateLimited } from "../db";
import { DIETS, solve, type Diet, type SolveInput, type SolveOutput } from "./solver";

export type SolveResponse = SolveOutput & { closest?: { protein_per_day: number; week: SolveOutput } };

export function GET() {
  return new Response(null, { status: 405, headers: { allow: "POST" } });
}

export async function POST(req: Request) {
  if (rateLimited(req)) return Response.json({ error: "too many requests — try again in a minute" }, { status: 429 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) ?? {};
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }

  const num = (k: string, min: number, max: number) => {
    const v = body[k];
    return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null;
  };
  const budget = num("budget", 20, 200);
  const protein_per_day = num("protein_per_day", 60, 250);
  const kcal_min = num("kcal_min", 500, 6000);
  const kcal_max = num("kcal_max", 500, 6000);
  const household = num("household", 1, 4);
  const diet = DIETS.includes(body.diet as Diet) ? (body.diet as Diet) : null;
  const known = new Set(staples.map((s) => s.name));
  const pantry = Array.isArray(body.pantry) ? body.pantry.filter((n): n is string => typeof n === "string" && known.has(n)).slice(0, 40) : [];

  if (budget === null || protein_per_day === null || kcal_min === null || kcal_max === null || household === null || !Number.isInteger(household) || diet === null || kcal_min > kcal_max) {
    return Response.json(
      { error: "expected numbers: budget 20-200, protein_per_day 60-250, kcal_min <= kcal_max in 500-6000, household integer 1-4; diet one of " + DIETS.join("|") },
      { status: 400 },
    );
  }

  const input: SolveInput = { budget, protein_per_day, kcal_min, kcal_max, diet, household, pantry };
  const week: SolveResponse = solve(input, staples);

  // infeasible → also return the closest solvable target (protein relaxed in 10 g steps) so /plan can offer "use closest"
  if (!week.feasible) {
    for (let p = protein_per_day - 10; p >= 60; p -= 10) {
      const relaxed = solve({ ...input, protein_per_day: p }, staples);
      if (relaxed.feasible) {
        week.closest = { protein_per_day: p, week: relaxed };
        break;
      }
    }
  }
  return Response.json(week);
}
