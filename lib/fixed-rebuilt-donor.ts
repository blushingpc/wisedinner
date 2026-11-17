import { canonicalReferenceData, copyReferenceData } from "./generated-plan-data.ts";
import { sha256Hex } from "./generated-runtime-bytes.ts";

export const FIXED_REBUILT_DONOR_PIN = Object.freeze({
  sha256: "92eb46ecf3b6532a6d7d1e2e5bdcb9316b07d0d317c0ee8e8b9397cba7979941",
  recordCount: 1301,
});

export const FIXED_REBUILT_DONOR_RECIPE_ID = "WD-R6-M-48c87619327f37b3-flex-ham-113g-v1";
export const FIXED_REBUILT_DONOR_UTILITY_SHA256 = "1c48e62e794e36d25a88465a2ce4d5e43d4ef1fbca262426d51e4a61243d752b";
export const FIXED_REBUILT_DONOR_BASIS_SHA256 = "7b00706d06b2ea52d0af6a7933149ebfd485412e5b813c3ea2c4acf82e5e01eb";

const rebuiltConfigurationSha256 = "0e1ec60b98c5ca04b8145e14bcbc4bb76f66511fcf72ef7d56cd3f18b6ff9cd4";
const donorConfigurationSha256 = "eb66ae08d74c90149bc2d144b86308ad25a7e5a0c559f8ee6877e08b550a4f70";
const digest = (value: unknown) => sha256Hex(JSON.stringify(canonicalReferenceData(value)));
type Data = Record<string, unknown>;

export function deriveFixedRebuiltDonorConfiguration(value: unknown): Data {
  const parent = copyReferenceData(value) as Data;
  if (digest(parent) !== rebuiltConfigurationSha256) throw Error("fixed_donor_parent_configuration_mismatch");
  const oldUtility = parent.tapCookingWater as Data;
  const utility = {
    ...oldUtility,
    sourcePin: FIXED_REBUILT_DONOR_PIN,
    derivation: { ...oldUtility.derivation as Data, sourceSha256: FIXED_REBUILT_DONOR_PIN.sha256 },
  };
  const configuration = { ...parent, sourcePin: FIXED_REBUILT_DONOR_PIN, tapCookingWater: utility };
  if (digest(configuration) !== donorConfigurationSha256) throw Error("fixed_donor_configuration_mismatch");
  return configuration;
}

// This is the reviewed 113 g ham row, including its USDA calculation,
// ingredient allocation and parent lineage. A different row requires review
// and a new seal. The ordinary rebuilt source has no donor rows.
const reviewedRowSha256 = "da6aba08f674865aa41b01ed14b525212ccc2ce6efdf207f281c73609ee1090a";
const originalNutritionBody = "ee60b75c57b92249e1d6bd57c8e868bff15b9d83c82757f67f01ef6f05bb77c6";

export function fixedRebuiltDonorNutritionParent(
  row: Record<string, unknown>,
  sourceSha256: string,
): string | null {
  if (sourceSha256 !== FIXED_REBUILT_DONOR_PIN.sha256 || row.id !== FIXED_REBUILT_DONOR_RECIPE_ID) return null;
  return digest(row) === reviewedRowSha256 ? originalNutritionBody : null;
}
