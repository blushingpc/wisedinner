// COMPARE COMPOSITE (REDESIGN-V4 §9): our hero, header and switcher beside the calai captures → docs/reference/compare-v4.png
// inputs: docs/reference/calai/landing-1440x900-fold.png, landing-390x844-fold.png and our design/shots/v4 captures.
// run after the verification shots exist: node scripts/compare.ts
import sharp from "sharp";

const W = 1440;
const rows: [string, string, string][] = [
  ["calai.app, 1440 fold", "docs/reference/calai/landing-1440x900-fold.png", "design/shots/v4/16-desktop-fold.png"],
  ["calai.app, 390 fold", "docs/reference/calai/landing-390x844-fold.png", "design/shots/v4/16-mobile-fold.png"],
  ["switcher", "docs/reference/calai/landing-1440x900-full.jpg", "design/shots/v4/16-desktop-switcher.png"],
];

const label = (text: string, w: number) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="40"><rect width="100%" height="100%" fill="#111111"/><text x="16" y="27" font-family="Arial, sans-serif" font-size="20" fill="#ffffff">${text}</text></svg>`);

const tiles: { input: Buffer; top: number; left: number }[] = [];
let y = 0;
for (const [name, ref, ours] of rows) {
  const half = Math.floor(W / 2);
  const fit = { width: half, height: 720, fit: "contain" as const, position: "top" as const, background: "#ffffff" };
  const left = await sharp(ref).resize(fit).png().toBuffer();
  const right = await sharp(ours).resize(fit).png().toBuffer();
  tiles.push({ input: label(`${name} (reference)`, half), top: y, left: 0 }, { input: label("WiseDinner v4", half), top: y, left: half });
  tiles.push({ input: left, top: y + 40, left: 0 }, { input: right, top: y + 40, left: half });
  y += 760 + 16;
}
await sharp({ create: { width: W, height: y, channels: 3, background: "#ffffff" } })
  .composite(tiles)
  .png({ compressionLevel: 9 })
  .toFile("docs/reference/compare-v4.png");
console.log("wrote docs/reference/compare-v4.png", W, y);
