# WiseDinner build kit
Drop the CONTENTS of this folder into the root of your empty wisedinner GitHub repo, commit, push. Then:
1. Do chrome-tasks.md Task 1 (Vercel import).
2. In a terminal at the repo root: paste MEGAPROMPT.md into `claude` for a supervised first session — watch it do job 1 so you trust the ritual.
3. When comfortable, run `./loop.sh` for chained sessions. It sleeps 30 min and retries when a usage limit ends a session.
Files: CLAUDE.md (contract) · .claude/skills/* (4 skills, auto-discovered) · tasks/QUEUE.md (the backlog = the loop's fuel) · tasks/PROGRESS.md (session memory) · MEGAPROMPT.md (kickoff) · loop.sh (auto-resume) · chrome-tasks.md (dashboard work).
