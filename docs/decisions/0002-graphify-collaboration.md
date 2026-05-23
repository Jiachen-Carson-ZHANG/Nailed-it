# ADR 0002: Commit Graphify Report and Manifest Only

**Status:** Accepted
**Date:** 2026-05-19

## Context

The repository was migrated with Graphify artifacts from an older BT5151 codebase. Those artifacts referenced deleted source files, absolute paths from another machine, and obsolete architectural concepts. Keeping raw generated graph files in git also creates noisy diffs and merge conflicts for collaborators.

## Decision

The shared Graphify contract for Nailed-it is:

- Commit `graphify-out/GRAPH_REPORT.md` and `graphify-out/manifest.json`.
- Do not commit raw or machine-local generated artifacts such as `graph.json`, `graph.html`, `.graphify_python`, `.graphify_labels.json`, `.graphify_root`, `cost.json`, or cache files.
- Use `graphify update .` for cheap code-only updates.
- Run semantic Graphify updates intentionally when architecture docs, ADRs, runtime prompts, skills, or agent rules change.
- Use `scripts/graphify_maintenance.py check-stale` in CI to catch missing files and stale shared artifacts.

## Design principles

- Repository files remain the source of truth.
- Graphify is an orientation map, not a full repository index or test oracle.
- Shared artifacts should be small, reviewable, and portable across developer machines.
- Token-spending semantic extraction should be explicit and visible in PRs.

## Alternatives considered

- Commit all of `graphify-out/`: rejected because raw graph files are large, generated, and can include local absolute paths.
- Ignore all of `graphify-out/`: rejected because agents and collaborators benefit from a shared orientation report.
- Commit only `GRAPH_REPORT.md`: rejected because `manifest.json` is useful for staleness checks.

## Consequences

**Positive**

- Collaborators get the same high-level architecture orientation.
- Raw graph merge conflicts and machine-specific metadata are avoided.
- CI can verify that the shared report still corresponds to real files.

**Negative**

- Developers who need `graph.json` or `graph.html` must regenerate them locally.
- A report refresh step is required after meaningful architecture or graph-scope changes.

## References

- `docs/architecture/graphify-ingestion-policy.md`
- `scripts/graphify_maintenance.py`
- `graphify-out/README.md`
