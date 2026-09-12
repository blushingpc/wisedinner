import assert from "node:assert/strict";
import { test } from "node:test";
import { voiceProblems } from "../voice.ts";
import { FOOTER } from "../kb.ts";

test("voice gate: a clean reply passes, including prices, times, brands, abbreviations, links, bullets and the sign-off", () => {
  const reply = [
    "The pre-order build is free and complete: onboarding, the solver and the week view. Protein Plan is $8.99 a month with a 14-day trial.",
    "iPhone launches first, e.g. through the App Store, and Android follows. Autopilot plans next week every Sunday at 5pm.",
    "- Protein Plan adds single meal regenerate.\n- Autopilot adds a menu of substitutes.",
    "More on the site:\nhttps://www.wisedinner.com/pricing\nsupport@wisedinner.com",
    "Émile, the lowercase question is fine too.",
    "WiseDinner support",
    FOOTER,
  ].join("\n\n");
  assert.deepEqual(voiceProblems(reply), []);
});

test("voice gate: dashes, middots, ellipses, exclamation points and lower-case sentences are flagged with the text", () => {
  const p = voiceProblems("It is free — for now. Pay later · or never… Great! thanks for asking. It is free - really.");
  const names = p.map((x) => x.split(" in ")[0]);
  assert.deepEqual(names.sort(), ["ellipsis", "em dash", "exclamation point", "hyphen used as a dash", "middot", "sentence starts lower case"].sort());
  assert.ok(p.find((x) => x.startsWith("em dash"))!.includes("—"), "the offending text is quoted");
  const bang = voiceProblems("Yes, the pre-order build is free. Enjoy!");
  assert.equal(bang.length, 1, "a trailing ! is caught");
  assert.match(bang[0], /^exclamation point in ".*Enjoy!"$/);
  assert.ok(voiceProblems("- lower case bullet").some((x) => x.startsWith("sentence starts lower case")), "a lower-case bullet is still flagged");
});
