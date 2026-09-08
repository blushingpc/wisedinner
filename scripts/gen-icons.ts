// brand raster export (REDESIGN-V4 §2C). run: node scripts/gen-icons.ts
// app icon + favicons: the white mark centered on a forest tile, mark width 64% of the tile, iOS squircle corners.
// apple-icon stays a full square (iOS applies its own mask and rejects alpha); everything else gets the squircle.
// also emits the press mark PNGs (forest and white on transparent) from the vector.
import sharp from "sharp";
import { readFileSync } from "node:fs";

const FOREST = "#0B3D2E";
const MARK = readFileSync("public/logo/wisedinner-mark.svg", "utf8");
const PATHS = MARK.match(/ d="[^"]+"/g)!.map((m) => `<path${m}/>`).join("");
const paths = (color: string) => `<g fill="none" stroke="${color}" stroke-width="11.2" stroke-linecap="round" stroke-linejoin="round">${PATHS}</g>`;

// iOS-style squircle (superellipse n≈5) as an SVG path
function squircle(size: number, steps = 256) {
  const r = size / 2;
  const n = 5;
  const pts: string[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const x = r + Math.sign(c) * r * Math.abs(c) ** (2 / n);
    const y = r + Math.sign(s) * r * Math.abs(s) ** (2 / n);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

function tileSvg(size: number, rounded: boolean) {
  const shape = rounded ? `<path d="${squircle(size)}" fill="${FOREST}"/>` : `<rect width="${size}" height="${size}" fill="${FOREST}"/>`;
  // the W with its caps is 100 wide × 46.8 tall on the 100-box (y 21.2 to 68); center that box, width 64% of the tile
  const w = size * 0.64;
  const h = w * 0.468;
  const x = (size - w) / 2;
  const y = (size - h) / 2 - w * 0.212; // shift so the W's own box (not the 100-box) is centered
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${shape}<g transform="translate(${x} ${y}) scale(${w / 100})">${paths("#FFFFFF")}</g></svg>`;
}

async function icon(size: number, out: string, rounded = true) {
  await sharp(Buffer.from(tileSvg(size, rounded)), { density: 384 }).resize(size, size).png().toFile(out);
  console.log("wrote", out);
}

async function markPng(size: number, out: string, color = FOREST) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">${paths(color)}</svg>`;
  // the W's own box: 100 × 46.8 → render at `size` wide on transparent
  await sharp(Buffer.from(svg), { density: 384 })
    .resize(size, size)
    .extract({ left: 0, top: Math.round(size * 0.212), width: size, height: Math.round(size * 0.468) })
    .png()
    .toFile(out);
  console.log("wrote", out);
}

async function main() {
  await icon(1024, "app/icon.png");
  await icon(180, "app/apple-icon.png", false);
  await icon(192, "public/icons/icon-192.png");
  await icon(512, "public/icons/icon-512.png");
  await markPng(2048, "public/press/wisedinner-mark.png");
  await markPng(2048, "public/press/wisedinner-mark-white.png", "#FFFFFF");
  await icon(1024, "public/press/wisedinner-app-icon.png");
}
main();
