import { chromium } from "playwright";

const BASE = "http://localhost:3077";
const P = "eyJidWRnZXQiOjYwLCJzcGVuZCI6IiIsInByb3RlaW4iOjE1MCwiYmFuZCI6MSwiZGlldCI6Im5vbmUiLCJob3VzZWhvbGQiOjEsInBhbnRyeSI6W119";

const GETTER_THROWS = `Object.defineProperty(window, "sessionStorage", { configurable: true, get() { throw new DOMException("Failed to read the 'sessionStorage' property from 'Window': Access is denied for this document.", "SecurityError"); } });`;
const SETITEM_THROWS = `(() => { const s = window.sessionStorage; const orig = s.setItem.bind(s); Object.defineProperty(Storage.prototype, "setItem", { configurable: true, value() { throw new DOMException("QuotaExceededError", "QuotaExceededError"); } }); })();`;

async function probe(label: string, init?: string) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const posts: { url: string; status: number }[] = [];
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("response", (r) => { if (r.request().method() === "POST") posts.push({ url: new URL(r.url()).pathname, status: r.status() }); });
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
  await page.goto(`${BASE}/plan?p=${P}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const out = await page.evaluate(() => ({
    url: location.pathname + location.search.slice(0, 40),
    h1: [...document.querySelectorAll("main h1")].map((h) => h.textContent),
    p: document.querySelector("main p")?.textContent?.slice(0, 120) ?? null,
    hasReceipt: !!document.body.textContent?.includes("est. in-store"),
  }));
  console.log(`\n== ${label} ==`);
  console.log(JSON.stringify({ ...out, posts, pageErrors, consoleErrors }, null, 1));
  await browser.close();
}

await probe("control (storage works)");
await probe("sessionStorage getter throws SecurityError (Chrome 'block all cookies')", GETTER_THROWS);
await probe("setItem throws QuotaExceededError (getter fine)", SETITEM_THROWS);
