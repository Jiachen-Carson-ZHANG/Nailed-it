#!/usr/bin/env python3
"""Scan docs/changes/PATCHES.md and return next-available ID per area+kind.

Usage:
  python scan_ids.py [path/to/PATCHES.md]

Defaults to docs/changes/PATCHES.md relative to the project root (inferred as
the parent of the .claude/ folder containing this script).

Output: JSON like
  {"UI-E": {"max": 10, "next": "UI-E11"}, "AI-F": {"max": 4, "next": "AI-F5"}, ...}

Areas are project-specific — edit the AREAS tuple to match your project's
classification scheme. Kinds: E (Enhancement), F (Feature).
"""
import json, re, sys
from pathlib import Path

AREAS = ("UI", "API", "AI", "DOC", "TEC")
KINDS = ("E", "F")

def find_patches_md(arg=None):
    if arg:
        return Path(arg)
    # Walk up from this script to find the project root (has docs/changes/PATCHES.md)
    here = Path(__file__).resolve()
    for parent in [here] + list(here.parents):
        candidate = parent / "docs" / "changes" / "PATCHES.md"
        if candidate.exists():
            return candidate
    raise SystemExit("Could not locate docs/changes/PATCHES.md — pass explicitly")

def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    p = find_patches_md(arg)
    text = p.read_text()
    pattern = re.compile(r"^### ([A-Z]+)-([EF])(\d+)", re.MULTILINE)
    max_per = {}
    for area, kind, num in pattern.findall(text):
        key = f"{area}-{kind}"
        max_per[key] = max(max_per.get(key, 0), int(num))
    # Ensure every (area, kind) appears even if absent
    out = {}
    for area in AREAS:
        for kind in KINDS:
            key = f"{area}-{kind}"
            m = max_per.get(key, 0)
            out[key] = {"max": m, "next": f"{area}-{kind}{m + 1}"}
    print(json.dumps(out, indent=2))

if __name__ == "__main__":
    main()
