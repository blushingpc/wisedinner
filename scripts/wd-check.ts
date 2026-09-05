// remediation-spec acceptance probe (docs/REMEDIATION-2026-09-02.md §9). run: node scripts/wd-check.ts [--base http://localhost:3077] [--phase 1|2|3]
// prints measured values; exits 1 on any FAIL so it can gate a phase. --phase N runs phases 1..N (default: all).
import { chromium, type Page } from "playwright";

const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(k);
  return i > -1 ? process.argv[i + 1] : d;
};
const BASE = arg("--base", "http://localhost:3077").replace(/\/$/, "");
const PHASE = Number(arg("--phase", "9"));
const ROUTES = ["/", "/start", "/plan", "/pricing", "/faq", "/the-math", "/drop", "/about", "/press", "/support", "/terms", "/privacy"];

let fails = 0;
const fail = (m: string) => {
  fails++;
  console.log("  ✖", m);
};
const ok = (m: string) => console.log("  ✔", m);
const check = (cond: boolean, msg: string) => (cond ? ok(msg) : fail(msg));

const browser = await chromium.launch();
const errors: string[] = [];
const placements = new Set<string>(); // every data-placement value seen anywhere — all six must survive (WD-01)
const watch = (page: Page, tag: string) => {
  page.on("pageerror", (e) => errors.push(`${tag} pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${tag} console: ${m.text().slice(0, 160)}`));
};

// ---------- phase 1 ----------

// WD-01 — no fragment link points at an id that does not exist on its page; data-placement values preserved
{
  const page = await browser.newPage();
  for (const r of ROUTES) {
    await page.goto(`${BASE}${r}`, { waitUntil: "domcontentloaded" });
    const dead = await page.locator('a[href^="#"]').evaluateAll((els) =>
      els.map((e) => e.getAttribute("href") ?? "").filter((h) => h.length > 1 && !document.getElementById(h.slice(1))),
    );
    const p = await page.locator("[data-placement]").evaluateAll((els) => els.map((e) => e.getAttribute("data-placement")));
    p.forEach((x) => x && placements.add(x));
    check(dead.length === 0, `WD-01 ${r}: ${dead.length} dead fragment links${dead.length ? ` (${[...new Set(dead)].join(", ")})` : ""}`);
  }
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
  check(bad === 0, `WD-02 ${width}px: header clickable at every step (reduced motion)${bad ? ` — ${bad} covered` : ""}`);
  await page.close();
}

// WD-03 — mobile sticky bar: hidden at top, visible after the hero CTA leaves, never covering the final CTA
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const state = async (y: number) => {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(450);
    return page.evaluate(() => {
      const d = document.querySelector('a[data-placement="sticky"]')!.parentElement!;
      const r = d.getBoundingClientRect();
      const finalCta = document.querySelector('[data-placement="final"]')?.getBoundingClientRect();
      const lastP = [...document.querySelectorAll("footer p")].at(-1)?.getBoundingClientRect();
      return { y: window.scrollY, top: Math.round(r.top), visible: r.top < window.innerHeight, overlapsFinal: !!finalCta && finalCta.bottom > r.top && finalCta.top < r.bottom, overlapsFooterText: !!lastP && lastP.bottom > r.top };
    });
  };
  const docH = await page.evaluate(() => document.documentElement.scrollHeight);
  const heroCtaBottom = await page.evaluate(() => (document.querySelector('[data-placement="hero"]') as HTMLElement).getBoundingClientRect().bottom + window.scrollY);
  const s0 = await state(0);
  check(!s0.visible, `WD-03 bar hidden at scrollY 0 (top=${s0.top})`);
  const sAfter = await state(Math.round(heroCtaBottom + 200));
  check(sAfter.visible, `WD-03 bar visible once the hero CTA is gone (scrollY ${sAfter.y}, hero CTA bottom ${Math.round(heroCtaBottom)})`);
  const sEnd = await state(docH);
  check(sEnd.visible && !sEnd.overlapsFinal && !sEnd.overlapsFooterText, `WD-03 bar at page bottom: visible=${sEnd.visible} overlapsFinalCta=${sEnd.overlapsFinal} overlapsFooterText=${sEnd.overlapsFooterText}`);
  await page.close();
}

// ---------- phase 2 ----------
const nextBtn = (page: Page) => page.getByRole("button", { name: "next", exact: true }).click();

