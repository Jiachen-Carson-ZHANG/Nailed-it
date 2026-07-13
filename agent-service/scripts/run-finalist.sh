#!/usr/bin/env bash
# Finalist round: full 14 scenarios × n=5 + process & quality judges, on the two floor-passers.
# Detached (setsid/nohup) so it survives parent-shell resets. Progress → per-model logs.
set -uo pipefail
cd "$(dirname "$0")/.."
set -a; source ../.env.local; set +a
export MODEL_PROVIDER=openrouter
OUT=/home/tough/Nailed-it/docs/eval/model-matrix
mkdir -p "$OUT"

declare -A M=( [gpt-5.6-terra]=openai/gpt-5.6-terra [gemini-3.1-pro]=google/gemini-3.1-pro-preview )
for slug in gpt-5.6-terra gemini-3.1-pro; do
  id=${M[$slug]}
  echo "=== FINALIST $slug ($id) $(date -Is) ===" >> "$OUT/finalist-progress.log"
  AGENT_MODEL=$id ORCHESTRATOR_MODEL=$id DECISION_MODEL=$id AD_MODEL=$id REVIEWER_MODEL=$id COUPON_MODEL=$id MONITOR_MODEL=$id \
    PYTHONPATH=. .venv/bin/python eval/agents_eval.py --n 5 --process-judge --judge \
    --json-report "$OUT/finalist-$slug.json" > "$OUT/finalist-$slug.log" 2>&1
  echo "=== $slug exit=$? $(date -Is) ===" >> "$OUT/finalist-progress.log"
done
echo "FINALIST_DONE $(date -Is)" >> "$OUT/finalist-progress.log"
