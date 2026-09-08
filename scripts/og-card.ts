// OG CARD EXPORT (REDESIGN-V4 §2D): captures /og-card at 1200×630 → public/og/home.png (the homepage's og:image), and
// the lockup on /press/lockup → public/press/wisedinner-lockup.png for the press kit.
// run with a dev or prod server up: node scripts/og-card.ts [--base http://localhost:3077]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(k);
  return i > -1 ? process.argv[i + 1] : d;
};
const BASE = arg("--base", "http://localhost:3077").replace(/\/$/, "");

mkdirSync("public/og", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
await page.goto(`${BASE}/og-card`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.locator(".og-card").screenshot({ path: "public/og/home.png", type: "png" });
console.log("wrote public/og/home.png (2400×1260)");
await page.goto(`${BASE}/press/lockup`, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
await page.locator(".lockup-card").screenshot({ path: "public/press/wisedinner-lockup.png", type: "png" });
console.log("wrote public/press/wisedinner-lockup.png (2400×800)");
await browser.close();
