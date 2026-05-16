# Agent Harness Starter

This folder is a reusable agent harness copied from the BT5151 project. It is meant to seed a new project with collaboration rules, architecture documentation habits, Graphify orientation, and lab notes from the original project.

It intentionally does not include the runnable BT5151 application code, datasets, model caches, generated preprocessing/feature-engineering workspaces, bulk run logs, virtual environments, external reference repos, or private environment files.

## Included

- `AGENTS.md` and `CLAUDE.md` for agent/project instructions
- `.claude/` reusable rules and shared settings
- `.codex/hooks.json` for Graphify-aware context reminders
- `docs/` architecture, decisions, plans, and implementation log
- `lab/analysis/` and `lab/experiments/` for reasoning and run-history notes
- `graphify-out/` core graph artifacts, excluding cache files
- Graphify maintenance helper and test

## First Use In A New Project

1. Review `AGENTS.md` and `CLAUDE.md` and remove BT5151-specific wording.
2. Update `docs/architecture/current-state.md` to describe the new system.
3. Keep `docs/decisions/` for accepted architecture decisions.
4. Keep `docs/changes/implementation-log.md` for meaningful changes.
5. Rebuild Graphify after replacing project-specific code or docs.
