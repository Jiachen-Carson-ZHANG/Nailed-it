#!/usr/bin/env python3
"""Small, deterministic Graphify maintenance helper.

The canonical graph is an architecture map. This script only auto-runs the
cheap AST updater for code-only changes; semantic extraction remains explicit.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


PROJECT_ROOT = Path(__file__).resolve().parents[1]
STATE_DIR = PROJECT_ROOT / ".graphify-state"
CHANGED_FILES = STATE_DIR / "changed-files.txt"
GRAPH_DIR = PROJECT_ROOT / "graphify-out"
SHARED_REPORT = GRAPH_DIR / "GRAPH_REPORT.md"
SHARED_MANIFEST = GRAPH_DIR / "manifest.json"
SEMANTIC_MARKER = GRAPH_DIR / ".semantic_update_needed"
CLEAN_REBUILD_MARKER = GRAPH_DIR / ".needs_clean_rebuild"

CODE_SUFFIXES = {
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".go",
    ".rs",
    ".java",
}

BULKY_SUFFIXES = {
    ".csv",
    ".jsonl",
    ".log",
    ".pkl",
    ".zip",
    ".pdf",
    ".ipynb",
    ".pyc",
}

IGNORED_PREFIXES = (
    ".git/",
    ".venv/",
    "__pycache__/",
    ".pytest_cache/",
    ".graphify-state/",
    "graphify-out/",
    "tests/",
    "lab/",
    "feature_engineering_runs/",
    "generated_preprocessing_runs/",
    "generated_feature_engineering_runs/",
    "docs/plans/",
)

SEMANTIC_PREFIXES = (
    "docs/architecture/",
    "docs/decisions/",
    "prompts/",
    "references/",
    "skills/",
)

SEMANTIC_FILES = {
    "AGENTS.md",
    "CLAUDE.md",
}

IGNORED_FILES = {
    "docs/changes/implementation-log.md",
}

CLEAN_REBUILD_FILES = {
    ".graphifyignore",
}

# Paths tracked in the shared manifest for CI staleness checks.
MANIFEST_PATHS = (
    "AGENTS.md",
    "CLAUDE.md",
    ".claude/settings.json",
    ".claude/rules/doc-discipline.md",
    ".claude/rules/docs-files.md",
    ".codex/hooks.json",
    ".graphifyignore",
    ".github/workflows/graphify.yml",
    ".python-version",
    "docs/architecture/current-state.md",
    "docs/architecture/graphify-ingestion-policy.md",
    "docs/decisions/0002-graphify-collaboration.md",
    "graphify-out/README.md",
    "pyproject.toml",
    "scripts/graphify_maintenance.py",
)


@dataclass(frozen=True)
class Classification:
    code_paths: tuple[str, ...]
    semantic_paths: tuple[str, ...]
    clean_rebuild_paths: tuple[str, ...]
    ignored_paths: tuple[str, ...]
    missing_paths: tuple[str, ...]


@dataclass(frozen=True)
class StaleCheck:
    missing_paths: tuple[str, ...]
    newer_paths: tuple[str, ...]
    report_exists: bool


def _normalise_path(path: str) -> str | None:
    if not path:
        return None
    raw = Path(path).expanduser()
    try:
        absolute = raw if raw.is_absolute() else (PROJECT_ROOT / raw)
        relative = absolute.resolve().relative_to(PROJECT_ROOT.resolve())
    except ValueError:
        return None
    return relative.as_posix()


def _extract_paths(value: Any) -> list[str]:
    paths: list[str] = []
    if isinstance(value, dict):
        for key, item in value.items():
            if key in {"file_path", "filePath", "path"} and isinstance(item, str):
                normalised = _normalise_path(item)
                if normalised:
                    paths.append(normalised)
            else:
                paths.extend(_extract_paths(item))
    elif isinstance(value, list):
        for item in value:
            paths.extend(_extract_paths(item))
    return paths


def paths_from_hook_stdin(stdin: str) -> list[str]:
    if not stdin.strip():
        return []
    try:
        payload = json.loads(stdin)
    except json.JSONDecodeError:
        return []
    return sorted(set(_extract_paths(payload)))


def read_recorded_paths() -> list[str]:
    if not CHANGED_FILES.exists():
        return []
    return sorted({line.strip() for line in CHANGED_FILES.read_text().splitlines() if line.strip()})


def record_paths(paths: Iterable[str]) -> int:
    normalised = sorted({p for path in paths if (p := _normalise_path(path))})
    if not normalised:
        return 0
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    existing = set(read_recorded_paths())
    existing.update(normalised)
    CHANGED_FILES.write_text("\n".join(sorted(existing)) + "\n")
    return len(normalised)


def classify_paths(paths: Iterable[str]) -> Classification:
    code: list[str] = []
    semantic: list[str] = []
    clean: list[str] = []
    ignored: list[str] = []
    missing: list[str] = []

    for path in sorted(set(paths)):
        rel = Path(path)
        if path in CLEAN_REBUILD_FILES:
            clean.append(path)
            continue
        if path in IGNORED_FILES or path.startswith(IGNORED_PREFIXES) or rel.suffix in BULKY_SUFFIXES:
            ignored.append(path)
            continue
        if not (PROJECT_ROOT / path).exists():
            clean.append(path)
            missing.append(path)
            continue
        if path in SEMANTIC_FILES or path.startswith(SEMANTIC_PREFIXES):
            semantic.append(path)
            continue
        if rel.suffix in CODE_SUFFIXES:
            code.append(path)
            continue
        ignored.append(path)

    return Classification(
        code_paths=tuple(code),
        semantic_paths=tuple(semantic),
        clean_rebuild_paths=tuple(clean),
        ignored_paths=tuple(ignored),
        missing_paths=tuple(missing),
    )


def _touch_marker(path: Path, reason_lines: Iterable[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    content = "\n".join(reason_lines)
    path.write_text(content + ("\n" if content else ""))


def _graphify_update_command() -> list[str]:
    graphify = shutil.which("graphify")
    if graphify:
        return [graphify, "update", "."]
    return [sys.executable, "-m", "graphify", "update", "."]


def _git_commit_mtime(path: str) -> float | None:
    result = subprocess.run(
        ["git", "log", "-1", "--format=%ct", "--", path],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0 or not result.stdout.strip():
        return None
    try:
        return float(result.stdout.strip())
    except ValueError:
        return None


def _effective_mtime(path: str) -> float:
    """Use git last-commit time when available so CI and local checks agree."""
    git_mtime = _git_commit_mtime(path)
    if git_mtime is not None:
        return git_mtime
    return (PROJECT_ROOT / path).stat().st_mtime


def _manifest_entries() -> dict[str, float]:
    if not SHARED_MANIFEST.exists():
        return {}
    try:
        raw = json.loads(SHARED_MANIFEST.read_text())
    except json.JSONDecodeError:
        return {}

    entries: dict[str, float] = {}
    if not isinstance(raw, dict):
        return entries

    for path, metadata in raw.items():
        normalised = _normalise_path(path)
        if not normalised:
            continue
        if isinstance(metadata, dict):
            mtime = metadata.get("mtime", 0)
        else:
            mtime = metadata
        try:
            entries[normalised] = float(mtime)
        except (TypeError, ValueError):
            entries[normalised] = 0.0
    return entries


def check_stale() -> StaleCheck:
    entries = _manifest_entries()
    missing: list[str] = []
    newer: list[str] = []

    for path, manifest_mtime in sorted(entries.items()):
        absolute = PROJECT_ROOT / path
        if not absolute.exists():
            missing.append(path)
            continue
        current_mtime = _effective_mtime(path)
        if manifest_mtime <= 0 or current_mtime > manifest_mtime + 1:
            newer.append(path)

    return StaleCheck(
        missing_paths=tuple(missing),
        newer_paths=tuple(newer),
        report_exists=SHARED_REPORT.exists(),
    )


def refresh_manifest(paths: Iterable[str] | None = None) -> dict[str, dict[str, str | float]]:
    tracked = sorted(
        {
            p
            for path in (paths or MANIFEST_PATHS)
            if (p := _normalise_path(path)) and (PROJECT_ROOT / p).exists()
        }
    )
    payload = {
        path: {
            "mtime": _effective_mtime(path),
            "ast_hash": "",
            "semantic_hash": "",
        }
        for path in tracked
    }
    GRAPH_DIR.mkdir(parents=True, exist_ok=True)
    SHARED_MANIFEST.write_text(json.dumps(payload, indent=2) + "\n")
    return payload


def flush(run_graphify: bool = True) -> Classification:
    paths = read_recorded_paths()
    classification = classify_paths(paths)

    if classification.clean_rebuild_paths:
        if SEMANTIC_MARKER.exists():
            SEMANTIC_MARKER.unlink()
        _touch_marker(
            CLEAN_REBUILD_MARKER,
            [
                "Clean Graphify rebuild needed.",
                "Reason: graph scope changed, files disappeared, or rebuild-sensitive files changed.",
                "Run `graphify .` or `graphify extract .`, then commit graphify-out/GRAPH_REPORT.md and graphify-out/manifest.json only.",
                "Paths:",
                *classification.clean_rebuild_paths,
            ],
        )
    elif classification.semantic_paths:
        _touch_marker(
            SEMANTIC_MARKER,
            [
                "Semantic Graphify update needed.",
                "Run intentionally: /graphify . --update",
                "Paths:",
                *classification.semantic_paths,
            ],
        )

    if run_graphify and classification.code_paths and not classification.clean_rebuild_paths:
        subprocess.run(_graphify_update_command(), cwd=PROJECT_ROOT, check=False)

    if CHANGED_FILES.exists():
        CHANGED_FILES.unlink()
    return classification


def status_text() -> str:
    paths = read_recorded_paths()
    classification = classify_paths(paths)
    stale = check_stale()
    lines = [
        f"recorded_paths={len(paths)}",
        f"code_paths={len(classification.code_paths)}",
        f"semantic_paths={len(classification.semantic_paths)}",
        f"clean_rebuild_paths={len(classification.clean_rebuild_paths)}",
        f"ignored_paths={len(classification.ignored_paths)}",
        f"semantic_marker={SEMANTIC_MARKER.exists()}",
        f"clean_rebuild_marker={CLEAN_REBUILD_MARKER.exists()}",
        f"report_exists={stale.report_exists}",
        f"manifest_missing_paths={len(stale.missing_paths)}",
        f"manifest_newer_paths={len(stale.newer_paths)}",
    ]
    return "\n".join(lines)


def stale_text(stale: StaleCheck) -> str:
    lines = [
        f"report_exists={stale.report_exists}",
        f"manifest_missing_paths={len(stale.missing_paths)}",
        f"manifest_newer_paths={len(stale.newer_paths)}",
    ]
    if stale.missing_paths:
        lines.append("missing:")
        lines.extend(stale.missing_paths)
    if stale.newer_paths:
        lines.append("newer:")
        lines.extend(stale.newer_paths)
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Maintain the project Graphify architecture map.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    record_parser = subparsers.add_parser("record", help="Record changed file paths.")
    record_parser.add_argument("paths", nargs="*")
    record_parser.add_argument("--from-hook", action="store_true", help="Read hook JSON from stdin.")

    flush_parser = subparsers.add_parser("flush", help="Classify changes and update/mark graph state.")
    flush_parser.add_argument("--hook", action="store_true", help="Never fail the caller when used from hooks.")
    flush_parser.add_argument("--no-update", action="store_true", help="Classify only; do not run graphify update.")

    subparsers.add_parser("status", help="Print pending graph maintenance state.")
    subparsers.add_parser("check-stale", help="Fail if shared Graphify artifacts are missing or stale.")
    subparsers.add_parser(
        "refresh-manifest",
        help="Rewrite graphify-out/manifest.json using git commit times (or file mtimes).",
    )

    args = parser.parse_args(argv)

    try:
        if args.command == "record":
            paths = list(args.paths)
            if args.from_hook:
                paths.extend(paths_from_hook_stdin(sys.stdin.read()))
            count = record_paths(paths)
            print(f"recorded={count}")
            return 0
        if args.command == "flush":
            classification = flush(run_graphify=not args.no_update)
            print(
                "flushed "
                f"code={len(classification.code_paths)} "
                f"semantic={len(classification.semantic_paths)} "
                f"clean_rebuild={len(classification.clean_rebuild_paths)} "
                f"ignored={len(classification.ignored_paths)}"
            )
            if classification.clean_rebuild_paths:
                print("Run `graphify .` or `graphify extract .`, then commit graphify-out/GRAPH_REPORT.md and graphify-out/manifest.json only.")
            return 0
        if args.command == "status":
            print(status_text())
            return 0
        if args.command == "check-stale":
            stale = check_stale()
            print(stale_text(stale))
            return 0 if stale.report_exists and not stale.missing_paths and not stale.newer_paths else 1
        if args.command == "refresh-manifest":
            payload = refresh_manifest()
            print(f"refreshed_paths={len(payload)}")
            return 0
    except Exception as exc:  # pragma: no cover - hook safety fallback
        print(f"graphify maintenance failed: {exc}", file=sys.stderr)
        return 0 if getattr(args, "hook", False) else 1
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
