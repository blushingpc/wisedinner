import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadGeneratedMealPlanner } from "./generated-meal-planner.ts";

test("generated catalog loader refuses changed bytes before catalog parsing", () => {
  const folder = mkdtempSync(join(tmpdir(), "wd-generated-loader-"));
  try {
    const file = join(folder, "catalog.json"); writeFileSync(file, "{}");
    assert.throws(() => loadGeneratedMealPlanner(file, "a".repeat(64)), /hash mismatch/);
    assert.throws(() => loadGeneratedMealPlanner(file, ""), /Exact catalog hash/);
  } finally { rmSync(folder, { recursive: true }); }
});
