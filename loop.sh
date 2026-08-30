#!/usr/bin/env bash
# WiseDinner build loop — chains Claude Code sessions against tasks/QUEUE.md.
# Run from the repo root: ./loop.sh
# Stop with Ctrl-C. Each cycle = one job picked, shipped, logged.
set -u
PROMPT="Read CLAUDE.md and follow the loop-protocol skill: take the top unblocked job in tasks/QUEUE.md, ship it end to end, update tasks/PROGRESS.md, then stop."
# Permission mode: acceptEdits auto-approves file edits but still asks for shell
# commands. For a fully unattended loop swap in --dangerously-skip-permissions,
# ONLY on a machine/repo you fully control — it removes all guardrails.
FLAGS="--permission-mode acceptEdits"
while true; do
  if claude -p "$PROMPT" $FLAGS; then
    echo "[loop] job cycle finished. next in 60s (Ctrl-C to stop)."
    sleep 60
  else
    echo "[loop] session ended abnormally — usually a usage limit. sleeping 30m."
    sleep 1800
  fi
done
