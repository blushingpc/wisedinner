// SITE v5 capture (docs/SITE-V5.md §5): / and /pricing at the four phone widths (iOS Safari UA, DPR 3) plus 768,
// 1024 and 1440 (DPR 2), fold and full page. The audit probe (scripts/audit-probe.js) runs in every cell; the hero fold
// geometry (§2: H1, sub and button above innerHeight minus 90; both phones' tops inside the first viewport at 390×844)
// is measured on /. Output: design/shots/v5/<phase>/ with probe.json and a one-line summary per cell. Run with a server:
//   node scripts/v5-shots.ts --phase before|after [--base http://localhost:3077] [--routes /,/pricing]
import { chromium, type Page } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(k);
  return i > -1 ? process.argv[i + 1] : d;
};
const BASE = arg("--base", "http://localhost:3077").replace(/\/$/, "");
const PHASE = arg("--phase", "before");
const OUT = `design/shots/v5/${PHASE}`;
mkdirSync(OUT, { recursive: true });
const PROBE = readFileSync("scripts/audit-probe.js", "utf8");

const IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const VIEWPORTS = [
  { name: "360x640", width: 360, height: 640, dpr: 3, mobile: true },
  { name: "390x844", width: 390, height: 844, dpr: 3, mobile: true },
  { name: "412x915", width: 412, height: 915, dpr: 3, mobile: true },
  { name: "430x932", width: 430, height: 932, dpr: 3, mobile: true },
  { name: "768x1024", width: 768, height: 1024, dpr: 2, mobile: false },
  { name: "1024x768", width: 1024, height: 768, dpr: 2, mobile: false },
  { name: "1440x900", width: 1440, height: 900, dpr: 2, mobile: false },
];
const ROUTES = arg("--routes", "/,/pricing").split(",");
const slug = (r: string) => (r === "/" ? "home" : r.replace(/^\//, "").replace(/\//g, "-"));

const browser = await chromium.launch();
const report: Record<string, unknown> = {};
const summary: string[] = [];

const probe = (page: Page) => page.evaluate(PROBE.replace(/^[\s\S]*?\(function \(\) \{/, "(() => {").replace(/\}\)\(\);?\s*$/, "})()")) as Promise<Record<string, unknown[] | unknown>>;

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr, isMobile: vp.mobile, hasTouch: vp.mobile, userAgent: vp.mobile ? IOS : undefined, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  for (const route of ROUTES) {
    const name = `${slug(route)}__${vp.name}@${vp.dpr}`;
    await page.goto(`${BASE}${route}`, { waitUntil: "load" });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${name}__fold.png` });
    // fold geometry before any resize
    let fold: Record<string, unknown> | null = null;
    if (route === "/") {
      fold = await page.evaluate(() => {
        const b = (e: Element | null) => {
          if (!e) return null;
          const r = e.getBoundingClientRect();
          return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), h: Math.round(r.height), lines: Math.round(r.height / parseFloat(getComputedStyle(e).lineHeight)) };
        };
        const h1 = document.querySelector("main h1");
        const phones = [...document.querySelectorAll("[data-phone]")].map((e) => ({ id: e.getAttribute("data-phone"), ...b(e) }));
        return {
          innerHeight,
          safeFold: innerHeight - 90,
          header: b(document.querySelector("header")),
          h1: b(h1),
          h1Lines: [...(h1?.querySelectorAll("[data-line]") ?? [])].map((s) => ({ text: s.textContent, ...b(s) })),
          h1Font: h1 ? getComputedStyle(h1).fontSize : null,
          sub: b(h1?.nextElementSibling ?? null),
          button: b(document.querySelector('button[data-placement="hero"]')),
          phones,
        };
      });
      report[`home-fold__${vp.name}`] = fold;
    }
    // full page: grow the viewport to the document height (cv-auto sections only render inside the viewport)
    const docH = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: vp.width, height: Math.min(docH, 12000) });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(300);
    const p = await probe(page);
    report[name] = p;
    const n = (k: string) => (Array.isArray(p[k]) ? (p[k] as unknown[]).length : 0);
    let line = `${name}: overflow ${n("overflow")} overlaps ${n("overlaps")} small ${n("small")} smallInputs ${n("smallInputs")} contrast ${n("contrast")}`;
    if (fold) {
      const f = fold as { safeFold: number; innerHeight: number; h1: { bottom: number } | null; sub: { bottom: number; lines: number } | null; button: { bottom: number } | null; phones: { id: string; top: number }[]; h1Font: string };
      const lowest = Math.max(f.h1?.bottom ?? 0, f.sub?.bottom ?? 0, f.button?.bottom ?? 0);
      line += ` | h1 ${f.h1Font} sub ${f.sub?.lines} lines, copy bottom ${lowest} vs safe ${f.safeFold} ${lowest <= f.safeFold ? "OK" : "FAIL"}, phones ${f.phones.map((ph) => `${ph.id}@${ph.top}${ph.top < f.innerHeight ? "" : " BELOW"}`).join(" ") || "none"}`;
    }
    summary.push(line);
  }
  await ctx.close();
}
await browser.close();
writeFileSync(`${OUT}/probe.json`, JSON.stringify(report, null, 2));
writeFileSync(`${OUT}/summary.txt`, summary.join("\n") + "\n");
console.log(summary.join("\n"));
