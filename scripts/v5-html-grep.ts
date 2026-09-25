// SITE v5 §5 and §8 gate: grep every prerendered page (.next/server/app/**/*.html and *.rsc) for strings that must be
// gone, after decoding HTML entities. Dynamic routes (/w/*, /staples) are checked live with --base.
//   node scripts/v5-html-grep.ts [--base http://localhost:3077]
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const MUST_BE_ZERO: [string, RegExp][] = [
  ["em or en dash", /[–—]/],
  ["middot", /·/],
  ["Autopilot", /autopilot/i],
  ["Pre-order available now", /Pre-order available now/],
  ["This week's plan", /This week['’]s plan/],
  ["$59", /\$59\b/],
  ["$89", /\$89\b/],
  ["4.92", /\b4\.92\b/],
  ["7.42", /\b7\.42\b/],
  ["kroger", /kroger/i],
  ["walmart", /walmart/i],
  ["instacart", /instacart/i],
];
const decode = (s: string) =>
  s
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d));
// strip what never reaches a reader: scripts other than JSON-LD are the RSC payload, which duplicates the visible
// text; keep them (a string in the payload can still render), but drop CSS and class attributes
const visible = (s: string) => s.replace(/<style[\s\S]*?<\/style>/g, "").replace(/ class="[^"]*"/g, "");

const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk(".next/server/app").filter((f) => /\.(html|rsc)$/.test(f));
const hits: Record<string, string[]> = {};
const pages: [string, string][] = files.map((f) => [f.replace(/\\/g, "/").replace(".next/server/app", ""), visible(decode(readFileSync(f, "utf8")))]);

const i = process.argv.indexOf("--base");
if (i > -1) {
  const base = process.argv[i + 1].replace(/\/$/, "");
  for (const r of ["/w/example", "/w/example-2", "/staples", "/", "/pricing", "/faq", "/the-math", "/about", "/privacy", "/terms"]) {
    const res = await fetch(base + r);
    pages.push([`live ${r} (${res.status})`, visible(decode(await res.text()))]);
  }
}
for (const [name, text] of pages) {
  for (const [label, re] of MUST_BE_ZERO) {
    const m = text.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"));
    if (m) (hits[label] ??= []).push(`${name} x${m.length}: ${text.slice(Math.max(0, text.search(re) - 50), text.search(re) + 50).replace(/\s+/g, " ")}`);
  }
}
console.log(`${pages.length} pages checked`);
for (const [label] of MUST_BE_ZERO) console.log(`${label}: ${hits[label]?.length ?? 0}${hits[label] ? "\n  " + hits[label].join("\n  ") : ""}`);
