import { canonicalReferenceData } from "./generated-plan-data.ts";
import { sha256Hex } from "./generated-runtime-bytes.ts";

// Exact five-row candidate transition; Main adoption remains separate.
// Both full-proof and compact-projection seals retain the same manufacturer provenance.
const seals = { ...{"wd-curated-plant-v1-peanut-tofu":{"recipeSha256":"5e48c312f0fe119748f49d2647e96a75eb3582203f34eacc4b832f2a2ffdc2e3","nutritionSha256":["f377d0d9123c06984e72ae09fc787067f6c799ca9d5072c6a797a37564955f9c"]},"wd-curated-plant-v1-roasted-peanut-tofu":{"recipeSha256":"156b0c823ab14a0c26f79b29626c14bc32058aca117d7994a42680c52fe8c59d","nutritionSha256":["3e16573e236100454d7d9cb117420e0ce390444cc67e9ab39272917980808d4a"]},"wd-curated-plant-v1-banana-peanut-oats":{"recipeSha256":"dfa0f7a33a1af9275a80eca485f04e99b2d69b068edc21fba5a392c0f4ca266a","nutritionSha256":["49b7a9acd0427f0d55f6b1b8e38817d18cc11d0516ace0ae7bc27e064e0d518b"]},"wd-curated-plant-v1-black-bean-potatoes":{"recipeSha256":"718a23fe700d1851eb89003e0201a75d7587794a6b7e8eb983d84bea87499383","nutritionSha256":["4558b31bbea1a44e8f126bec551435187ef7357ce004a6af180552b09170c113"]},"wd-curated-plant-v1-chickpea-pasta":{"recipeSha256":"135b5da83297615ee8877d7f538dd81381cca492815644b184ee3d5f10d370e4","nutritionSha256":["709b6cf4ca372fdea08903ce19c20af4a5ce4094b4498f5aee49043edfe45a25"]},"wd-curated-plant-v1-overnight-oats":{"recipeSha256":"93e5d8e08d942abc399563cc8eb70b08a2f8fa7d2efdfd36bc65d5d398bf0b23","nutritionSha256":["2b39771675eb40650de27ed603229b03dfbece204b7791489c7cc4536e3b99e6"]},"wd-curated-plant-v1-tofu-hash":{"recipeSha256":"3d1c603a201b2ed88456abea1b74aa12d49bef78d6ac9af1e69e8322ac4cceab","nutritionSha256":["76e568074430419dd7ab299d371e088261068cacd560363f4537569943792870"]},"wd-curated-plant-v1-black-bean-skillet":{"recipeSha256":"354149a03b6d23c26ebfe1c290a5028e8cdc1e7e8d1d12ac6a97a95fd038083b","nutritionSha256":["203e216ee77e8aaa2b9edc763c8f0235c5bd1521ff51c51c059dc5fe3ab237d5"]},"wd-curated-plant-v1-pea-milk-oats":{"recipeSha256":"b7cacb13a7c2ea5e4ff9c949336f4a45a85ef8c7a216bf6e0bea331043e45979","nutritionSha256":["6127b1b6953c0b35e4ced913cd3d2b28e811ef6a59ee7029eda3d633c8e553d6"]},"wd-curated-plant-v1-potato-black-bean-chili":{"recipeSha256":"ba5b55e5bc3693423f330f461cdc8d4aa6c9f13cd2d232cee389fdf9302b94f9","nutritionSha256":["c8f452e32bad7c83a461b741ad8f6c35bb16815525317b6b3348f4875b53576f"]},"wd-curated-plant-v1-red-lentil-potato-soup":{"recipeSha256":"538509ea4ca9f1ae68203f234550f5d59b4bc6d40c455b69755a83310ebb963a","nutritionSha256":["3aa398393fc1bcc5166e00039611bb100c8f971e044fdde2c4e3f0364998b196"]},"wd-curated-plant-v1-tomato-tofu-pasta":{"recipeSha256":"0c25b80d20a3b3f835f49ed390efc163a5ec337953cc7144325baec26b45d33a","nutritionSha256":["9408963e47ef0083d6d4d2472b0c2b74d1fdfea8f621c555e1cfaa2286fa484c"]},"wd-curated-plant-v1-tofu-black-bean-bowl":{"recipeSha256":"fd7e538f87447168ff4352b8951bfaefb38f7b94ec079ab2534ae3727579f011","nutritionSha256":["9247e77e30ad44059d2e5db3d77faaab85d9a7d87e3c9b6485da7a9e9319bfd4"]}},
  ...{"wd-curated-v1-42-heat-and-serve":{"recipeSha256":"3bd6375b12a387801831b5fa32a5d484b457cf885d79d58e8cd89a9b74320992","nutritionSha256":["3aba2cbe76b2e2acc5433b81980b6666c135bf223020fec0eee329ab4fc44d4a"]}},
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
const archivedSeals: Readonly<Record<string, { recipeSha256: string; nutritionSha256: readonly string[] }>> = {"wd-curated-plant-v1-peanut-tofu":{"recipeSha256":"519b0dff78a4836a4da08a0037225c4242cb2d9fcacda81185e0fb2f30e535b7","nutritionSha256":["3b4cf60d498524dbc14e3af96ebf3ae049e33472ebe3353cc26795a18d7a82e3"]},"wd-curated-plant-v1-roasted-peanut-tofu":{"recipeSha256":"1f490ccc1a1851afd0a3aedd5e2df3f7e5c50d728a0a13f93e67544854605de4","nutritionSha256":["0c57ef766edd1bf36d40fac684ce4af59d32ca7999a11a3ca400bc18ee0934f4"]},"wd-curated-plant-v1-tomato-tofu-pasta":{"recipeSha256":"d39fa215c58ef8f39baf64f2497445d83e3a301d5cdaaeb886924ba6f8203998","nutritionSha256":["bb38bb36d60796107a42d0e8fbf84f9a8f2d8484cf5b32f1767bb995368abd4a"]},"wd-curated-plant-v1-tofu-black-bean-bowl":{"recipeSha256":"01c8e306860ab3ef52049e41dbaefd9d70bbfa424bd1d4e60c318b89e6958ce0","nutritionSha256":["577ca6eb48e02322769ab89791e70648ed9dc3a1c9980de106ad8d708f6be59f"]},"wd-curated-plant-v1-overnight-oats":{"recipeSha256":"0410e582c3c00e6d30a8524baad431ad48d72893c1c19dfa6ffd8da98a68ef31","nutritionSha256":["3a6becb29443e44e608c56ce3321c3e8735794f064bef57b1e30f0930b57effa"]}};
export const MIXED_NUTRITION_STATUS = "complete-conditional-USDA-and-manufacturer-input-estimate";
export function isReviewedMixedNutrition(row: Record<string, unknown>): boolean {
  const current = seals[row.id as keyof typeof seals];
  const s = current?.recipeSha256 === row.recipe_sha256 ? current : archivedSeals[String(row.id)];
  if (!s || row.recipe_sha256 !== s.recipeSha256) return false;
  return (s.nutritionSha256 as readonly string[]).includes(sha256Hex(JSON.stringify(canonicalReferenceData(row.nutrition))));
}
