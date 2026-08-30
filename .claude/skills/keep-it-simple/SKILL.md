---
name: keep-it-simple
description: Scope and simplicity discipline for all coding work on this repo. ALWAYS load this before writing, refactoring, or reviewing any code, before adding any dependency, and whenever a task feels like it needs "architecture". It exists because AI-written code chronically does too much — this skill is the brake.
---

# Keep it simple

The failure mode you are here to prevent is not bad code. It is **too much code**. Every session, the gravitational pull is toward: more abstraction, more configuration, more edge-case handling for cases that cannot occur, more dependencies, more files. Resist all of it. This app is one solver, one quiz, one reveal, one list. A strong junior engineer should be able to read the whole repo in an afternoon.

## Hard limits (stop and split the job if you hit one)
- A feature touches more than 8 files or adds more than ~400 lines → split it, do the smaller half.
- More than 2 levels of component nesting for a page → flatten it.
- A new npm dependency → allowed only with a one-line justification in the commit message, and only if the platform (Node, Next, Tailwind, Supabase client) cannot do it in under ~30 lines.
- A new file named `utils`, `helpers`, `lib/common`, `types/index` → don't. Put code next to its only caller until there are three callers.

## Rules
1. **No abstraction before the third use.** Two similar blocks of code are cheaper than one wrong abstraction. Copy-paste twice, extract on the third.
2. **No speculative anything.** No feature flags, no config objects with one config, no "in case we need it later" parameters, no interfaces with one implementation, no folder structure for code that doesn't exist yet.
3. **Boring over clever.** A `for` loop over `reduce` chains. An `if` over a strategy pattern. JSON files over a CMS. Server components over client state where possible.
4. **Errors: handle what can happen, plainly.** Try/catch where an operation genuinely fails (network, db), a clear user-facing message, done. No error class hierarchies, no result-type frameworks.
5. **Delete on sight.** Dead code, unused exports, commented-out blocks, empty files — remove them in the same commit you notice them.
6. **The diff is the deliverable.** Before committing, reread the diff and remove anything the "done means" line doesn't require. If a change feels impressive, it's probably scope creep.
7. **Types: strict but plain.** Real types for data (Staple, Plan, SolveInput/Output). No generics gymnastics, no conditional types, no `zod` schemas for internal calls — validate at the one boundary that matters (the API route input) with plain checks.
8. **One way to do each thing.** One fetch helper, one date format, one way to read env. If a second way appears, merge them.

## The test before every commit
Ask: *could I explain this diff to a human in two sentences without saying "basically"?* If not, simplify until you can. Then ask: *what in this diff would a human engineer under deadline NOT have written?* Delete that part.