if (PHASE >= 2) {
  const heads = (page: Page) =>
    page.evaluate(() => ({
      h1: [...document.querySelectorAll("h1")].map((h) => h.textContent ?? ""),
      h2: [...document.querySelectorAll("main h2")].map((h) => h.textContent ?? ""),
      pb: document.querySelector('[role="progressbar"]')?.getAttribute("aria-label") ?? "",
      url: location.pathname + location.search,
    }));
  const card = (page: Page) => page.evaluate(() => [...document.querySelectorAll("main dd")].slice(0, 3).map((d) => d.textContent ?? ""));

  // WD-04 + WD-05 — headings + progressbar per step, history walks the demo, reload + forward-jump guard
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  watch(page, "/start");
  await page.goto(`${BASE}/start`, { waitUntil: "networkidle" });
  let h = await heads(page);
  check(h.h1.length === 1 && h.h2.length === 1 && h.pb === "Step 1 of 6", `WD-04 step 1: h1=${h.h1.length} h2="${h.h2[0]}" progressbar="${h.pb}"`);
  await page.fill("#budget", "60");
  await nextBtn(page);
  await page.waitForURL(/step=2/);
  await page.fill("#protein", "150");
  await nextBtn(page);
  await page.waitForURL(/step=3/);
  await nextBtn(page);
  await page.waitForURL(/step=4/);
  await page.waitForTimeout(150);
  h = await heads(page);
  check(h.h1.length === 1 && h.h2[0] === "diet" && h.pb === "Step 4 of 6", `WD-04 step 4: h2="${h.h2[0]}" progressbar="${h.pb}"`);
  const focused = await page.evaluate(() => document.activeElement?.tagName);
  check(focused === "H2", `WD-04 focus lands on the step heading after a step change (active=${focused})`);
  await page.goBack();
  await page.goBack();
  await page.goBack();
  await page.waitForTimeout(300);
  h = await heads(page);
  const budget = await page.inputValue("#budget");
  check(h.pb === "Step 1 of 6" && /\/start/.test(h.url) && budget === "60", `WD-05 three browser backs → step 1 inside the demo with answers intact (url=${h.url}, budget=${budget})`);
  await page.goto(`${BASE}/start?step=3`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  h = await heads(page);
  check(h.pb === "Step 3 of 6", `WD-05 reload at ?step=3 stays on step 3 (got "${h.pb}")`);
  await page.goto(`${BASE}/start?step=6`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  h = await heads(page);
  check(h.pb === "Step 4 of 6", `WD-05 forward jump to ?step=6 lands on the first unvisited step (got "${h.pb}")`);
  // finish the quiz → shareable /plan
  await nextBtn(page);
  await page.waitForURL(/step=5/);
  await nextBtn(page);
  await page.waitForURL(/step=6/);
  await page.getByRole("button", { name: "solve my week", exact: true }).click();
  await page.waitForURL(/\/plan\?p=/, { timeout: 20_000 });
  await page.waitForSelector("text=est. in-store total", { timeout: 15_000 });
  const planUrl = page.url();
  const c1 = await card(page);
  check(c1[0] === "$40.24 under $60" && c1[1] === "152 g / day", `solver regression: ${c1.join(" · ")} (expect $40.24 / 152 g)`);
  const items = await page.evaluate(() => document.querySelector("main h1 + p")?.textContent ?? "");
  check(/^12 items/.test(items), `solver regression: "${items.slice(0, 40)}" (expect 12 items)`);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("text=est. in-store total");
  check((await card(page))[0] === c1[0], "WD-06 /plan survives a reload");

  // WD-06 — the link renders the same plan in a fresh context; cold /plan and a garbage ?p= show written states
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const fresh = await ctx2.newPage();
  watch(fresh, "/plan(fresh)");
  await fresh.goto(planUrl, { waitUntil: "networkidle" });
  await fresh.waitForSelector("text=est. in-store total", { timeout: 15_000 }).catch(() => {});
  (await fresh.locator("[data-placement]").evaluateAll((els) => els.map((e) => e.getAttribute("data-placement") ?? ""))).forEach((x) => placements.add(x));
  const c2 = await card(fresh);
  check(c2[0] === c1[0] && c2[1] === c1[1], `WD-06 shared link in a fresh context renders the same plan (${c2.join(" · ")})`);
  const ctx3 = await browser.newContext({ viewport: { width: 1440, height: 900 } }); // nothing cached in here
  const cold0 = await ctx3.newPage();
  watch(cold0, "/plan(cold)");
  await cold0.goto(`${BASE}/plan`, { waitUntil: "networkidle" });
  await cold0.waitForTimeout(600);
  const cold = await cold0.evaluate(() => ({ url: location.pathname, h1: document.querySelector("main h1")?.textContent ?? "", cta: [...document.querySelectorAll("main a.cta")].map((a) => a.textContent).join("|") }));
  check(cold.url === "/plan" && cold.h1 === "that plan’s gone." && /solve my week/.test(cold.cta), `WD-06 cold /plan shows the empty state, no redirect (url=${cold.url}, h1="${cold.h1}")`);
  await cold0.goto(`${BASE}/plan?p=not-a-plan`, { waitUntil: "networkidle" });
  await cold0.waitForTimeout(600);
  check((await cold0.evaluate(() => document.querySelector("main h1")?.textContent)) === "that plan’s gone.", "WD-06 garbage ?p= falls through to the empty state");

  // WD-11 — 404 title
  const r404 = await fresh.goto(`${BASE}/this-aisle-does-not-exist`);
  const robots = await fresh.evaluate(() => [...document.querySelectorAll('meta[name="robots"]')].map((m) => m.getAttribute("content")).join("|"));
  check(r404?.status() === 404 && (await fresh.title()) === "Page not found — WiseDinner" && /noindex/.test(robots), `WD-11 404: status=${r404?.status()} title="${await fresh.title()}" robots=${robots}`);

  // WD-07 — real QR, caption + short URL, /ios redirect
  await fresh.goto(`${BASE}/`, { waitUntil: "networkidle" });
  // the QR renders only while the listing is live (funnel decision 2026-09-05) — infer the state from the header CTA
  const qr = await fresh.evaluate(() => {
    const i = document.querySelector('img[src*="qr-"]') as HTMLImageElement | null;
    const live = /pre-order/i.test(document.querySelector('[data-placement="header"]')?.textContent ?? "");
    return { live, src: i?.getAttribute("src") ?? "", alt: i?.alt ?? "", caption: i?.parentElement?.textContent ?? "" };
  });
  if (qr.live) check(/qr-ios\.svg/.test(qr.src) && qr.alt.startsWith("QR code") && /wisedinner\.com\/ios/.test(qr.caption), `WD-07 QR: src=${qr.src} alt="${qr.alt}" caption="${qr.caption}"`);
  else check(qr.src === "", `WD-07 QR absent while the listing is not live (src=${qr.src})`);
  const ios = await fetch(`${BASE}/ios`, { redirect: "manual" });
  check([302, 307].includes(ios.status) && !!ios.headers.get("location"), `WD-07 /ios → ${ios.status} ${ios.headers.get("location")}`);

  // WD-08 + WD-09 + WD-10 — header links reachable at 320/390, opaque chrome, walkthrough copy once, no 0×0 images
  for (const w of [320, 390, 1440]) {
    const c = await browser.newContext({ viewport: { width: w, height: 844 } });
    const pg = await c.newPage();
    watch(pg, `/@${w}`);
    const a2: string[] = [];
    pg.on("request", (rq) => /A2/.test(rq.url()) && a2.push(decodeURIComponent(rq.url()).replace(/.*url=/, "").replace(/&.*/, "")));
    await pg.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const info = await pg.evaluate(() => {
      const links = [...document.querySelectorAll("header nav ul a")];
      const inView = links.filter((a) => {
        const r = a.getBoundingClientRect();
        return r.width > 0 && r.right <= innerWidth && r.bottom <= innerHeight;
      }).length;
      const hdr = document.querySelector("header")!;
      const h3s = [...document.querySelectorAll("#how h3")].map((x) => x.textContent);
      const zero = [...document.querySelectorAll("img")].filter((i) => i.currentSrc && i.getBoundingClientRect().width === 0).map((i) => i.alt.slice(0, 30) || i.currentSrc.slice(-30));
      return { links: links.length, inView, headerH: Math.round(hdr.getBoundingClientRect().height), bg: getComputedStyle(hdr).backgroundColor, overflow: document.documentElement.scrollWidth > innerWidth, h3s, zero, olTab: document.querySelector("#how ol")?.getAttribute("tabindex") };
    });
    if (w < 768) check(info.links === 3 && info.inView === 3 && !info.overflow, `WD-08 ${w}px: ${info.inView}/${info.links} header links reachable without scrolling, header ${info.headerH}px, overflow=${info.overflow}`);
    check(!/rgba\(/.test(info.bg) || /, 1\)$/.test(info.bg), `WD-09 ${w}px: header background opaque (${info.bg})`);
    check(info.h3s.length === 3 && new Set(info.h3s).size === 3, `WD-10 ${w}px: each how-it-works heading once (${info.h3s.length} h3)`);
    check(info.zero.length === 0, `WD-10 ${w}px: no image rendered at 0×0${info.zero.length ? ` (${info.zero.join(", ")})` : ""}`);
    const a2set = [...new Set(a2)];
    check(a2set.length === 1 && (w < 640 ? /A2-mobile/.test(a2set[0]) : !/mobile/.test(a2set[0])), `WD-10 ${w}px: one S2 source fetched (${a2set.join(", ")})`);
    check(w < 1024 ? info.olTab === "0" : info.olTab === null, `WD-10 ${w}px: carousel tabindex only while it scrolls (tabindex=${info.olTab})`);
    await c.close();
  }
  await ctx.close();
  await ctx2.close();
  await ctx3.close();
}

// ---------- phase 3 ----------
if (PHASE >= 3) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  watch(page, "phase3");
  // WD-17 + WD-20 + WD-18 — every route: description length, theme-color, alt="" only on dish-drift
  for (const r of ROUTES) {
    await page.goto(`${BASE}${r}`, { waitUntil: "domcontentloaded" });
    const m = await page.evaluate(() => ({
      desc: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
      theme: document.querySelector('meta[name="theme-color"]')?.getAttribute("content") ?? "",
      emptyAlt: [...document.querySelectorAll("img")].filter((i) => i.getAttribute("alt") === "" && !i.classList.contains("dish-drift") && i.getAttribute("aria-hidden") !== "true").map((i) => i.getAttribute("src")?.slice(0, 40) ?? "?"),
    }));
    if (r !== "/plan") check(m.desc.length >= 120 && m.desc.length <= 155, `WD-17 ${r}: description ${m.desc.length} chars`);
    check(m.theme.toLowerCase() === "#fbfaf6", `WD-20 ${r}: theme-color ${m.theme}`);
    check(m.emptyAlt.length === 0, `WD-18 ${r}: alt="" only on dish-drift${m.emptyAlt.length ? ` (${m.emptyAlt.join(", ")})` : ""}`);
  }
  // WD-15 + WD-16 — structured data
  const ld = async (r: string) => {
    await page.goto(`${BASE}${r}`, { waitUntil: "domcontentloaded" });
    return page.evaluate(() => [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent ?? "{}")));
  };
  const home = await ld("/");
  const types = home.map((x) => x["@type"]);
  const app = home.find((x) => x["@type"] === "SoftwareApplication");
  check(types.includes("Organization") && types.includes("FAQPage") && !!app, `WD-15/16 homepage JSON-LD types: ${types.join(", ")}`);
  check(!!app && app.applicationCategory === "LifestyleApplication" && app.operatingSystem === "iOS" && Array.isArray(app.offers) && app.offers.length >= 2 && !("aggregateRating" in app), `WD-16 SoftwareApplication: ${app?.offers?.length ?? 0} offers, aggregateRating=${app ? "aggregateRating" in app : "n/a"}`);
  const homeFaq = home.find((x) => x["@type"] === "FAQPage");
  check(homeFaq?.mainEntity?.length === 4, `WD-15 homepage FAQPage has ${homeFaq?.mainEntity?.length ?? 0} questions (expect 4)`);
  const pricing = await ld("/pricing");
  const product = pricing.find((x) => x["@type"] === "Product");
  const pageText = await page.evaluate(() => document.body.innerText);
  const pricesOnPage = product?.offers?.every((o: { price: string }) => pageText.includes("$" + o.price.replace(/\.00$/, "")));
  check(!!product && product.offers?.length === 4 && pricesOnPage === true, `WD-16 /pricing Product with ${product?.offers?.length ?? 0} offers, every price visible on the page: ${pricesOnPage}`);
  const faq = await ld("/faq");
  check(faq.some((x) => x["@type"] === "FAQPage" && x.mainEntity?.length >= 8), "WD-15 /faq still ships FAQPage");
  // WD-13 — focus ring: a solid ≥2px ring in ink on every ground, paper inside the kale room; also the tiles on /start 5–6
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const ringOf = (sel: string) =>
    page.evaluate((s) => {
      const el = document.querySelector(s) as HTMLElement | null;
      if (!el) return `${s}: missing`;
      el.focus();
      const ring = el.closest("label") ?? el; // sr-only inputs show the ring on their tile
      const cs = getComputedStyle(ring);
      const ink = getComputedStyle(document.body).color;
      const paper = getComputedStyle(document.body).backgroundColor;
      const want = el.closest(".bg-kale") ? paper : ink;
      const okRing = el.matches(":focus-visible") && cs.outlineStyle === "solid" && parseFloat(cs.outlineWidth) >= 2 && cs.outlineColor === want;
      el.blur();
      return `${s}: ${okRing ? "ok" : `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor} (want ${want})`}`;
    }, sel);
  const rings: string[] = [];
  for (const s of ['header a[data-placement="header"]', '[data-placement="final"]', 'a[href="/the-math"]', "footer a", '#early-access input[type="email"]']) rings.push(await ringOf(s));
  await page.goto(`${BASE}/start`, { waitUntil: "networkidle" });
  for (let i = 0; i < 4; i++) {
    await nextBtn(page);
    await page.waitForURL(new RegExp(`step=${i + 2}`));
  }
  // a radio only becomes :focus-visible through the keyboard, so Tab from the step heading onto the first tile
  await page.keyboard.press("Tab");
  rings.push(
    await page.evaluate(() => {
      const a = document.activeElement as HTMLElement;
      const cs = getComputedStyle(a.closest("label") ?? a);
      const okTile = a.getAttribute("name") === "household" && cs.outlineStyle === "solid" && parseFloat(cs.outlineWidth) >= 2 && cs.outlineColor === getComputedStyle(document.body).color;
      return `/start step 5 tile: ${okTile ? "ok" : `${a.tagName}[${a.getAttribute("name")}] ${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`}`;
    }),
  );
  check(rings.every((r) => /: ok$/.test(r)), `WD-13 focus rings: ${rings.join(" | ")}`);
  // WD-12 — the wide S2 band shows its whole source (≤2% discarded); the phone crop too
  for (const w of [1440, 390]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const band = await page.evaluate(() => {
      const img = document.querySelector("#week img") as HTMLImageElement;
      const r = img.getBoundingClientRect();
      const natural = img.naturalWidth / img.naturalHeight;
      const rendered = r.width / r.height;
      return { natural: +natural.toFixed(3), rendered: +rendered.toFixed(3), discarded: +Math.abs(1 - Math.min(natural, rendered) / Math.max(natural, rendered)).toFixed(3), src: img.currentSrc.replace(/.*url=/, "").replace(/&.*/, "") };
    });
    check(band.discarded <= 0.02, `WD-12 ${w}px S2 band: source ${band.natural} rendered ${band.rendered} → ${(band.discarded * 100).toFixed(1)}% discarded (${decodeURIComponent(band.src)})`);
  }
  // WD-14 — carousel dots are buttons with 44px targets, aria-current, and they move the carousel
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/#how`, { waitUntil: "networkidle" });
  const dots = await page.evaluate(() => [...document.querySelectorAll('#how button[aria-label^="go to step"]')].map((b) => ({ w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height, cur: b.getAttribute("aria-current") })));
  check(dots.length === 3 && dots.every((d) => d.w >= 44 && d.h >= 44) && dots[0].cur === "true", `WD-14 dots: ${dots.length} buttons, sizes ${dots.map((d) => `${Math.round(d.w)}×${Math.round(d.h)}`).join(" ")}, aria-current on first=${dots[0]?.cur}`);
  await page.locator('#how button[aria-label^="go to step 3"]').click();
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => [...document.querySelectorAll('#how button[aria-label^="go to step"]')].map((b) => b.getAttribute("aria-current")));
  check(after[2] === "true", `WD-14 tapping dot 3 moves the carousel (aria-current now on ${after.indexOf("true") + 1})`);
  await page.close();
}

const EXPECTED = ["final", "header", "hero", "plan", "sticky", "the-math"];
check(EXPECTED.every((x) => placements.has(x)), `WD-01 data-placement values preserved: ${[...placements].sort().join(", ")}`);
const real = errors.filter((e) => !/status of 404/.test(e)); // the 404 probe's own document request
check(real.length === 0, `console clean${real.length ? `: ${real.join(" | ")}` : ""}`);
await browser.close();
console.log(fails ? `\n${fails} FAIL` : "\nall checks pass");
process.exit(fails ? 1 : 0);
