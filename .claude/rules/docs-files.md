---
paths:
  - "docs/**/*.md"
---

# Docs editing rules — formatting reference

Fires when editing anything under `docs/`. Companion to `doc-discipline.md` (procedure rule). This file covers **what to write**; doc-discipline.md covers **when to write it**.

## General

- Keep docs concise and concrete.
- Prefer current system truth over historical narration.
- Image references use standard markdown `![](../screenshots/name.png)` from `docs/changes/`. Standard markdown renders in both Obsidian and GitHub.
- Cross-doc links use standard markdown `[label](FILE.md)` — not Obsidian wiki-links.

## ADRs in docs/decisions/

Follow the template in `docs/decisions/README.md`: Context · Decision · Design principles · Alternatives considered · Consequences (positive / negative) · References.

File naming: `ADR-####-short-title-in-kebab-case.md`. Zero-padded sequential. ADR numbers are frozen — never renumber. If a decision is reversed, write a new ADR that supersedes the old one rather than editing history.

## Architecture snapshot

`docs/architecture/current-state.md` is the current system shape. When the design changes materially:

1. Move the current "Pipeline shape" / "Subsystems" content into a `## Previous (YYYY-MM-DD)` section at the bottom.
2. Write the new state at the top.

This preserves the diff trail for future audits.
