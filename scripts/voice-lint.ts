// VOICE LINT (REDESIGN-V4 §3): no em dashes, en dashes, middots, ellipses or exclamation points in copy, and no
// lowercase-styled text. scans source strings in app/, content/ and data/*.json with comments stripped, so the rule
// applies to what renders, not to code comments. run: node scripts/voice-lint.ts  (exit 1 on any hit)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["app", "content"];
const DATA = ["data/menu.json", "data/fixture-week.json", "data/fixture-week-2.json", "data/testers.json"]; // copy-bearing data only; ledgers are not copy
const BANNED: [RegExp, string][] = [
  [/—/g, "em dash"],
  [/–/g, "en dash"],
  [/·/g, "middot"],
  [/…/g, "ellipsis"],
  [/(?<![=!<>])!(?=[^=])/g, "exclamation point"],
  [/\blowercase\b/g, "lowercase styling"],
];

function* walk(dir: string): Generator<string> {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(tsx?|json)$/.test(f) && !/\.test\./.test(f)) yield p;
  }
}

// keep only string literals and JSX text: strip comments, then for tsx keep quoted strings plus text between tags
const STRING = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g;
const JSX_TEXT = />([^<>{}]+)</g;
function copyOf(src: string, file: string) {
  const noComments = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
  if (file.endsWith(".json")) return noComments;
  const strings = [...noComments.matchAll(STRING)].map((m) => m[0]);
  const jsx = [...noComments.matchAll(JSX_TEXT)].map((m) => m[1]);
  return [...strings, ...jsx].join("\n");
}

let hits = 0;
const files = [...ROOTS.flatMap((r) => [...walk(r)]), ...DATA];
for (const file of files) {
  {
    const text = copyOf(readFileSync(file, "utf8"), file);
    for (const [re, name] of BANNED) {
      for (const m of text.matchAll(re)) {
        const line = text.slice(0, m.index).split("\n").at(-1)?.trim().slice(0, 80);
        console.log(`${file}: ${name}: ${line}`);
        hits++;
      }
    }
  }
}
console.log(hits ? `${hits} voice violations` : "voice clean");
process.exit(hits ? 1 : 0);
