# Architectural Decision Records (ADRs)

Records of the major design calls that shape the Nailed-it codebase. Each ADR captures the *why* behind a decision so a future change does not unknowingly trample on the reasoning.

## When to write an ADR

Write one when a decision will shape **multiple future patches**:

- Pipeline choices (e.g. "Qwen-VL is the primary image decomposition path")
- Where logic lives (e.g. "quotation runs in the backend, not the frontend")
- Workflow contracts (e.g. "style-to-booking mapping is mandatory before slot lock")
- Cross-cutting choices (e.g. "AR try-on uses client-side inference, not server round-trip")

Localised fixes / UX iterations belong in `docs/changes/PATCHES.md`, not here.

## Template

```markdown
# ADR XXXX: <short title>

**Status:** Proposed | Accepted | Superseded by ADR-YYYY
**Date:** YYYY-MM-DD

## Context

What problem are we solving? What constraints are in play?

## Decision

What did we decide? Be specific.

## Design principles

What deeper principle (first-principles, separation of concerns, etc.) drove this choice?

## Alternatives considered

Briefly: what else did we look at and why we rejected it.

## Consequences

**Positive**

**Negative**

## References

Related patches in `docs/changes/PATCHES.md`, related ADRs, external docs.
```

## File naming

`ADR-####-short-title-in-kebab-case.md` — zero-padded sequential. Once assigned, the number is frozen. If a decision is reversed, write a new ADR that supersedes the old one rather than editing history.
