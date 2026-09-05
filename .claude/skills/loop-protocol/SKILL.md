---
name: loop-protocol
description: The session lifecycle for autonomous building on this repo — how to start a session, pick work, verify, log, hand off to the next session, and feed the improvement backlog without scope creep. ALWAYS load this at the start of every session, when resuming after an interruption or usage limit, when a job finishes, and before adding anything to the task queue.
---

# Loop protocol

Sessions die (limits, crashes, humans closing laptops). The repo is the memory. Every session must leave the repo in a state where the NEXT session — with zero conversational context — can continue in under a minute. That is the entire trick behind "the loop".

## Start ritual (every session, no exceptions)
1. Read `CLAUDE.md`, `tasks/QUEUE.md`, `tasks/PROGRESS.md` (top entry), and `git log --oneline -10`.
2. `git status` — if there's uncommitted work, finish or revert it FIRST; never start a new job on a dirty tree.
3. State in one line which job you're taking (the top unblocked MVP item). If its "done means" line is ambiguous, rewrite it to be testable before starting — that edit is allowed.

## Work rules
- One job. Plan in ≤5 bullets, then build. Commit in small steps with one-line whys.
- Blocked mid-job (missing key, human decision, external dependency)? Commit what's safe, mark the job `BLOCKED: <one line>`, move it to the blocked section, take the next unblocked job.
- Verify = the job's "done means" line, literally. For anything user-facing: `npm run build` clean, then check the deployed URL (curl or fetch the route; for pages, confirm 200 + expected string). "It should work" is not verification.

## End ritual (also run this when you sense the session nearing its limit)
1. Commit and push everything shippable; revert anything half-done rather than leaving it dirty.
2. Prepend to `tasks/PROGRESS.md`: date · job · what shipped (1-2 lines) · live-URL state · next step or blocker in one line.
3. Update `tasks/QUEUE.md`: mark the job done (move to a Done section with the date), promote the next item.
4. If room remains in the session, loop back to the start ritual and take the next job.

## Improvement scanning (the "keep scaling" part — tightly caged)
After finishing a job, you may spend a few minutes scanning for improvements — but the ONLY permitted output of scanning is **queue entries, never code**. An idea enters `## Ideas` only as: `- [metric] one-line idea — one-line expected impact`, where metric ∈ activation | conversion | price-accuracy | perf. Promotion rule: an idea may move into the MVP/main list only when it (a) has a metric tag, (b) is smaller than the smallest remaining MVP job, or a human moved it. Prune: if Ideas exceeds 15 lines, delete the weakest until 10 remain. Improvements never interrupt an unfinished MVP list.

## Priorities when the queue is empty (rare, but the loop must not idle-invent)
1. Tighten estimate-vs-receipt accuracy (price data freshness, buffers).
2. Speed: reveal page under 1s on 4G.
3. Copy passes with `/impeccable polish`.
4. Then stop and write one line in PROGRESS asking the human for direction. Do NOT invent features.

## Honesty about limits
When a hard usage limit hits, the session simply ends — nothing can code around that. This protocol makes that a non-event: the queue and progress log ARE the continuation, and `loop.sh` (or the human relaunching) resumes cold with zero loss. Design every commit and log entry for the reader who has amnesia, because the next session does.
