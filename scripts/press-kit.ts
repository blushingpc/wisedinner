// zips the mark (svg + 2048 png) → public/press/wisedinner-press-kit.zip. run: node scripts/press-kit.ts
// ponytail: a stored (uncompressed) zip is ~40 lines of stdlib; png is already compressed, svg is 4 kb. no zip dep.
import { readFileSync, writeFileSync } from "node:fs";
import { crc32 } from "node:zlib";

const FILES = ["public/logo/wisedinner-mark.svg", "public/press/wisedinner-mark.png"];

const u16 = (n: number) => Buffer.from([n & 255, (n >> 8) & 255]);
const u32 = (n: number) => Buffer.from([n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]);

const local: Buffer[] = [];
const central: Buffer[] = [];
let offset = 0;
for (const path of FILES) {
  const data = readFileSync(path);
  const name = Buffer.from(path.split("/").pop()!);
  const crc = crc32(data);
  const head = Buffer.concat([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name]);
  local.push(head, data);
  central.push(
    Buffer.concat([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]),
  );
  offset += head.length + data.length;
}
const cd = Buffer.concat(central);
const end = Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(FILES.length), u16(FILES.length), u32(cd.length), u32(offset), u16(0)]);
writeFileSync("public/press/wisedinner-press-kit.zip", Buffer.concat([...local, cd, end]));
console.log("wrote public/press/wisedinner-press-kit.zip", offset + cd.length + end.length, "bytes");
