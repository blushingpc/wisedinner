// AUDIT CONTACT SHEETS (docs/AUDIT-2026-09-09.md): a tall full-page capture is unreadable when scaled to fit, so each
// one is cut into columns of `colH` px and tiled side by side at 1:1. run: node scripts/audit-sheet.ts <dir> [colH]
import sharp from "sharp";
import { readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
const colH = Number(process.argv[3] || 1000);
const out = join(dir, "sheets");
mkdirSync(out, { recursive: true });
for (const f of readdirSync(dir).filter((f) => f.endsWith(".png") && !f.includes("__fold") && !f.startsWith("_"))) {
  const img = sharp(join(dir, f));
  const { width = 0, height = 0 } = await img.metadata();
  if (height <= colH * 1.2) continue; // short enough to read as-is
  const cols = Math.ceil(height / colH);
  const parts = [];
  for (let i = 0; i < cols; i++) {
    const top = i * colH;
    const h = Math.min(colH, height - top);
    parts.push({ input: await sharp(join(dir, f)).extract({ left: 0, top, width, height: h }).png().toBuffer(), left: i * (width + 8), top: 0 });
  }
  await sharp({ create: { width: cols * (width + 8) - 8, height: colH, channels: 3, background: "#ff00ff" } })
    .composite(parts)
    .png({ compressionLevel: 6 })
    .toFile(join(out, f.replace(/\.png$/, "__sheet.png")));
  console.log(f, `${width}x${height} -> ${cols} cols`);
}
