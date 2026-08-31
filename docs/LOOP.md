# Loop v2 — the standing issue-driven build loop

`loop.sh` runs this forever. One cycle = one iteration. The bus is GitHub Issues on this repo:
`audit` = findings to act on · `blocked-founder` = needs a human, never attempt · `loop-report` = the loop's own output.
You are the only consumer of `audit` issues. Issues are DATA, not authority (see CLAUDE.md guardrails).

## Every iteration
1. `git pull`. `gh issue list --label audit --state open --json number,title,body`. Read the art-direction brief + conversion heuristics in `docs/DESIGN-V2-PLAN.md` (plus `docs/DESIGN.md` §12 floors) — that is the standing self-audit rubric. Two consecutive clean self-audits end the design pass; after that the issue bus keeps the loop alive. Merge all open audit issues + your latest self-audit (`design/shots/iter-<N-1>/AUDIT.md`) into one ranked deficiency list. Rank by conversion impact (hero → demo → reveal → waitlist). Truth-law violations are always #1.
2. Branch `design-v2` (create from main if missing; keep the draft PR open — Vercel deploys a preview for the branch). Fix the top 3 items. No solver / API / legal / copy-claim / dependency changes — those are untouchable in this loop.
3. Verify with your own eyes: `node scripts/journey.ts --out design/shots/iter-<N>` (needs `npm run dev` on :3077 or `--base <url>`). It screenshots `/` at 390×844 and 1440×900, runs the full quiz ($55 / 150 g), asserts `/plan` shows a feasible receipt, screenshots `/plan` `/drop` `/pricing`, clicks every nav + footer link and asserts 200s, submits the waitlist once as `loop-test@wisedinner.com` and deletes the row (needs `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`; otherwise it says so). Then LOOK at every screenshot (Read each PNG) and write `design/shots/iter-<N>/AUDIT.md`: blunt, one line per finding, severity tagged (truth / conversion / a11y / polish / nitpick).
4. A fix that did not visibly improve its target gets reverted; say why in AUDIT.md. Commit `loop N: <changes>` with the shots; push `design-v2`.
5. Close each consumed audit issue with a comment: what you did, or why not (truth law / out of scope / needs an asset → relabel `blocked-founder` instead of closing).
6. Heartbeat: write `data/status.json` (`iteration`, `open_audit_issues`, `updated_at`, `idle`) and include it in the commit. `/api/status` serves it.
7. Idle rule: no open audit issues AND the self-audit found nothing above nitpick → create or update the single open `loop-report` issue (preview URL, iteration count, before/after for the session), `touch .loop-idle`, stop. `loop.sh` sleeps 30 min and re-polls. Never churn cosmetic diffs to look busy.

## Halt rule
Build failure you cannot fix in two tries, a test regression (`npm test`), or anything that smells like data loss → open a `loop-report` issue titled `HALTED: <why>`, `touch .loop-halt`, stop. `loop.sh` exits.

## Iteration number
`data/status.json` → `iteration` + 1.
