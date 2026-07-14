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

# Candidate models. `provider` picks the API the run actually goes through:
#   openrouter → per-call usage.cost + a key-usage ledger snapshot → DOUBLE-ENTRY cost verification.
#   gemini     → the merchant's own Google key (native OpenAI-compat endpoint). No cost field and no
#                ledger, so cost is COMPUTED from tokens × published price and cannot be cross-checked.
# Mixing providers in one matrix confounds cost/latency (different routing + caching): those two columns
# are provider-dependent for non-OpenRouter rows, and the matrix says so. Gate results are unaffected.
CANDIDATES: dict[str, dict] = {
    "gemini-2.5-pro": {"model": "google/gemini-2.5-pro", "price": (1.25, 10.00), "note": "incumbent"},
    "gemini-3.1-pro": {"model": "google/gemini-3.1-pro-preview", "price": (2.00, 12.00), "note": "newest gemini"},
    "deepseek-v4-pro": {"model": "deepseek/deepseek-v4-pro", "price": (0.43, 0.87), "note": "CN-strong"},
    "qwen3.7-max": {"model": "qwen/qwen3.7-max", "price": (1.25, 3.75), "note": "CN-strong"},
    "claude-sonnet-5": {"model": "anthropic/claude-sonnet-5", "price": (2.00, 10.00), "note": "tool-use reference"},
    "gpt-5.6-terra": {"model": "openai/gpt-5.6-terra", "price": (2.50, 15.00), "note": "mainstream reference"},
    # Same gemini models, run on the OWNER'S OWN Google key (native API) instead of through OpenRouter.
    "gemini-3.1-pro-native": {"model": "gemini-3.1-pro-preview", "provider": "gemini",
                              "price": (2.00, 12.00), "note": "newest gemini · own key"},
    "gemini-2.5-flash-native": {"model": "gemini-2.5-flash", "provider": "gemini",
                                "price": (0.30, 2.50), "note": "light-tier · own key"},
    # there is no plain `gemini-3.1-flash` on the native API — the 3.1 flash tier ships as flash-lite
    "gemini-3.1-flash-native": {"model": "gemini-3.1-flash-lite", "provider": "gemini",
                                "price": (0.10, 0.40), "note": "newest flash (lite) · own key"},
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
               only: str = SUBSET, tag: str = "", provider: str = "openrouter",
               price: tuple[float, float] | None = None) -> dict:
    _OUT.mkdir(parents=True, exist_ok=True)
    suffix = f"-{tag}" if tag else ""
    report_path = _OUT / f"{slug}{suffix}.json"
    log_path = _OUT / f"{slug}{suffix}.log"
    env = {**os.environ, "MODEL_PROVIDER": provider, **{v: model_id for v in _TIER_VARS}}
    # the ledger cross-check only exists on OpenRouter; a native-key run is priced from its own tokens
    before = _key_usage_usd(api_key) if provider == "openrouter" else None
    t0 = time.monotonic()
    # -u / PYTHONUNBUFFERED: stream the child's log to disk as it runs. Buffered, a long screen is
    # invisible while it runs AND loses its whole log if the run is killed on a timeout (measured).
    env["PYTHONUNBUFFERED"] = "1"
    with open(log_path, "w", encoding="utf-8", buffering=1) as log:
        proc = subprocess.run(
            [sys.executable, "-u", str(_HERE / "agents_eval.py"), "--n", str(n),
             "--only", only, "--json-report", str(report_path)],
            env=env, cwd=str(_HERE.parent), stdout=log, stderr=subprocess.STDOUT,
        )
    wall = round(time.monotonic() - t0, 1)
    after = _key_usage_usd(api_key) if provider == "openrouter" else None
    rep = json.loads(report_path.read_text(encoding="utf-8")) if report_path.exists() else {"scenarios": []}
    scns = rep.get("scenarios", [])
    total_runs = sum(len(s.get("runs_passed", [])) for s in scns)
    failed_runs = sum(sum(1 for p in s.get("runs_passed", []) if not p) for s in scns)
    seconds = [x for s in scns for x in s.get("usage", {}).get("seconds_per_run", [])]
    tok_in = sum(s.get("usage", {}).get("prompt_tokens", 0) for s in scns)
    tok_out = sum(s.get("usage", {}).get("completion_tokens", 0) for s in scns)
    # OpenRouter reports what it actually charged (incl. caching discounts). A native-key run has no
    # cost field, so it is priced from ITS OWN tokens at list price — an UPPER bound (no cache credit),
    # and not comparable like-for-like with a charged OpenRouter figure. The matrix flags which is which.
    reported = round(sum(s.get("usage", {}).get("cost_usd", 0.0) for s in scns), 4)
    if provider != "openrouter" and not reported and price:
        reported = round(tok_in * price[0] / 1e6 + tok_out * price[1] / 1e6, 4)
    # per-LEVEL gate results — the difficulty ladder is the whole point; never one blended pass rate
    by_level: dict[str, str] = {}
    lv: dict[int, list[bool]] = {}
    for s in scns:
        if "level" in s:
            lv.setdefault(s["level"], []).append(bool(s.get("all_gates")))
    for k, v in sorted(lv.items()):
        by_level[f"L{k}"] = f"{sum(v)}/{len(v)}"
    row = {
        "slug": slug, "model": model_id, "provider": provider, "exit_code": proc.returncode,
        "scenarios_green": sum(1 for s in scns if s.get("all_gates")),
        "scenarios_total": len(scns),
        "by_level": by_level,
        "runs_failed": failed_runs, "runs_total": total_runs,
        "flake_rate": round(failed_runs / total_runs, 3) if total_runs else None,
        "tool_errors": sum(s.get("tool_error_count", 0) for s in scns),
        "tool_calls": sum(s.get("tool_call_count", 0) for s in scns),
        "prompt_tokens": tok_in, "completion_tokens": tok_out,
        "completion_tokens_per_run": round(tok_out / total_runs) if total_runs else None,
        "cost_reported_usd": reported,
        "cost_basis": "charged (openrouter)" if provider == "openrouter" else "computed from tokens (list price, upper bound)",
        "cost_ledger_usd": round(after - before, 4) if before is not None and after is not None else None,
        "mean_run_seconds": round(sum(seconds) / len(seconds), 1) if seconds else None,
        "wall_seconds": wall,
        "errors": [s["id"] for s in scns if s.get("error") or not s.get("all_gates", True)],
    }
    return row


