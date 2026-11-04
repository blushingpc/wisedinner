// Explicit server-only local catalog binding. No live route, environment flag or database write.
import { createHash } from "node:crypto";
import { readFileSync, lstatSync } from "node:fs";
import { createGeneratedMealPlanner } from "../packages/solver/src/generated-meals.ts";

export function loadGeneratedMealPlanner(path: string, expectedSha256: string) {
  if (!/^[a-f0-9]{64}$/.test(expectedSha256)) throw new Error("Exact catalog hash required");
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 60 * 1024 * 1024) throw new Error("Bounded regular catalog file required");
  const raw = readFileSync(path);
  if (createHash("sha256").update(raw).digest("hex") !== expectedSha256) throw new Error("Generated catalog hash mismatch");
  return createGeneratedMealPlanner(JSON.parse(raw.toString("utf8")));
}
