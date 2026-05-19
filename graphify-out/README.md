# Graphify Artifacts

This directory holds the shared Graphify orientation artifacts for Nailed-it.

Python: use **3.10 or newer** (`requires-python = ">=3.10"` in `pyproject.toml`). Local tools such as pyenv/asdf can read `.python-version` (`3.10`). CI runs on 3.10 to validate the minimum supported version.

Committed:
- `GRAPH_REPORT.md`
- `manifest.json`

Local-only:
- `graph.json`
- `graph.html`
- `.graphify_python`
- `.graphify_labels.json`
- `.graphify_root`
- `cost.json`
- `.semantic_update_needed`
- `.needs_clean_rebuild`
- `cache/`

Run `graphify update .` after code-only changes when a local graph exists. Run a clean `graphify .` after `.graphifyignore` changes, deleted or renamed files, graph scope changes, or suspected graph pollution.

Semantic updates for architecture docs, ADRs, prompts, skills, or references must be intentional. Run `/graphify . --update` only when the team wants to refresh semantic graph content, then commit the regenerated `GRAPH_REPORT.md` and `manifest.json` only.

For PRs, after changing tracked architecture or tooling files:

```bash
python scripts/graphify_maintenance.py refresh-manifest
python scripts/graphify_maintenance.py check-stale
```

If `check-stale` still fails, refresh `GRAPH_REPORT.md` with `graphify update . --force` (local only), then commit the updated report and manifest.

See `docs/architecture/graphify-ingestion-policy.md` for the full policy.
