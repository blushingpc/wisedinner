// the loop's eyes and hands. run: node scripts/journey.ts [--base http://localhost:3077] [--out design/shots/iter-N]
// screenshots / at 390 + 1440, runs the full quiz ($55 / 150 g), asserts a feasible /plan receipt, shoots /plan /drop /pricing,
// clicks every nav + footer link (asserts 200), and drives the waitlist form against a MOCKED /api/waitlist
// (page.route) so no real row is ever written — the real API is exercised on prod, not by the loop.
import { chromium, type Page } from "playwright";
import { mkdirSync } from "node:fs";

const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(k);
  return i > -1 ? process.argv[i + 1] : d;
};
const BASE = arg("--base", "http://localhost:3077").replace(/\/$/, "");
const SMOKE = arg("--smoke", "https://wisedinner-git-design-v2-wise-dinner.vercel.app").replace(/\/$/, "");
const OUT = arg("--out", "design/shots/latest");
const TEST_EMAIL = "loop-test@wisedinner.com";
mkdirSync(OUT, { recursive: true });

const findings: string[] = [];
const fail = (msg: string) => {
  findings.push(`FAIL ${msg}`);
  console.error("  ✖", msg);
};
const ok = (msg: string) => console.log("  ✔", msg);

async function shot(page: Page, name: string, full = true) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  console.log("  📷", `${OUT}/${name}.png`);
}

async function quiz(page: Page, tag: string) {
  await page.goto(`${BASE}/start`);
  await page.fill("#budget", "55");
  await shot(page, `${tag}-quiz-01-budget`, false);
  await page.keyboard.press("Enter");
  await page.fill("#protein", "150");
  await shot(page, `${tag}-quiz-02-protein`, false);
  await page.keyboard.press("Enter");
  await shot(page, `${tag}-quiz-03-calories`, false);
  await page.keyboard.press("Enter");
  await shot(page, `${tag}-quiz-04-diet`, false);
  await page.keyboard.press("Enter");
  await shot(page, `${tag}-quiz-05-household`, false);
  await page.keyboard.press("Enter");
  await shot(page, `${tag}-quiz-06-pantry`, false);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/plan/, { timeout: 20_000 }).catch(() => fail(`${tag}: quiz did not reach /plan`));
  await page.waitForSelector("text=est. in-store total", { timeout: 10_000 }).catch(() => fail(`${tag}: /plan receipt did not render`));
  const infeasible = await page.locator("text=isn't solvable").count();
  if (infeasible) fail(`${tag}: /plan shows the infeasible state for $55 / 150 g`);
  else ok(`${tag}: /plan feasible receipt`);
  // the receipt total: the money span that follows the "est. in-store total" label
  const total = await page.locator("text=est. in-store total").locator("xpath=following-sibling::span[last()]").textContent().catch(() => null);
  ok(`${tag}: /plan total ${total}`);
  await shot(page, `${tag}-plan`);
}

async function links(page: Page) {
  await page.goto(`${BASE}/`);
  const hrefs = await page.locator("header a, footer a").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? ""));
  const seen = new Set<string>();
  for (const h of hrefs) {
    const path = h.split("#")[0] || "/";
    if (!path.startsWith("/") || seen.has(path)) continue;
    seen.add(path);
    const res = await page.request.get(`${BASE}${path}`);
    if (res.status() === 200) ok(`link ${path} → 200`);
    else fail(`link ${path} → ${res.status()}`);
  }
}

async function waitlist(page: Page) {
  // mocked end to end: the form's fetch is intercepted, so nothing lands in the real table
  await page.route("**/api/waitlist", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok", position: 42 }) }));
  await page.goto(`${BASE}/#early-access`);
  const input = page.locator("#email-hero");
  await input.fill(TEST_EMAIL);
  await input.press("Enter");
  await page.waitForURL(/\/thanks\?n=42/, { timeout: 10_000 }).catch(() => fail("waitlist submit did not reach /thanks"));
  const h1 = (await page.locator("h1").textContent().catch(() => "")) ?? "";
  if (h1.includes("you're in") && h1.includes("#42")) ok("waitlist (mocked) → /thanks renders position #42");
  else fail(`/thanks h1 unexpected: "${h1.trim()}"`);
  await page.unroute("**/api/waitlist");
}

// live smoke against the PREVIEW api: loop-test@wisedinner.com is seeded once, so every later run
// must get {status:"already"} — proves api + db path end to end with zero cleanup.
async function smoke() {
  try {
    const res = await fetch(`${SMOKE}/api/waitlist`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: TEST_EMAIL, source: "hero" }) });
    const body = await res.json().catch(() => ({}));
    if (res.status === 200 && body.status === "already") ok("smoke: preview api+db path live (already)");
    else if (res.status === 200 && body.status === "ok") ok(`smoke: seeded ${TEST_EMAIL} (first run) — every later run must return already`);
    else fail(`smoke: preview /api/waitlist → ${res.status} ${JSON.stringify(body)}`);
  } catch (e) {
    fail(`smoke: preview unreachable: ${(e as Error).message}`);
  }
}

const browser = await chromium.launch();
try {
  for (const [tag, viewport] of [["mobile", { width: 390, height: 844 }], ["desktop", { width: 1440, height: 900 }]] as const) {
    console.log(`\n== ${tag} ${viewport.width}×${viewport.height}`);
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.emulateMedia({ reducedMotion: "reduce" }); // reveals visible + count-up static, so fullPage shots show the real page
    page.on("pageerror", (e) => fail(`${tag}: page error ${e.message}`));
    await page.goto(`${BASE}/`);
    await shot(page, `${tag}-home`);
    await quiz(page, tag);
    for (const p of ["drop", "pricing"]) {
      await page.goto(`${BASE}/${p}`);
      await shot(page, `${tag}-${p}`);
    }
    if (tag === "desktop") {
      await links(page);
      await waitlist(page);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
await smoke();
console.log(`\n${findings.length ? findings.join("\n") : "journey: all checks passed"}`);
process.exit(findings.some((f) => f.startsWith("FAIL")) ? 1 : 0);
