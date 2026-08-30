import { staples } from "@/data/staples";
import { DIETS, solve, type Diet, type SolveInput } from "./solver";

export async function POST(req: Request) {
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
  const budget = num("budget", 1, 1000);
  const protein_per_day = num("protein_per_day", 1, 400);
  const kcal_min = num("kcal_min", 500, 6000);
  const kcal_max = num("kcal_max", 500, 6000);
  const household = num("household", 1, 8);
  const diet = DIETS.includes(body.diet as Diet) ? (body.diet as Diet) : null;
  const known = new Set(staples.map((s) => s.name));
  const pantry = Array.isArray(body.pantry) ? body.pantry.filter((n): n is string => typeof n === "string" && known.has(n)) : [];

  if (
    budget === null ||
    protein_per_day === null ||
    kcal_min === null ||
    kcal_max === null ||
    household === null ||
    !Number.isInteger(household) ||
    diet === null ||
    kcal_min > kcal_max
  ) {
    return Response.json(
      {
        error:
          "expected numbers: budget 1-1000, protein_per_day 1-400, kcal_min <= kcal_max in 500-6000, household integer 1-8; diet one of " +
          DIETS.join("|"),
      },
      { status: 400 },
    );
  }

  const input: SolveInput = { budget, protein_per_day, kcal_min, kcal_max, diet, household, pantry };
  return Response.json(solve(input, staples));
}
