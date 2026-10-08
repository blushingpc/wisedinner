// One exact reviewed LOCAL candidate. No filesystem, assembler or publisher.
import { createHash } from "node:crypto";
import { validateSnapshot } from "../../packages/solver/src/snapshot.ts";
import { expandRecipes } from "./expand.ts";
import { EQUIPMENT, PREPARATION_VERSION, resolvePreparation } from "./authored/preparation.ts";
import { preparationData, preparedCatalog } from "./prepared-selection.ts";

export const PREPARED_INPUT_SHA256 = "ec91a506d37c4a340fede59e7568319c9fddbec462452cc254481be4e78c1f20";
export const PREPARED_SOURCE_SHA256 = "3511018ee81a1974a7be36e3b458c528f79a65c16f7fb549c69373cd3b958dd7";
export const RECONCILED_STEP_IDS = ["egg-white-and-veggie-scramble-with-toast", "egg-white-and-veggie-scramble-with-toast-tofu", "egg-white-and-veggie-scramble-with-toast-potatoes"] as const;
const sha = (bytes: string) => createHash("sha256").update(bytes).digest("hex");

export function preparedMaterialization(inputBytes: string, suppliedSource: ReturnType<typeof expandRecipes>, version: string) {
  if (typeof inputBytes !== "string" || sha(inputBytes) !== PREPARED_INPUT_SHA256) throw Error("Unexpected reviewed snapshot bytes");
  if (version !== PREPARATION_VERSION) throw Error("Unsupported preparation version");
  const source = preparationData(suppliedSource), sourceBytes = JSON.stringify(source);
  if (typeof sourceBytes !== "string" || sha(sourceBytes) !== PREPARED_SOURCE_SHA256) throw Error("Unexpected reviewed source materialization");
  const snapshot = validateSnapshot(JSON.parse(inputBytes));
  const diffs = RECONCILED_STEP_IDS.map(id => {
    const row = snapshot.recipes.find(row => row.id === id)!, authored = source.recipes.find(row => row.id === id)!;
    const before = [...row.steps], after = [...authored.steps];
    row.steps = after;
    return { id, field: "steps" as const, before, after: [...after] };
  });
  validateSnapshot(snapshot);
  const pool = preparedCatalog(snapshot, { source, version, ownedEquipment: EQUIPMENT });
  return {
    snapshot,
    diffs,
    preparations: {
      scope: "exact-local-candidate-only" as const,
      version,
      sourceSha256: PREPARED_SOURCE_SHA256,
      equipmentVocabulary: [...EQUIPMENT],
      ownedEquipment: [...EQUIPMENT],
      eligibleIds: pool.snapshot.recipes.map(row => row.id),
      excluded: pool.excluded,
      recipes: snapshot.recipes.map(row => ({
        id: row.id,
        compatible: pool.preparations.some(method => method.id === row.id),
        reason: pool.excluded.find(item => item.id === row.id)?.reason ?? null,
        preparation: resolvePreparation(source, row.id, EQUIPMENT, version),
        crossLaneAccepted: false as const,
        restrictionAdmission: false as const,
      })),
      physicalFoodVerified: false as const,
      measuredPricesVerified: false as const,
      methodTimesMeasured: false as const,
      crossLaneAccepted: false as const,
      restrictionAdmission: false as const,
    },
  };
}
