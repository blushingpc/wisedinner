// the site's solver entry: packages/solver is the implementation (BACKEND-V1 §3); the app copies that folder.
// this shim keeps the `@/lib/solver` import path for app/ui/receipt-card.tsx and data/drop.ts.
export * from "../packages/solver/src/index.ts";
export { snapshot } from "../data/snapshot.ts";
