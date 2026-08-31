#!/usr/bin/env bash
# WiseDinner build loop v2 — issue-driven, runs forever. Protocol: docs/LOOP.md
# Run from the repo root: ./loop.sh   (Ctrl-C to stop)
set -u
cd "$(dirname "$0")"
# pid-lock: two loops must never run at once
LOCK=.loop.pid
if [ -f "$LOCK" ] && kill -0 "$(cat "$LOCK")" 2>/dev/null; then
  echo "[loop] already running as pid $(cat "$LOCK") — exiting."
  exit 0
fi
echo $$ > "$LOCK"
trap 'rm -f "$LOCK"' EXIT
echo "[loop] started pid $$ at $(date -u +%FT%TZ)"
PROMPT="Read CLAUDE.md, then follow docs/LOOP.md exactly for one iteration. Start with git pull and the audit-issue poll. Stop when the iteration is committed and pushed, or when you touch .loop-idle / .loop-halt."
# acceptEdits auto-approves file edits but still asks for shell commands. For a fully unattended loop
# use --dangerously-skip-permissions, ONLY on a machine/repo you fully control.
FLAGS="--permission-mode acceptEdits"
while true; do
  rm -f .loop-idle .loop-halt
  git pull -q --ff-only || echo "[loop] pull failed; continuing on local state"
  if claude -p "$PROMPT" $FLAGS; then
    if [ -f .loop-halt ]; then
      echo "[loop] HALTED — see the loop-report issue. exiting."
      exit 1
    elif [ -f .loop-idle ]; then
      echo "[loop] idle: no audit issues, nothing above nitpick. re-polling in 30m."
      sleep 1800
    else
      echo "[loop] iteration done. next in 60s."
      sleep 60
    fi
  else
    echo "[loop] session ended abnormally — usually a usage limit. sleeping 30m."
    sleep 1800
  fi
done
