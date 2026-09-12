// MOBILE FIX PASS v2 capture: every route at the four phone widths the brief names (390×844 and 430×932 as iOS
// Safari, 360×800 and 412×915 as Android Chrome, all at DPR 3), the fold and the full page, plus the pre-order modal
// open and the switcher on screen 2. The audit probe (scripts/audit-probe.js) runs in every cell and its JSON lands
// beside the shots. Run with a server up:
//   node scripts/mobile-shots.ts --phase before|after [--base http://localhost:3077] [--routes /,/pricing]
import { chromium, type Page } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(k);
  return i > -1 ? process.argv[i + 1] : d;
};
const BASE = arg("--base", "http://localhost:3077").replace(/\/$/, "");
const PHASE = arg("--phase", "before");
const OUT = `design/shots/mobile-v2/${PHASE}`;
mkdirSync(OUT, { recursive: true });
const PROBE = readFileSync("scripts/audit-probe.js", "utf8");

const IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844, ua: IOS },
  { name: "430x932", width: 430, height: 932, ua: IOS },
  { name: "360x800", width: 360, height: 800, ua: ANDROID },
  { name: "412x915", width: 412, height: 915, ua: ANDROID },
];
const ROUTES = arg("--routes", "/,/pricing,/faq,/support,/w/example,/does-not-exist").split(",");
const slug = (r: string) => (r === "/" ? "home" : r.replace(/^\//, "").replace(/\//g, "-"));

const browser = await chromium.launch();
const report: Record<string, unknown> = {};

const probe = (page: Page) => page.evaluate(PROBE.replace(/^\(function \(\) \{/, "(() => {").replace(/\}\)\(\);?\s*$/, "})()"));
const settle = (page: Page) => page.waitForTimeout(900);

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: vp.ua, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  for (const route of ROUTES) {
    const name = `${slug(route)}__${vp.name}@3`;
    await page.goto(`${BASE}${route}`, { waitUntil: "load" });
    await settle(page);
    await page.screenshot({ path: `${OUT}/${name}__fold.png` });
    // full page: the viewport grows to the document height (cv-auto sections render only inside the viewport, and
    // puppeteer's fullPage leaves them blank), then shrinks back
    const docH = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: vp.width, height: Math.min(docH, 12000) });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(300);
    report[name] = await probe(page);

    if (route === "/") {
      // the modal from the hero button
      await page.locator('button[data-placement="hero"]').click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/home-modal__${vp.name}@3.png` });
      report[`home-modal__${vp.name}`] = await page.evaluate(() => {
        const d = document.querySelector("dialog.preorder-dialog[open]");
        const r = (e: Element | null) => (e ? Object.fromEntries(Object.entries(e.getBoundingClientRect().toJSON()).map(([k, v]) => [k, Math.round(v as number)])) : null);
        return { dialog: r(d), cards: [...(d?.querySelectorAll("a[href]") ?? [])].map(r), badges: [...(d?.querySelectorAll("img") ?? [])].map(r) };
      });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      // the switcher on screen 2, scrolled into view
      await page.locator("#how").scrollIntoViewIfNeeded();
      await page.locator('#how button[aria-label="Next screen"]').click();
      await page.waitForTimeout(400);
      await page.locator("#how").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/home-switcher2__${vp.name}@3.png` });
      // the sticky bar once the hero button has left: scroll to the switcher heading and shoot the fold
      await page.evaluate(() => scrollTo(0, document.querySelector("#how")!.getBoundingClientRect().top + scrollY - 60));
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/home-sticky__${vp.name}@3.png` });
      report[`home-sticky__${vp.name}`] = await page.evaluate(() => {
        const bar = document.querySelector('button[data-placement="sticky"]')?.closest("div");
        const r = bar?.getBoundingClientRect();
        return bar ? { top: Math.round(r!.top), bottom: Math.round(r!.bottom), height: Math.round(r!.height), transform: getComputedStyle(bar).transform, ariaHidden: bar.getAttribute("aria-hidden") } : null;
      });
      // hero fold geometry: everything the brief wants above the fold
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(300);
      report[`home-fold__${vp.name}`] = await page.evaluate(() => {
        const b = (sel: string) => {
          const e = document.querySelector(sel);
          if (!e) return null;
          const r = e.getBoundingClientRect();
          return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), lines: Math.round(r.height / parseFloat(getComputedStyle(e).lineHeight)) };
        };
        return { innerHeight, safeFold: innerHeight - 90, header: b("header"), pill: b("main section p"), h1: b("h1"), sub: b("h1 + p"), button: b('button[data-placement="hero"]'), micro: b('button[data-placement="hero"] + p'), stage: b('[role="img"]') };
      });
    }
  }
  await ctx.close();
}
await browser.close();
writeFileSync(`${OUT}/probe.json`, JSON.stringify(report, null, 2));
console.log(`done: ${Object.keys(report).length} cells → ${OUT}`);
