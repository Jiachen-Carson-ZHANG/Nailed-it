# Documentation discipline

- When a material architecture change is made, update `docs/architecture/current-state.md`.
- When a major technical decision is made about RAG, cache, eval, observability, workflow, or storage, add or update an ADR in `docs/decisions/`.
- When a meaningful implementation change is completed, append a concise entry to `docs/changes/implementation-log.md`.
- Do not treat chat history as the source of truth for architecture; the docs folder is the source of truth.
- Prefer small, current docs over large stale docs.
