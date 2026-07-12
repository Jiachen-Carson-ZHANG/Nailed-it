#!/usr/bin/env bash
# The weekly "Autopilot" is literally this file + one crontab line — no scheduler framework.
# A round reads ALL of its input from the database at start (mission env, briefs, due list),
# so a dumb cron is sufficient and crash-safe: nothing is carried in process memory between weeks.
#
# Install (every Friday 18:00 local):
#   crontab -e
#   0 18 * * 5  /home/tough/Nailed-it/agent-service/scripts/run-weekly-round.sh
#
# The monitor's follow-up trigger needs NO extra entry: matured actions (>=72h observation window)
# are injected into this round's due-review list by fetch_due_actions — the weekly round naturally
# OPENS by measuring last week. Pull, not push.

set -euo pipefail
cd "$(dirname "$0")/.."

set -a
# shellcheck disable=SC1091
source ../.env.local
set +a
export MODEL_PROVIDER="${MODEL_PROVIDER:-gemini}"

mkdir -p logs
{
  echo "=== weekly round $(date -Is) ==="
  PYTHONPATH=. .venv/bin/python -m nailed_agents
} >> logs/weekly-round.log 2>&1
