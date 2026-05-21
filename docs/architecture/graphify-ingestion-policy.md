# Graphify Ingestion Policy

Graphify is the project architecture map for coding agents. It is not a full repository index, source of truth, test oracle, or replacement for source inspection.

## Canonical Graph Scope

Use one narrow always-on graph at `graphify-out/`. It should contain stable architecture sources:

- Runtime source code and top-level entrypoints.
- Runtime prompts and skills that influence behavior.
- Current architecture docs and ADRs.
- Agent instruction files such as `AGENTS.md` and `CLAUDE.md`.
- Core configuration files that define runtime architecture.

Temporary broader graphs are allowed for forensic investigations, but durable findings should be promoted into current architecture docs or ADRs before entering the canonical graph.

## Shared Artifacts

Commit only the human-readable report and manifest:

- `graphify-out/GRAPH_REPORT.md`
- `graphify-out/manifest.json`

Keep raw and machine-local outputs out of git:

- `graphify-out/graph.json`
- `graphify-out/graph.html`
- `graphify-out/.graphify_python`
- `graphify-out/.graphify_labels.json`
- `graphify-out/.graphify_root`
- `graphify-out/cost.json`
- `graphify-out/cache/`

This keeps collaborators aligned on the architecture summary without forcing large generated files, absolute local paths, or machine-specific Graphify metadata into shared history.

## Exclusions

Exclude generated and runtime-heavy material from the canonical graph:

- Tests, unless a future decision intentionally makes them part of the architecture graph.
- Logs, caches, generated runs, model artifacts, datasets, notebooks, binaries, and archives.
- Copied external repositories, submission bundles, backups, and stale notes.
- Raw plans, chronological implementation logs, and old discussion dumps.

These sources remain useful, but agents should inspect them with `rg`, `find`, `ls`, `git grep`, or direct file reads when needed.

## Maintenance Rules

Use `graphify update .` for code-only AST updates. This is cheap and should not use LLM/API tokens.

Use `/graphify . --update` intentionally for curated semantic updates to architecture docs, ADRs, runtime prompts, skills, or references.

Use a clean `/graphify .` rebuild after `.graphifyignore` changes, deleted or renamed files, graph scope changes, or suspected graph pollution.

Do not silently run semantic extraction from hooks. Hooks may run code-only AST updates or mark semantic staleness, but LLM-backed semantic extraction must be intentional.

For multi-person work, the PR author refreshes `GRAPH_REPORT.md` and `manifest.json` when changing architecture docs, ADRs, runtime prompts, skills, agent instructions, or graph scope. CI may run `python scripts/graphify_maintenance.py check-stale` to catch missing files and stale manifests.

## Agent Usage

Agents should read `graphify-out/GRAPH_REPORT.md` for orientation before architecture/codebase work, then verify assumptions against actual source files before editing. If local `graph.json` is missing, use the shared report and source files; do not assume the raw graph is committed.

Absence from the graph does not mean absence from the repository. The graph is deliberately scoped.
