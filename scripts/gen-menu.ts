// MENU PHOTO EXPORT (REDESIGN-V4 §5B/§5C/§5E). run: node scripts/gen-menu.ts
// masters: public/img/src/cutouts-4k/<id>.png (4096², transparent: the 2K generation upscaled to 4K, background removed
// at 4K; gitignored). each is flattened onto pure white so it sits on the page with no edge, then written as one
// 2048px q90 JPG master. next/image serves exact 1x/2x/3x AVIF/WebP candidates from it (next.config.ts imageSizes
// carries every rendered width × 1, 2, 3), so nothing renders above its intrinsic size and nothing is soft at 3x.
import sharp from "sharp";
import { existsSync, mkdirSync, readdirSync } from "node:fs";

const SRC = "public/img/src/cutouts-4k";
const OUT = "public/img/menu";
const SIZE = 2048;
mkdirSync(OUT, { recursive: true });

for (const f of readdirSync(SRC)) {
  if (!f.endsWith(".png")) continue;
  const id = f.replace(/\.png$/, "");
  const src = `${SRC}/${f}`;
  const meta = await sharp(src).metadata();
  if (!meta.hasAlpha) throw new Error(`${f}: not a cut-out (no alpha)`);
  // the dish keeps its place in the frame (the plate is centered by the shot); pad 4% so nothing touches the edge
  const pad = Math.round(SIZE * 0.04);
  await sharp(src)
    .flatten({ background: "#ffffff" })
    .resize({ width: SIZE - pad * 2, height: SIZE - pad * 2, fit: "contain", background: "#ffffff" })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: "#ffffff" })
    .jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toFile(`${OUT}/${id}.jpg`);
  console.log(id, meta.width, meta.height, "->", SIZE);
}
if (!existsSync(`${OUT}/chicken-burrito-bowl.jpg`)) throw new Error("the anchor did not export");
