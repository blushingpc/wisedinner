// remediation-spec acceptance probe (WD-01/02/03). run: node scripts/wd-check.ts [--base http://localhost:3077]
// prints measured values; exits 1 on any FAIL so it can gate a phase.
import { chromium } from "playwright";

const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(k);
  return i > -1 ? process.argv[i + 1] : d;
};
const BASE = arg("--base", "http://localhost:3077").replace(/\/$/, "");
const ROUTES = ["/", "/start", "/plan", "/pricing", "/faq", "/the-math", "/drop", "/about", "/press", "/support", "/terms", "/privacy"];

let fails = 0;
const fail = (m: string) => {
  fails++;
  console.log("  ✖", m);
};
const ok = (m: string) => console.log("  ✔", m);

const browser = await chromium.launch();

// WD-01 — no fragment link points at an id that does not exist on its page; data-placement values preserved
{
  const page = await browser.newPage();
  const placements = new Set<string>();
  for (const r of ROUTES) {
    await page.goto(`${BASE}${r}`, { waitUntil: "domcontentloaded" });
    const dead = await page.locator('a[href^="#"]').evaluateAll((els) =>
      els.map((e) => e.getAttribute("href") ?? "").filter((h) => h.length > 1 && !document.getElementById(h.slice(1))),
    );
    const p = await page.locator("[data-placement]").evaluateAll((els) => els.map((e) => e.getAttribute("data-placement")));
    p.forEach((x) => x && placements.add(x));
    if (dead.length) fail(`WD-01 ${r}: ${dead.length} dead fragment links (${[...new Set(dead)].join(", ")})`);
    else ok(`WD-01 ${r}: 0 dead fragment links`);
  }
  console.log("  data-placement values seen:", [...placements].sort().join(", "));
  await page.close();
}

// WD-02 — header nav + CTA hit-testable at every scroll step, 1440 + 1746
for (const width of [1440, 1746]) {
  // reduced motion is the repro condition: without the hero fade-up transform there is no accidental stacking context
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const targets = ['header a[data-placement="header"]', 'header a[href="/#how"]', 'header a[href="/pricing"]', 'header a[href="/faq"]'];
  let bad = 0;
  for (let y = 0; y <= 1200; y += 100) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(80);
    for (const sel of targets) {
      const hit = await page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (!el) return "missing";
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return top === el || el.contains(top) ? "ok" : `${top?.tagName.toLowerCase()}${top instanceof HTMLImageElement ? `[${top.alt.slice(0, 30)}]` : ""}`;
      }, sel);
      if (hit !== "ok") {
        bad++;
        console.log(`    ${width}px scrollY=${y} ${sel} → covered by <${hit}>`);
      }
    }
  }
  if (bad) fail(`WD-02 ${width}px: ${bad} covered hit-tests`);
  else ok(`WD-02 ${width}px: header clickable at every step (reduced motion)`);
  await page.close();
}

// WD-03 — mobile sticky bar: hidden at top, visible after the hero CTA leaves, never covering the final CTA
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const bar = 'a[data-placement="sticky"]';
  const state = async (y: number) => {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(450);
    return page.evaluate((sel) => {
      const a = document.querySelector(sel) as HTMLElement;
      const r = a.parentElement!.getBoundingClientRect();
      const finalCta = document.querySelector('a[data-placement="final"]')?.getBoundingClientRect();
      return { y: window.scrollY, top: Math.round(r.top), visible: r.top < window.innerHeight, overlapsFinal: !!finalCta && finalCta.bottom > r.top && finalCta.top < r.bottom };
    }, bar);
  };
  const docH = await page.evaluate(() => document.documentElement.scrollHeight);
  const heroCtaBottom = await page.evaluate(() => (document.querySelector('a[data-placement="hero"]') as HTMLElement).getBoundingClientRect().bottom + window.scrollY);
  const s0 = await state(0);
  if (s0.visible) fail(`WD-03 bar visible at scrollY 0 (top=${s0.top})`);
  else ok("WD-03 bar hidden at scrollY 0");
  const sAfter = await state(Math.round(heroCtaBottom + 200));
  if (sAfter.visible) ok(`WD-03 bar visible once hero CTA is gone (scrollY ${sAfter.y})`);
  else fail(`WD-03 bar still hidden at scrollY ${sAfter.y} (hero CTA bottom ${Math.round(heroCtaBottom)})`);
  for (const y of [1500, 3000, 5000, Math.round(docH * 0.6), Math.round(docH * 0.9)]) {
    const s = await state(y);
    console.log(`    390px scrollY=${s.y} bar top=${s.top} visible=${s.visible}`);
  }
  const sEnd = await state(docH);
  if (sEnd.overlapsFinal) fail("WD-03 bar covers the final CTA at page bottom");
  else ok(`WD-03 bar clear of the final CTA at page bottom (visible=${sEnd.visible})`);
  await page.close();
}

await browser.close();
console.log(fails ? `\n${fails} FAIL` : "\nall checks pass");
process.exit(fails ? 1 : 0);
