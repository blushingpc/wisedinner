// STORE SCREENSHOT EXPORT (REDESIGN-V3 §5): captures /store-shots/<screen> at 1290×2796 (App Store 6.9") for
// S5, S1, S2, S6, S3, S4 → public/store/<n>-<screen>.png. run with a dev or prod server up:
//   node scripts/store-shots.ts [--base http://localhost:3077]
// playwright is the one browser dep the loop allows; the chrome-devtools MCP is the reviewer's tool, not a build step.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(k);
  return i > -1 ? process.argv[i + 1] : d;
};
const BASE = arg("--base", "http://localhost:3077").replace(/\/$/, "");
const ORDER = ["s5", "s1", "s2", "s6", "s3", "s4"];

mkdirSync("public/store", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1290, height: 2796 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
for (const [i, screen] of ORDER.entries()) {
  await page.goto(`${BASE}/store-shots/${screen}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const el = page.locator(".store-shot");
  const out = `public/store/${String(i + 1).padStart(2, "0")}-${screen}.png`;
  await el.screenshot({ path: out, type: "png" });
  console.log("wrote", out);
}
await browser.close();
