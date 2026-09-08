// HERO CUT-OUTS (REDESIGN-V4 §5D): the chicken burrito bowl and the Greek yogurt parfait, generated on white,
// upscaled to 4K, background removed at 4K (public/img/src/cutouts-4k/<id>.png, gitignored) → trimmed to the subject
// and exported as transparent PNG at 3x of the rendered width (300px on desktop → 900px), plus WebP and AVIF.
// run: node scripts/gen-cutouts.ts
import sharp from "sharp";

const CUTOUTS: [string, string][] = [
  ["chicken-burrito-bowl", "burrito-bowl"],
  ["greek-yogurt-parfait-with-berries-and-granola", "parfait"],
];
const WIDTH = 900; // 300px rendered × 3

for (const [id, name] of CUTOUTS) {
  const trimmed = await sharp(`public/img/src/cutouts-4k/${id}.png`).trim().toBuffer();
  const base = sharp(trimmed).resize({ width: WIDTH, fit: "inside", withoutEnlargement: true });
  await base.clone().png({ compressionLevel: 9, palette: false }).toFile(`public/img/cutout-${name}.png`);
  await base.clone().webp({ quality: 88, alphaQuality: 95 }).toFile(`public/img/cutout-${name}.webp`);
  await base.clone().avif({ quality: 70 }).toFile(`public/img/cutout-${name}.avif`);
  const m = await sharp(`public/img/cutout-${name}.png`).metadata();
  console.log(name, m.width, m.height);
}