def matrix_md(rows: list[dict], n: int, only: str = SUBSET, tag: str = "") -> str:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    title = f"Model screen — {tag or 'judgment subset'} (n={n})"
    mixed = len({r.get("provider", "openrouter") for r in rows}) > 1
    lines = [
        f"# {title}",
        f"Scenarios: {only}",
        f"Generated {ts}. Protocol: doc 06 (floor: all gates green → flake rate → cost → latency).",
        "Per-LEVEL gates are reported separately — L1 (contract) is EXPECTED to saturate; the models",
        "are supposed to separate at L2 (conditional tool use) and L3 (evidence conflict).",
        "",
        "| model | provider | L1 | L2 | L3 | gates green | flake | tool errs | tool calls | cost $ | ledger $ | s/run | out-tok/run | tokens in/out |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for r in rows:
        bl = r.get("by_level", {})
        lines.append(
            f"| {r['slug']} | {r.get('provider', 'openrouter')} "
            f"| {bl.get('L1', '—')} | {bl.get('L2', '—')} | {bl.get('L3', '—')} "
            f"| {r['scenarios_green']}/{r['scenarios_total']} "
            f"| {r['runs_failed']}/{r['runs_total']} ({r['flake_rate']}) "
            f"| {r['tool_errors']} | {r.get('tool_calls', '—')} "
            f"| {r['cost_reported_usd']} | {r['cost_ledger_usd']} "
            f"| {r['mean_run_seconds']} | {r.get('completion_tokens_per_run', '—')} "
            f"| {r['prompt_tokens']}/{r['completion_tokens']} |"
        )
        if r["errors"]:
            lines.append(f"|  | failing: {', '.join(r['errors'])} | | | | | | | | | | | | |")
    if mixed:
        lines += [
            "",
            "> **Cost/latency are NOT like-for-like across providers.** OpenRouter rows are what the",
            "> gateway actually CHARGED (caching discounts included) and are cross-checked against its",
            "> ledger. Native-key rows have no cost field or ledger: they are priced from their own",
            "> tokens at list price — an UPPER bound. Gate results (the selection floor) are unaffected.",
        ]
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
    wanted = {CANDIDATES[s].get("provider", "openrouter") for s in args.candidates if s in CANDIDATES}
    if "openrouter" in wanted and not api_key:
        raise SystemExit("OPENROUTER_API_KEY missing from environment")
    if "gemini" in wanted and not os.environ.get("GEMINI_API_KEY", ""):
        raise SystemExit("GEMINI_API_KEY missing — a *-native candidate runs on the owner's own Google key")
    _OUT.mkdir(parents=True, exist_ok=True)
    matrix_name = f"matrix-{args.tag}.md" if args.tag else "matrix.md"
    rows = []
    for slug in args.candidates:
        if slug not in CANDIDATES:
            raise SystemExit(f"unknown candidate '{slug}' — known: {', '.join(CANDIDATES)}")
        cand = CANDIDATES[slug]
        prov = cand.get("provider", "openrouter")
        print(f"=== {slug} ({cand['model']} via {prov}) — {args.tag or 'subset'} × n={args.n} ===", flush=True)
        row = screen_one(slug, cand["model"], args.n, api_key, only=args.only, tag=args.tag,
                         provider=prov, price=cand.get("price"))
        rows.append(row)
        print(json.dumps(row, ensure_ascii=False), flush=True)
        (_OUT / matrix_name).write_text(matrix_md(rows, args.n, only=args.only, tag=args.tag),
                                        encoding="utf-8")  # progressive
    print(f"\nmatrix → {_OUT / matrix_name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
