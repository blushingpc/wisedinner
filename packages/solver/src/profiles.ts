import type { SolveInput } from "./types.ts";

// the six solver profiles: variety floors, protein-source floors, repeat caps and budget must hold on every one.
// shared by the tests and the snapshot guard (an infeasible profile blocks publishing).
export const BASE: SolveInput = { budget: 60, protein_per_day: 150, kcal_min: 1800, kcal_max: 2800, diet: "none", household: 1, stores: ["kroger"], zip: "43215" };

export const PROFILES: [string, SolveInput][] = [
  ["typical", BASE],
  ["floor budget", { ...BASE, budget: 30, protein_per_day: 100, kcal_min: 1600, kcal_max: 2600 }],
  ["household of two", { ...BASE, budget: 120, household: 2 }],
  ["vegan", { ...BASE, budget: 50, protein_per_day: 100, diet: "vegan" }],
  ["vegetarian", { ...BASE, budget: 55, protein_per_day: 130, diet: "vegetarian" }],
  ["dairy-free, high protein", { ...BASE, budget: 90, protein_per_day: 180, kcal_min: 2200, kcal_max: 3200, diet: "dairy-free" }],
];
