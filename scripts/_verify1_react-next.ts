import { chromium, type Page, type Browser } from "playwright";
const BASE = "http://localhost:3077";
const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const answers = { budget: 60, spend: "", protein: 150, band: 1, diet: "none", household: 1, pantry: [] as string[] };

// trap window.va before @vercel/analytics injects (its injector early-returns when window.va is truthy);
// track() calls window.va("event", { name, data }) — record every call, forward to whatever the debug script sets later
const TRAP = `(() => {
  const calls = []; window.__vaCalls = calls; let real = null;
  const wrapper = function(...a){ calls.push(a); try { return real && real.apply(this, a); } catch {} };
  Object.defineProperty(window, "va", { configurable: true, get(){ return wrapper; }, set(fn){ real = fn; } });
})();`;

const reveals = (page: Page) => page.evaluate(() => (window as any).__vaCalls.filter((c: any) => c[0] === "event" && c[1]?.name === "reveal_view").length);
async function waitPlan(page: Page) {
  await page.waitForFunction(() => (document.querySelector("main h1")?.textContent ?? "").includes("five days"), null, { timeout: 60_000 });
  await page.waitForTimeout(600); // let any trailing effect run
}
async function ctxWithProbe(browser: Browser) {
  const ctx = await browser.newContext();
  await ctx.addInitScript(TRAP);
  const page = await ctx.newPage();
  let solves = 0;
  page.on("request", (r) => { if (r.url().includes("/api/solve") && r.method() === "POST") solves++; });
  const consoleLines: string[] = [];
  page.on("console", (m) => { if (/reveal_view/.test(m.text())) consoleLines.push(m.text().slice(0, 100)); });
  return { ctx, page, solves: () => solves, consoleLines };
}

(async () => {
  const browser = await chromium.launch();
  const q0 = enc({ ...answers, seed: 0 });

  // S1: fresh context, valid ?p=, then regenerate
  {
    const { ctx, page, solves } = await ctxWithProbe(browser);
    await page.goto(`${BASE}/plan?p=${q0}`, { waitUntil: "networkidle" });
    await waitPlan(page);
    const n0 = await reveals(page), s0 = solves();
    const url0 = page.url();
    console.log(`S1 mount   reveal_view=${n0} solves=${s0} url=${url0.replace(BASE, "")}`);
    await page.getByRole("button", { name: "regenerate" }).click();
    await page.waitForFunction(() => !document.querySelector("button")?.textContent?.includes("re-solving"), null, { timeout: 30_000 });
    await page.waitForURL((u) => u.toString() !== url0, { timeout: 15_000 }).catch(() => console.log("  (url did not change)"));
    await page.waitForTimeout(800);
    const n1 = await reveals(page), s1 = solves();
    console.log(`S1 regen   reveal_view=${n1} (delta ${n1 - n0}) solves=${s1} (delta ${s1 - s0}) url=${page.url().replace(BASE, "")}`);
    const cachedQ = new URL(page.url()).searchParams.get("p")!;

    // S3 control: reload the canonical URL with the cache warm (dev StrictMode baseline)
    await page.goto(`${BASE}/plan?p=${cachedQ}`, { waitUntil: "networkidle" });
    await waitPlan(page);
    const sBefore = solves();
    const c = await reveals(page);
    console.log(`S3 ctrl    /plan?p=<cached>  reveal_view=${c} solves(new)=${solves() - sBefore} url=${page.url().replace(BASE, "")}`);

    // S2: bare /plan with the cache warm
    const sBefore2 = solves();
    await page.goto(`${BASE}/plan`, { waitUntil: "networkidle" });
    await waitPlan(page);
    const b = await reveals(page);
    console.log(`S2 bare    /plan (cached)     reveal_view=${b} solves(new)=${solves() - sBefore2} url=${page.url().replace(BASE, "")}`);
    console.log(`=> extra reveal_view from bare-/plan canonicalisation: ${b - c}`);
    await ctx.close();
  }

  // S4: quiz-produced link semantics — shared link WITHOUT seed (seed omitted from p)
  {
    const { ctx, page, solves } = await ctxWithProbe(browser);
    const qNoSeed = enc(answers);
    await page.goto(`${BASE}/plan?p=${qNoSeed}`, { waitUntil: "networkidle" });
    await waitPlan(page);
    const n = await reveals(page);
    console.log(`S4 noseed  reveal_view=${n} solves=${solves()} url changed=${page.url() !== `${BASE}/plan?p=${qNoSeed}`} url=${page.url().replace(BASE, "")}`);
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
