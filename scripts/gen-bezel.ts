// BEZEL EXPORT (hero LCP): the iPhone 17 Black bezel (public/img/bezel/iphone-17-black.png, 1350×2760, alpha) as a
// static AVIF + WebP ladder at every width a DeviceFrame renders, at 1x, 2x and 3x, so the hero phone is one exact
// static file with fetchpriority=high instead of an on-demand next/image transform. run: node scripts/gen-bezel.ts
// widths (SITE-V5 §2) measured at 360, 390, 430, 768, 1024 and 1440: hero right phone (193, 212, 237, 298, 250),
// hero left phone (181, 198, 222, 278, 234), switcher (260, 340), default frame (300), og card (320), store shots (1000). change RENDERED and the WIDTHS list in app/ui/device-frame.tsx together.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const SRC = "public/img/bezel/iphone-17-black.png";
const OUT = "public/img/bezel";
export const RENDERED = [181, 193, 198, 212, 222, 234, 237, 250, 260, 278, 298, 300, 320, 340, 1000];
const widths = [...new Set(RENDERED.flatMap((w) => [w, w * 2, w * 3]))].filter((w) => w <= 1350).sort((a, b) => a - b);

mkdirSync(OUT, { recursive: true });
for (const w of widths) {
  const base = sharp(SRC).resize({ width: w });
  await base.clone().avif({ quality: 60, effort: 6 }).toFile(`${OUT}/iphone-17-black-${w}.avif`);
  await base.clone().webp({ quality: 82, alphaQuality: 90 }).toFile(`${OUT}/iphone-17-black-${w}.webp`);
}
console.log("bezel widths:", widths.join(" "));
