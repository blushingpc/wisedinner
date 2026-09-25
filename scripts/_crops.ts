// element screenshots of every surface that carries a showcase number, at 390 (iOS, DPR 2) and 1440 (DPR 1), plus the
// runtime OG images. not committed. node scripts/_crops.ts [--base http://localhost:3078]
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const i = process.argv.indexOf("--base");
const BASE = (i > -1 ? process.argv[i + 1] : "http://localhost:3078").replace(/\/$/, "");
const OUT = "design/shots/real-numbers/crops";
mkdirSync(OUT, { recursive: true });
const IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const SHOTS: [string, string, string][] = [
  ["/", "main > section:first-of-type", "home-hero"],
  ["/", "#preorder", "home-band"],
  ["/", "#how", "home-switcher"],
  ["/drop", "main section", "drop"],
  ["/the-math", "main section", "the-math"],
  ["/pricing", "main section", "pricing"],
  ["/w/example", "main section > div > div:nth-child(-n+3)", "share-1-top"],
  ["/w/example-2", "main section > div > div:nth-child(-n+3)", "share-2-top"],
];

const b = await chromium.launch();
for (const [w, h, dpr, mobile] of [[390, 844, 2, true], [1440, 900, 1, false]] as const) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce", ...(mobile ? { userAgent: IOS } : {}) });
  const p = await ctx.newPage();
  for (const [route, sel, name] of SHOTS) {
    await p.goto(BASE + route, { waitUntil: "load" });
    await p.waitForTimeout(600);
    const el = p.locator(sel).first();
    await el.scrollIntoViewIfNeeded();
    await p.waitForTimeout(400);
    // share pages: shoot the header block through the card (the first three children)
    if (name.startsWith("share")) {
      const box = await p.evaluate(() => {
        const wrap = document.querySelector("main section > div")!;
        const kids = [...wrap.children].slice(0, 3);
        const top = kids[0].getBoundingClientRect().top + scrollY;
        const bottom = kids[kids.length - 1].getBoundingClientRect().bottom + scrollY;
        const r = wrap.getBoundingClientRect();
        return { x: r.left, y: top, width: r.width, height: bottom - top };
      });
      await p.evaluate((y) => scrollTo(0, y - 20), box.y);
      await p.waitForTimeout(300);
      const y = await p.evaluate(() => scrollY);
      await p.screenshot({ path: `${OUT}/${name}__${w}.png`, clip: { x: box.x, y: box.y - y, width: box.width, height: Math.min(box.height, h) } });
    } else {
      await el.screenshot({ path: `${OUT}/${name}__${w}.png` });
    }
  }
  await ctx.close();
}
// runtime OG images
const ctx = await b.newContext();
for (const [path, name] of [["/w/example/og", "og-share-1"], ["/w/example-2/og", "og-share-2"], ["/og?page=drop", "og-drop"]]) {
  const res = await ctx.request.get(BASE + path);
  writeFileSync(`${OUT}/${name}.png`, await res.body());
}
await b.close();
console.log("crops written to", OUT);
