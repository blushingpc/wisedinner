// meal photo export (REDESIGN-V3 §2I/§2J): masters in public/img/src/menu/<id>.png (2K, gitignored) → public/img/menu/<id>.jpg
// at 1600px, mozjpeg. next/image serves AVIF/WebP from the jpg on the fly. run: node scripts/gen-menu.ts
import sharp from "sharp";
import { mkdirSync, readdirSync } from "node:fs";

mkdirSync("public/img/menu", { recursive: true });
for (const f of readdirSync("public/img/src/menu")) {
  if (!f.endsWith(".png")) continue;
  const name = f.replace(/\.png$/, "");
  const meta = await sharp(`public/img/src/menu/${f}`).metadata();
  await sharp(`public/img/src/menu/${f}`).resize({ width: 1600, height: 1600, fit: "cover", withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toFile(`public/img/menu/${name}.jpg`);
  console.log(name, meta.width, meta.height);
}
