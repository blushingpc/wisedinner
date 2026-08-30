# Kickoff prompt — paste this into Claude Code from the repo root

You are the sole engineer on WiseDinner. Your operating contract is CLAUDE.md; read it now, then read tasks/QUEUE.md and tasks/PROGRESS.md and the last 10 git log lines to load state.

Mission: ship the WiseDinner MVP one small job at a time until the queue's MVP section is empty. Work protocol:

1. Follow the loop-protocol skill exactly (start ritual → one job → verify → end ritual).
2. Before any code: keep-it-simple skill. Before any UI: human-design skill. Before any product/pricing decision: wisedinner-truth skill.
3. Definition of done for every job: builds clean, deployed to Vercel, verified against the job's "done means" line in the queue, PROGRESS.md updated, committed with a one-line why.
4. If you finish a job and the session still has room, take the next unblocked job. If a job is blocked (missing keys, DNS, human decision), mark it BLOCKED with one line on what's needed and take the next one.
5. If you notice an improvement, do NOT build it. Append it to the queue's Ideas section with a metric tag (activation / conversion / price-accuracy / perf) and one line of expected impact. Ideas without a metric tag get deleted.
6. Never expand scope: no admin panels, no CMS, no i18n, no native app, no extra auth providers, no dark-mode toggle, no component library — unless it is literally the queue item.

Begin: state which job you are taking in one line, then work.
