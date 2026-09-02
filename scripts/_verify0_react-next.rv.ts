import { chromium, type Page, type BrowserContext } from "playwright";

const BASE = "http://localhost:3077";
type Call = [string, { name?: string }];

function encodeAnswers(a: Record<string, unknown>, seed?: number) {
  const json = JSON.stringify(seed === undefined ? a : { ...a, seed });
  return btoa(String.fromCharCode(...new TextEncoder().encode(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const ANSWERS = { budget: 60, spend: "", protein: 150, band: 1, diet: "none", household: 1, pantry: [] as string[] };
const log = (s: string) => console.log(s);

async function ctx(browser: Awaited<ReturnType<typeof chromium.launch>>): Promise<BrowserContext> {
  const c = await browser.newContext();
  await c.route(/va\.vercel-scripts\.com/, (r) => r.abort());
  await c.addInitScript(() => {
    (window as unknown as { __va: unknown[] }).__va = [];
    (window as unknown as { va: (...p: unknown[]) => void }).va = (...p: unknown[]) => (window as unknown as { __va: unknown[] }).__va.push(p);
  });
  return c;
}
const reveals = async (page: Page) => (await page.evaluate(() => (window as unknown as { __va: Call[] }).__va)).filter((c) => c[0] === "event" && c[1]?.name === "reveal_view").length;
const allEvents = async (page: Page) => (await page.evaluate(() => (window as unknown as { __va: Call[] }).__va)).filter((c) => c[0] === "event").map((c) => c[1]?.name);
const h1 = async (page: Page) => { await page.waitForSelector("h1"); return (await page.locator("h1").first().innerText()).trim(); };
const printed = (page: Page) => page.evaluate(() => document.body.innerText.match(/printed[^\n]*/i)?.[0] ?? "");

(async () => {
  const browser = await chromium.launch();

  // A: fresh context, valid canonical ?p= (seed 0) -> regenerate
  {
    const c = await ctx(browser);
    const page = await c.newPage();
    let solves = 0; const statuses: number[] = [];
    page.on("request", (r) => { if (r.method() === "POST" && r.url().endsWith("/api/solve")) solves++; });
    page.on("response", (r) => { if (r.request().method() === "POST" && r.url().endsWith("/api/solve")) statuses.push(r.status()); });
    const p = encodeAnswers(ANSWERS, 0);
    await page.goto(`${BASE}/plan?p=${p}`);
    log(`A load     : h1="${await h1(page)}"`);
    await page.waitForTimeout(1500);
    const r0 = await reveals(page), s0 = solves;
    log(`A load     : reveal_view=${r0} solves=${s0} ${JSON.stringify(statuses)} url=${page.url().replace(BASE, "")} printed="${await printed(page)}" events=${JSON.stringify(await allEvents(page))}`);
    const btn = page.locator('button:has-text("regenerate")');
    if (await btn.count()) {
      await btn.click();
      await btn.waitFor({ state: "detached", timeout: 20000 }).catch(() => log("   regenerate button still present (error?)"));
      await page.waitForTimeout(2500);
      const r1 = await reveals(page), s1 = solves;
      log(`A regen    : reveal_view=${r1} (delta ${r1 - r0}) solves=${s1} (delta ${s1 - s0}) ${JSON.stringify(statuses)} url=${page.url().replace(BASE, "")} printed="${await printed(page)}" events=${JSON.stringify(await allEvents(page))}`);
      // B: same tab (sessionStorage retained), navigate to bare /plan
      const sB = solves;
      await page.goto(`${BASE}/plan`);
      log(`B bare/plan: h1="${await h1(page)}"`);
      await page.waitForTimeout(2500);
      log(`B bare/plan: reveal_view=${await reveals(page)} (this page load only) solves=${solves - sB} url=${page.url().replace(BASE, "")} events=${JSON.stringify(await allEvents(page))}`);
    }
    await c.close();
  }

  // C: cold bare /plan (no session) -> empty state, expect 0 reveal_view
  {
    const c = await ctx(browser);
    const page = await c.newPage();
    await page.goto(`${BASE}/plan`);
    const t = await h1(page);
    await page.waitForTimeout(1500);
    log(`C cold bare: reveal_view=${await reveals(page)} url=${page.url().replace(BASE, "")} h1="${t}"`);
    await c.close();
  }

  // D: reload of a canonical ?p= with matching cache (the state a quiz-solved tab is in)
  {
    const c = await ctx(browser);
    const page = await c.newPage();
    let solves = 0;
    page.on("request", (r) => { if (r.method() === "POST" && r.url().endsWith("/api/solve")) solves++; });
    const p = encodeAnswers(ANSWERS, 0);
    await page.goto(`${BASE}/plan?p=${p}`);
    log(`D load     : h1="${await h1(page)}" solves=${solves}`);
    await page.waitForTimeout(1500);
    const s0 = solves;
    await page.reload();
    log(`D reload   : h1="${await h1(page)}"`);
    await page.waitForTimeout(1500);
    log(`D reload   : reveal_view=${await reveals(page)} solves on reload=${solves - s0} url=${page.url().replace(BASE, "")}`);
    await c.close();
  }

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
