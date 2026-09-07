// hero cut-outs (REDESIGN-V3 §2I): transparent masters in public/img/src/cutouts/<name>.png (2K, gitignored) →
// public/img/cutout-<name>.{png,webp,avif}, trimmed to the subject, longest side 1600. run: node scripts/gen-cutouts.ts
import sharp from "sharp";
import { readdirSync } from "node:fs";

for (const f of readdirSync("public/img/src/cutouts")) {
  if (!f.endsWith(".png")) continue;
  const name = f.replace(/\.png$/, "");
  const trimmed = await sharp(`public/img/src/cutouts/${f}`).trim().toBuffer();
  const base = sharp(trimmed).resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true });
  await base.clone().png({ compressionLevel: 9, palette: false }).toFile(`public/img/cutout-${name}.png`);
  await base.clone().webp({ quality: 82, alphaQuality: 90 }).toFile(`public/img/cutout-${name}.webp`);
  await base.clone().avif({ quality: 60 }).toFile(`public/img/cutout-${name}.avif`);
  const m = await sharp(`public/img/cutout-${name}.png`).metadata();
  console.log(name, m.width, m.height);
}
