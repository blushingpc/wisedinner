// FRONTEND-V4.1 §7 verification: shots at 390×844 and 1440×900 (hero, the modal, the switcher, pricing, the band),
// the modal keyboard pass (Tab wrap, Esc, focus return, backdrop click) and the arrow pass. run with a server up:
// node scripts/verify-v4-1.ts [--base http://localhost:3077]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(k);
  return i > -1 ? process.argv[i + 1] : d;
};
const BASE = arg("--base", "http://localhost:3077").replace(/\/$/, "");
const OUT = "design/shots/v4-1";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const report: Record<string, unknown> = {};

for (const [name, vp, dpr, mobile] of [
  ["390", { width: 390, height: 844 }, 2, true],
  ["1440", { width: 1440, height: 900 }, 1, false],
] as const) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/${name}-hero.png` });

  // modal: open from the hero, shoot, keyboard pass
  const hero = page.locator('button[data-placement="hero"]');
  await hero.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}-modal.png` });
  const state = () =>
    page.evaluate(() => {
      const d = document.querySelector("dialog.preorder-dialog") as HTMLDialogElement;
      const a = document.activeElement as HTMLElement;
      const r = d.getBoundingClientRect();
      return { open: d.open, inside: d.contains(a), active: a.getAttribute("aria-label") || a.getAttribute("data-placement") || a.textContent?.trim().slice(0, 24), dialogBottomGap: Math.round(window.innerHeight - r.bottom), dialogTop: Math.round(r.top) };
    });
  const seq: unknown[] = [await state()];
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    seq.push(await state());
  }
  await page.keyboard.press("Shift+Tab");
  seq.push(await state());
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  seq.push(await state());
  // backdrop click: reopen, click the dialog's own top-left corner (outside the panel on desktop; on the sheet the
  // area above the panel is the dialog's fixed box, so click at y=5)
  await hero.click();
  await page.waitForTimeout(300);
  await page.mouse.click(5, 5);
  await page.waitForTimeout(100);
  seq.push({ afterBackdropClick: (await state()).open });
  report[`${name}-modal`] = seq;

  // switcher
  await page.locator("#how").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.locator("#how").screenshot({ path: `${OUT}/${name}-switcher.png` });
  const active = () => page.evaluate(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim().slice(0, 24));
  const arrows = { start: await active() } as Record<string, unknown>;
  await page.locator('button[aria-label="Next screen"]').click();
  await page.waitForTimeout(300);
  arrows.next = await active();
  await page.locator('button[aria-label="Previous screen"]').focus();
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(300);
  arrows.arrowLeftKey = await active();
  await page.waitForTimeout(5500);
  arrows.after5s = await active();
  report[`${name}-arrows`] = arrows;

  // pricing + band
  await page.locator("#pricing").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.locator("#pricing").screenshot({ path: `${OUT}/${name}-pricing.png` });
  await page.locator("#preorder").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.locator("#preorder").screenshot({ path: `${OUT}/${name}-band.png` });
  // focus rings: every focusable gets a visible outline
  const rings = await page.evaluate(() => {
    const els = [...document.querySelectorAll<HTMLElement>("a[href], button, [tabindex='0']")].filter((e) => e.offsetParent !== null);
    let bad = 0;
    for (const e of els) {
      e.focus();
      const cs = getComputedStyle(e);
      if (!e.matches(":focus-visible") || cs.outlineStyle === "none" || parseFloat(cs.outlineWidth) < 1) bad++;
    }
    return { focusables: els.length, withoutRing: bad };
  });
  report[`${name}-rings`] = rings;
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(report, null, 1));
