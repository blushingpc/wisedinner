import { chromium, type Page, type Browser } from "playwright";
const BASE = "http://localhost:3077";
const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const dec = (p: string) => JSON.parse(Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
const base = { budget: 60, spend: "", protein: 150, band: 1, diet: "none", household: 1, pantry: [] as string[] };

// trap window.va: @vercel/analytics track() does window.va.call(window, "event", {name,...})
const TRAP = `(() => {
  const calls = []; window.__vaCalls = calls; let real = null;
  const wrapper = function(...a){ calls.push({ t: Date.now(), a }); try { return real && real.apply(this, a); } catch {} };
  Object.defineProperty(window, "va", { configurable: true, get(){ return wrapper; }, set(fn){ real = fn; } });
})();`;

async function fresh(browser: Browser) {
  const ctx = await browser.newContext();
  await ctx.addInitScript(TRAP);
  const page = await ctx.newPage();
  const consoleReveal: string[] = [];
  page.on("console", (m) => { const t = m.text(); if (t.includes("reveal_view")) consoleReveal.push(t.slice(0, 120)); if (m.type() === "error") console.log("  console.error:", t.slice(0, 200)); });
  page.on("pageerror", (e) => console.log("  pageerror:", e.message.slice(0, 200)));
  page.on("response", (r) => { if (r.url().includes("/api/solve")) console.log("  /api/solve ->", r.status()); });
  return { ctx, page, consoleReveal };
}
const count = (page: Page, name: string) =>
  page.evaluate((n) => (window as any).__vaCalls.filter((c: any) => c.a[0] === "event" && c.a[1]?.name === n).length, name);
async function waitPlan(page: Page, tag: string) {
  const t0 = Date.now();
  while (Date.now() - t0 < 60_000) {
    const h1 = await page.evaluate(() => document.querySelector("main h1")?.textContent ?? "");
    if (h1.includes("five days")) return true;
    if (h1) { console.log(`${tag}: non-plan h1 "${h1}"`); return false; }
    await page.waitForTimeout(500);
  }
  console.log(`${tag}: plan never rendered; skeleton=${await page.locator('[role="status"]').count()} url=${page.url()}`);
  return false;
}
const allEvents = (page: Page) => page.evaluate(() => (window as any).__vaCalls.filter((c: any) => c.a[0] === "event").map((c: any) => c.a[1]?.name));

async function regenerateAndCount(page: Page, tag: string, consoleReveal: string[]) {
  const before = await count(page, "reveal_view");
  const urlBefore = page.url();
  const skeletonBefore = await page.locator('[role="status"][aria-label="loading your plan"]').count();
  console.log(`${tag}: after load  reveal_view=${before} events=${JSON.stringify(await allEvents(page))} url=${urlBefore.replace(BASE, "")} skeleton=${skeletonBefore}`);
  const btn = page.getByRole("button", { name: /^regenerate/ });
  console.log(`${tag}: regenerate buttons=${await btn.count()}`);
  await btn.click();
  await page.waitForURL((u) => u.toString() !== urlBefore, { timeout: 15_000 }).catch(() => console.log(`${tag}: URL did not change`));
  // regen==="done" removes the button
  await page.getByRole("button", { name: /^regenerate/ }).waitFor({ state: "detached", timeout: 15_000 }).catch(() => console.log(`${tag}: regenerate button still present`));
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(800);
  const after = await count(page, "reveal_view");
  const urlAfter = page.url();
  const pBefore = new URL(urlBefore).searchParams.get("p"); const pAfter = new URL(urlAfter).searchParams.get("p");
  console.log(`${tag}: after regen reveal_view=${after} (delta ${after - before}) events=${JSON.stringify(await allEvents(page))}`);
  console.log(`${tag}: seed before=${pBefore ? dec(pBefore).seed : null} after=${pAfter ? dec(pAfter).seed : null}; console-log reveal mentions=${consoleReveal.length}`);
  const h1 = await page.evaluate(() => document.querySelector("main h1")?.textContent);
  console.log(`${tag}: h1="${h1}" printedAt="${await page.evaluate(() => document.body.innerText.match(/printed[^\n]*/i)?.[0] ?? "")}"`);
}

const browser = await chromium.launch();

// A: share-link open (no session) → solve → then regenerate
{
  const { ctx, page, consoleReveal } = await fresh(browser);
  await page.goto(`${BASE}/plan?p=${enc(base)}`, { waitUntil: "networkidle", timeout: 60_000 });
  if (await waitPlan(page, "A share-link")) { await page.waitForTimeout(600); await regenerateAndCount(page, "A share-link", consoleReveal); }
  await ctx.close();
}

// B: real path — quiz → solve → /plan (session + ?p=) → regenerate
{
  const { ctx, page, consoleReveal } = await fresh(browser);
  await page.goto(`${BASE}/start`, { waitUntil: "networkidle" });
  await page.fill("#budget", "60");
  for (let i = 0; i < 6; i++) {
    await page.getByRole("button", { name: /^(next|solve my week)$/ }).click();
    if (i < 5) await page.waitForURL(new RegExp(`step=${i + 2}`), { timeout: 10_000 });
  }
  await page.waitForURL(/\/plan\?p=/, { timeout: 60_000 });
  if (await waitPlan(page, "B quiz")) {
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(600);
    console.log(`B quiz: demo_complete=${await count(page, "demo_complete")}`);
    await regenerateAndCount(page, "B quiz", consoleReveal);
  }
  await ctx.close();
}
await browser.close();
