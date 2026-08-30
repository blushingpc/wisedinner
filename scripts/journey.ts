// the loop's eyes and hands. run: node scripts/journey.ts [--base http://localhost:3077] [--out design/shots/iter-N]
// screenshots / at 390 + 1440, runs the full quiz ($55 / 150 g), asserts a feasible /plan receipt, shoots /plan /drop /pricing,
// clicks every nav + footer link (asserts 200), joins the waitlist once as loop-test@wisedinner.com and deletes that row.
import { chromium, type Page } from "playwright";
import { mkdirSync, readFileSync, existsSync } from "node:fs";

const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(k);
  return i > -1 ? process.argv[i + 1] : d;
};
const BASE = arg("--base", "http://localhost:3077").replace(/\/$/, "");
const OUT = arg("--out", "design/shots/latest");
const TEST_EMAIL = "loop-test@wisedinner.com";
mkdirSync(OUT, { recursive: true });

// .env.local is gitignored; the service key only ever lives there or in vercel
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

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
  const total = await page.locator("text=/^\\$\\d+\\.\\d{2}$/").first().textContent().catch(() => null);
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
  const res = await page.request.post(`${BASE}/api/waitlist`, { data: { email: TEST_EMAIL, source: "hero" } });
  const body = await res.json().catch(() => ({}));
  if (res.status() === 200 && (body.status === "ok" || body.status === "already")) ok(`waitlist ${body.status} (position ${body.position ?? "-"})`);
  else fail(`waitlist → ${res.status()} ${JSON.stringify(body)}`);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    findings.push(`NOTE waitlist row ${TEST_EMAIL} NOT deleted — no service key in .env.local`);
    return;
  }
  const del = await fetch(`${url}/rest/v1/waitlist?email=eq.${encodeURIComponent(TEST_EMAIL)}`, { method: "DELETE", headers: { apikey: key, authorization: `Bearer ${key}` } });
  if (del.ok) ok(`waitlist row ${TEST_EMAIL} deleted`);
  else fail(`could not delete test row: ${del.status}`);
}

const browser = await chromium.launch();
try {
  for (const [tag, viewport] of [["mobile", { width: 390, height: 844 }], ["desktop", { width: 1440, height: 900 }]] as const) {
    console.log(`\n== ${tag} ${viewport.width}×${viewport.height}`);
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
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
console.log(`\n${findings.length ? findings.join("\n") : "journey: all checks passed"}`);
process.exit(findings.some((f) => f.startsWith("FAIL")) ? 1 : 0);
