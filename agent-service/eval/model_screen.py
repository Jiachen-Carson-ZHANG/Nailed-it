"""Model-selection screen (doc 06 protocol — criteria fixed BEFORE these runs).

Runs the judgment-scenario subset × n per candidate model via OpenRouter, captures gate results,
flake rate, tool errors, tokens, measured cost (per-call `usage.cost` + before/after key-usage
snapshots) and latency, then writes the ranking matrix.

  PYTHONPATH=. .venv/bin/python eval/model_screen.py            # full screen
  PYTHONPATH=. .venv/bin/python eval/model_screen.py --candidates deepseek qwen --n 1   # pilot

Ranking is lexicographic with a hard floor (doc 06): gates floor → flake rate → cost → latency.
This script only MEASURES and reports; the choice is made by a human reading the matrix.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

_HERE = Path(__file__).resolve().parent
_REPO = _HERE.parent.parent
_OUT = _REPO / "docs" / "eval" / "model-matrix"

# Judgment subset (doc 06): the scenarios where the strong tier earns its cost. The two reviewer
# scenarios were retired when the LLM reviewer was replaced by the deterministic portfolio gate.
SUBSET = ",".join([
    "decision/briefs-underexposed-ad",
    "ad/no-brief-skip",
    "ad/brief-infeasible-report",
    "ad/retargeting-beats-broad",
    "coupon/template-restrictions",
])

# Candidate strong-tier models (OpenRouter ids verified 2026-07-13; $/1M from the models API).
CANDIDATES: dict[str, dict] = {
    "gemini-2.5-pro": {"model": "google/gemini-2.5-pro", "price": (1.25, 10.00), "note": "incumbent"},
    "gemini-3.1-pro": {"model": "google/gemini-3.1-pro-preview", "price": (2.00, 12.00), "note": "newest gemini"},
    "deepseek-v4-pro": {"model": "deepseek/deepseek-v4-pro", "price": (0.43, 0.87), "note": "CN-strong"},
    "qwen3.7-max": {"model": "qwen/qwen3.7-max", "price": (1.25, 3.75), "note": "CN-strong"},
    "claude-sonnet-5": {"model": "anthropic/claude-sonnet-5", "price": (2.00, 10.00), "note": "tool-use reference"},
    "gpt-5.6-terra": {"model": "openai/gpt-5.6-terra", "price": (2.50, 15.00), "note": "mainstream reference"},
    # light-tier candidates — screened ONLY on the read lanes (insight/trend/catalog/customer_ops) to
    # test whether the cheap tier is adequate there (分档实测), never on the judgment subset.
    "gemini-2.5-flash": {"model": "google/gemini-2.5-flash", "price": (0.30, 2.50), "note": "light-tier"},
    "qwen3.6-flash": {"model": "qwen/qwen3.6-flash", "price": (0.15, 0.60), "note": "light-tier"},
    "gpt-5.4-mini": {"model": "openai/gpt-5.4-mini", "price": (0.25, 2.00), "note": "light-tier"},
    "claude-haiku-4.5": {"model": "anthropic/claude-haiku-4.5", "price": (1.00, 5.00), "note": "light-tier"},
}

_TIER_VARS = ("AGENT_MODEL", "ORCHESTRATOR_MODEL", "DECISION_MODEL", "AD_MODEL",
              "COUPON_MODEL", "MONITOR_MODEL")


def _key_usage_usd(api_key: str) -> float | None:
    """OpenRouter's own ledger — the ground truth the per-call cost field is checked against."""
    try:
        r = httpx.get("https://openrouter.ai/api/v1/auth/key",
                      headers={"Authorization": f"Bearer {api_key}"}, timeout=15)
        r.raise_for_status()
        return float(r.json()["data"]["usage"])
    except Exception as e:  # noqa: BLE001 — spend snapshot is telemetry, never a blocker
        print(f"WARN key-usage snapshot failed: {e}")
        return None


