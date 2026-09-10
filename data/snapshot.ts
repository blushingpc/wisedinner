import raw from "./snapshot.json" with { type: "json" };
import { validateSnapshot } from "../packages/solver/src/snapshot.ts";

// the committed data snapshot (scripts/data/run.ts writes it; the pipeline publishes the same bundle to Supabase
// Storage). validated at import so a broken file fails the build, not a visitor.
export const snapshot = validateSnapshot(raw);
