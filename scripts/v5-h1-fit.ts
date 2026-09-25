// SITE v5 §2 H1 fit: at 360, 390, 412 and 430 (iOS UA, DPR 3) find the largest font size at which each hero sentence
// ("Hit your protein.", "Spend way less.") breaks with no single-word last line. Each sentence is three words, so any
// wrap leaves one word alone on a line; in practice "no single-word last line" means one line per sentence. Prints
// the largest passing px per width and the vw coefficient that holds at every width. Run with a server up:
//   node scripts/v5-h1-fit.ts [--base http://localhost:3077]
import { chromium } from "playwright";

const i = process.argv.indexOf("--base");
const BASE = (i > -1 ? process.argv[i + 1] : "http://localhost:3077").replace(/\/$/, "");
const IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const browser = await chromium.launch();
const rows: { w: number; px: number; vw: number; current: string; currentOk: boolean }[] = [];
for (const w of [360, 390, 412, 430]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: IOS, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const res = await page.evaluate(() => {
    const h1 = document.querySelector("main h1") as HTMLElement;
    const lines = [...h1.querySelectorAll("[data-line]")] as HTMLElement[];
    const ok = () => lines.every((l) => {
      // one line: the span's client rects collapse to one line box
      const r = l.getClientRects();
      const tops = new Set([...r].map((x) => Math.round(x.top)));
      return tops.size === 1 && l.getBoundingClientRect().height < parseFloat(getComputedStyle(h1).fontSize) * 1.6;
    });
    const current = getComputedStyle(h1).fontSize;
    const currentOk = ok();
    let lo = 24, hi = 80;
    while (hi - lo > 0.1) {
      const mid = (lo + hi) / 2;
      h1.style.fontSize = mid + "px";
      if (ok()) lo = mid; else hi = mid;
    }
    h1.style.fontSize = "";
    return { px: Math.floor(lo * 10) / 10, current, currentOk };
  });
  rows.push({ w, px: res.px, vw: +((res.px / w) * 100).toFixed(2), current: res.current, currentOk: res.currentOk });
  await ctx.close();
}
await browser.close();
for (const r of rows) console.log(`${r.w}: max ${r.px}px (${r.vw}vw); current ${r.current} ${r.currentOk ? "one line each" : "WRAPS"}`);
console.log(`vw that holds everywhere: ${Math.min(...rows.map((r) => r.vw))}`);
