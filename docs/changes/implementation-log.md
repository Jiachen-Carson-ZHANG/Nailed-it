# Implementation Log

## Date - Wave

**Context:** 

**Changes ():**

**Verification:**

**Must remain true:**

## 2026-05-19 - Graphify Collaboration Refresh

**Context:** Migrated Graphify artifacts described the old BT5151 codebase and included machine-local paths, making agent orientation misleading in the Nailed-it scaffold.

**Changes (Graphify governance):**
- Removed stale raw graph artifacts from the shared commit surface and made them local-only.
- Rebuilt the shared report for the current scaffold with a zero-token AST update.
- Added a report-and-manifest-only collaboration policy, stale-check tooling, CI validation, and an ADR.

**Verification:**
- `graphify update . --force`
- `python scripts/graphify_maintenance.py check-stale`
- `python -m pytest tests/test_graphify_maintenance.py`

**Must remain true:** `GRAPH_REPORT.md` and `manifest.json` are the only committed Graphify outputs; raw graph files remain local-only and semantic extraction is intentional.

## 2026-05-19 - Python Version Contract

**Context:** Collaborators may use different local Python installs; the repo had no declared minimum version.

**Changes (tooling):**
- Added `pyproject.toml` with `requires-python = ">=3.10"`.
- Added `.python-version` (`3.10`) for pyenv/asdf defaults.
- Documented the contract in `graphify-out/README.md`; CI continues to run on 3.10 as the minimum supported version.

**Verification:**
- `python -m pytest tests/test_graphify_maintenance.py`

**Must remain true:** Repository tooling and maintenance scripts target Python 3.10+; CI validates the floor on 3.10.