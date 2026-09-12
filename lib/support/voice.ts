// the copy rules from REDESIGN-V4 §3 as one shared list: scripts/voice-lint.ts scans the site with it, and the support
// send gate (handler.ts) runs every auto-reply draft through voiceProblems() before anything is sent.
export const BANNED: [RegExp, string][] = [
  [/—/g, "em dash"],
  [/–/g, "en dash"],
  [/·/g, "middot"],
  [/…/g, "ellipsis"],
  [/(?<![=!<>])!(?!=)/g, "exclamation point"], // "!" anywhere, including the last character; not != / !== / <!
  [/\blowercase\b/g, "lowercase styling"],
];

const snippet = (text: string, at: number) => text.slice(Math.max(0, at - 30), at + 30).replace(/\s+/g, " ").trim();

// the send gate's rules: the copy bans that apply to an email ("lowercase styling" is about CSS, so not here), plus a
// hyphen standing alone between two words on one line ("free - for now"), which is a dash in prose. hyphenated
// compounds ("14-day") and "- " bullets at the start of a line are fine. kept out of BANNED so the site lint is unchanged.
const GATE: [RegExp, string][] = [
  ...BANNED.filter(([, name]) => name !== "lowercase styling"),
  [/(?<=\S)[ \t]+-{1,2}[ \t]+(?=\S)/g, "hyphen used as a dash"],
  [/\.{3}/g, "ellipsis"], // three dots typed out
];
// dots that do not end a sentence
const ABBREV = /\b(?:e\.g|i\.e|a\.m|p\.m|vs|etc|approx|u\.s)\./gi;
// a first word that is not a sentence start in the usual sense: a URL, an email address, a brand like iPhone or eBay
const EXEMPT = (word: string) => /^(?:https?:\/\/|www\.)|@/i.test(word) || /\p{Lu}/u.test(word.slice(1));

// every rule the draft breaks, each with the offending text quoted. sentence case: a sentence (after . ! ? or a line
// break) must start with a capital letter, a digit or a dollar sign; lower case after a colon is fine.
export function voiceProblems(text: string): string[] {
  const out: string[] = [];
  for (const [re, name] of GATE) {
    for (const m of text.matchAll(re)) out.push(`${name} in "${snippet(text, m.index ?? 0)}"`);
  }
  const prose = text.replace(ABBREV, (m) => m.replace(/\./g, ""));
  for (const s of prose.split(/(?<=[.!?])\s+|\n+/)) {
    const word = (s.match(/^[^\p{L}\p{N}$]*(\S+)/u) ?? [])[1] ?? "";
    if (EXEMPT(word)) continue;
    const first = s.replace(/^[^\p{L}\p{N}$]+/u, "").charAt(0);
    if (first && first !== first.toUpperCase()) out.push(`sentence starts lower case in "${s.trim().slice(0, 60)}"`);
  }
  return out;
}
