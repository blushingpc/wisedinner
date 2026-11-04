import { canonicalReferenceData } from "./generated-plan-data.ts";
import { sha256Hex } from "./generated-runtime-bytes.ts";

// Exact five-row candidate transition; Main adoption remains separate.
// Both full-proof and compact-projection seals retain the same manufacturer provenance.
const seals = {
  "WD-R6-M-54316e6ab3b30c26": {
    "recipeSha256": "3eecb1d354223238538be07359678fd2db48356521201d91b7e181a7edf19b2f",
    "nutritionSha256": [
      "37041ad0b6d2090868ffccbbd259802bdf41e762d821f38f302e7eca120e6f4f",
      "d0eca8c064b3561c13e121f79f38a6a2edfd1657840f5a3876954199c3520338"
    ]
  },
  "WD-R6-M-39090a2980a3502f": {
    "recipeSha256": "d003c623c88c6865f78f28d992839990b699d0b8e562db3661ecab85b842a1be",
    "nutritionSha256": [
      "3729cff48aad1dd2e1273498af8378b3e6518cb9c338bb4f2b4fee719475e664",
      "aef211b3ead48296b372c56798cd9fa04acddf1603475c65f36fad1ef1304439"
    ]
  },
  "WD-R6-M-41c759e005a9d0c6": {
    "recipeSha256": "909c247c8ce4c980ae0c6554ed8d886e8e14bc7861b17b886c5bbbdb075ceaf4",
    "nutritionSha256": [
      "79bbd012ff2febba978bcd07b496ae0939a3b0e521ad0c89b0fb50670a94f339",
      "bad11cbc70a2c72ca632c7a7da8b280c2caa7d62b0e3b6ffd9d4a3c3788e9aad"
    ]
  },
  "WD-R6-M-7e11eae5032623ec": {
    "recipeSha256": "eb427f9a87c59fad268e39e929d06c213707dc6cc76af39c7b39ce03e729d19c",
    "nutritionSha256": [
      "11a856d2d37d6fbe1765379e75d3ba4ed9e25228773b647e1a9ab9ebc877923d",
      "fc190bddd39c0345e265189840bff67cc252e3e60175193caf809056b491fb9f"
    ]
  },
  "WD-R6-M-628e1158649e7a0c": {
    "recipeSha256": "1e4e8cdb6843248b888405f3f460c21b96e00ea45e85f42731b8d83b51c4fc3c",
    "nutritionSha256": [
      "d2746953b878123219d186dbd277daf7eb2ec328073a23c6ec85e0f932c7986d",
      "f9f41a2f2017a66354c5f9f4ce3a82690096eaf54ad72ee44f70e64551d82098"
    ]
  }
} as const;
export const MIXED_NUTRITION_STATUS = "complete-conditional-USDA-and-manufacturer-input-estimate";
export function isReviewedMixedNutrition(row: Record<string, unknown>): boolean {
  const s = seals[row.id as keyof typeof seals];
  if (!s || row.recipe_sha256 !== s.recipeSha256) return false;
  return (s.nutritionSha256 as readonly string[]).includes(sha256Hex(JSON.stringify(canonicalReferenceData(row.nutrition))));
}
