# Architecture: Current State

Last updated: 2026-05-19

Nailed-it is currently a scaffolded repository. The previous BT5151 application code and generated Graphify map have been removed from the active architecture surface; this document now records the current source of truth until product code is added.

## Pipeline

No runtime application pipeline exists yet.

## Key modules

- `AGENTS.md` and `CLAUDE.md`: project-level agent guidance.
- `.claude/settings.json` and `.codex/hooks.json`: agent hook configuration for Graphify orientation and maintenance.
- `scripts/graphify_maintenance.py`: hook-safe Graphify change classifier and updater.
- `docs/architecture/graphify-ingestion-policy.md`: canonical Graphify scope, exclusions, and maintenance policy.
- `graphify-out/GRAPH_REPORT.md` and `graphify-out/manifest.json`: shared Graphify orientation artifacts; raw graph files are local-only.

## LLM integration

No product LLM integration exists yet. Current LLM-related behavior is limited to agent guidance and Graphify semantic extraction, which must be run intentionally rather than from hooks.