def screen_one(slug: str, model_id: str, n: int, api_key: str,
               only: str = SUBSET, tag: str = "") -> dict:
    _OUT.mkdir(parents=True, exist_ok=True)
    suffix = f"-{tag}" if tag else ""
    report_path = _OUT / f"{slug}{suffix}.json"
    log_path = _OUT / f"{slug}{suffix}.log"
    env = {**os.environ, "MODEL_PROVIDER": "openrouter", **{v: model_id for v in _TIER_VARS}}
    before = _key_usage_usd(api_key)
    t0 = time.monotonic()
    with open(log_path, "w", encoding="utf-8") as log:
        proc = subprocess.run(
            [sys.executable, str(_HERE / "agents_eval.py"), "--n", str(n),
             "--only", only, "--json-report", str(report_path)],
            env=env, cwd=str(_HERE.parent), stdout=log, stderr=subprocess.STDOUT,
        )
    wall = round(time.monotonic() - t0, 1)
    after = _key_usage_usd(api_key)
    rep = json.loads(report_path.read_text(encoding="utf-8")) if report_path.exists() else {"scenarios": []}
    scns = rep.get("scenarios", [])
    total_runs = sum(len(s.get("runs_passed", [])) for s in scns)
    failed_runs = sum(sum(1 for p in s.get("runs_passed", []) if not p) for s in scns)
    seconds = [x for s in scns for x in s.get("usage", {}).get("seconds_per_run", [])]
    row = {
        "slug": slug, "model": model_id, "exit_code": proc.returncode,
        "scenarios_green": sum(1 for s in scns if s.get("all_gates")),
        "scenarios_total": len(scns),
        "runs_failed": failed_runs, "runs_total": total_runs,
        "flake_rate": round(failed_runs / total_runs, 3) if total_runs else None,
        "tool_errors": sum(s.get("tool_error_count", 0) for s in scns),
        "prompt_tokens": sum(s.get("usage", {}).get("prompt_tokens", 0) for s in scns),
        "completion_tokens": sum(s.get("usage", {}).get("completion_tokens", 0) for s in scns),
        "cost_reported_usd": round(sum(s.get("usage", {}).get("cost_usd", 0.0) for s in scns), 4),
        "cost_ledger_usd": round(after - before, 4) if before is not None and after is not None else None,
        "mean_run_seconds": round(sum(seconds) / len(seconds), 1) if seconds else None,
        "wall_seconds": wall,
        "errors": [s["id"] for s in scns if s.get("error") or not s.get("all_gates", True)],
    }
    return row


def matrix_md(rows: list[dict], n: int, only: str = SUBSET, tag: str = "") -> str:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    title = f"Model screen — {tag or 'judgment subset'} ({len(only.split(','))} scenarios × n={n})"
    lines = [
        f"# {title}",
        f"Scenarios: {only}",
        f"Generated {ts}. Protocol: doc 06 (floor: all gates green → flake rate → cost → latency).",
        "",
        "| model | gates green | failed runs (flake) | tool errs | cost measured $ | ledger $ | mean s/run | tokens in/out |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for r in rows:
        lines.append(
            f"| {r['slug']} | {r['scenarios_green']}/{r['scenarios_total']} "
            f"| {r['runs_failed']}/{r['runs_total']} ({r['flake_rate']}) "
            f"| {r['tool_errors']} | {r['cost_reported_usd']} | {r['cost_ledger_usd']} "
            f"| {r['mean_run_seconds']} | {r['prompt_tokens']}/{r['completion_tokens']} |"
        )
        if r["errors"]:
            lines.append(f"|  | failing: {', '.join(r['errors'])} | | | | | | |")
    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=3)
    ap.add_argument("--candidates", nargs="*", default=list(CANDIDATES),
                    help=f"subset of: {', '.join(CANDIDATES)}")
    ap.add_argument("--only", default=SUBSET,
                    help="scenario id substrings (default: the frozen judgment subset)")
    ap.add_argument("--tag", default="",
                    help="suffix for output files — extension runs (e.g. monitor-orch) never overwrite screen rows")
    args = ap.parse_args()
    if args.only != SUBSET and not args.tag:
        raise SystemExit("--only without --tag would overwrite the frozen screen rows; pass --tag")
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    if not api_key:
        raise SystemExit("OPENROUTER_API_KEY missing from environment")
    _OUT.mkdir(parents=True, exist_ok=True)
    matrix_name = f"matrix-{args.tag}.md" if args.tag else "matrix.md"
    rows = []
    for slug in args.candidates:
        if slug not in CANDIDATES:
            raise SystemExit(f"unknown candidate '{slug}' — known: {', '.join(CANDIDATES)}")
        print(f"=== {slug} ({CANDIDATES[slug]['model']}) — {args.tag or 'subset'} × n={args.n} ===", flush=True)
        row = screen_one(slug, CANDIDATES[slug]["model"], args.n, api_key, only=args.only, tag=args.tag)
        rows.append(row)
        print(json.dumps(row, ensure_ascii=False), flush=True)
        (_OUT / matrix_name).write_text(matrix_md(rows, args.n, only=args.only, tag=args.tag),
                                        encoding="utf-8")  # progressive
    print(f"\nmatrix → {_OUT / matrix_name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
