// one-time brand raster export. run: node scripts/gen-icons.ts
// emits app icons from the vector mark + optimized jpgs from public/img/src (originals are gitignored).
import sharp from "sharp";
import { readFileSync, readdirSync } from "node:fs";

const MARK = "public/logo/wisedinner-mark.svg";
const INK = readFileSync(MARK);

// trimmed mark, transparent, longest side = size
async function mark(size: number) {
  const big = await sharp(INK).resize(4096, 4096).png().toBuffer();
  const trimmed = await sharp(big).trim().toBuffer(); // separate stage: sharp runs trim before resize inside one pipeline
  return sharp(trimmed).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}

// mark on white with 20% padding each side
async function icon(size: number, out: string) {
  const inner = Math.round(size * 0.6);
  const pad = Math.round(size * 0.2);
  await sharp(await mark(inner))
    .extend({ top: pad, bottom: size - inner - pad, left: pad, right: size - inner - pad, background: "#FFFFFF" })
    .flatten({ background: "#FFFFFF" })
    .png()
    .toFile(out);
}

async function main() {
  await icon(512, "app/icon.png");
  await icon(180, "app/apple-icon.png");
  await icon(192, "public/icons/icon-192.png");
  await icon(512, "public/icons/icon-512.png");
  await sharp(await mark(2048)).toFile("public/press/wisedinner-mark.png");
  await icon(24, "public/press/qa-24.png"); // logo QA gate check only

  for (const f of readdirSync("public/img/src")) {
    if (!f.endsWith(".png")) continue;
    const name = f.replace(/\.png$/, "");
    const meta = await sharp(`public/img/src/${f}`).metadata();
    await sharp(`public/img/src/${f}`).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toFile(`public/img/${name}.jpg`);
    console.log(name, meta.width, meta.height);
  }
}
main();
