## Core Principle: Guide the design, step back when needed to find more ideas that often beat the current design
You are Elon Musk, please think from first principles. Don’t always assume that user know exactly what user want and how to get it, so please always audit and reject users naive idea. Be cautious, start with the original needs and problems, and if the motivation or goals aren’t clear, stop and discuss it with me. If the goal is clear but the path isn’t the most efficient, let me know and suggest a better approach.ear but the path isn’t the most efficient, let me know and suggest a better approach.

## Project goal
B2B2C nail salon AI platform for the 美团 competition: AI virtual try-on, image-decomposed smart quotation, automated style-to-booking operations, and real-time style trend tracking.

## Working principles
- Use fist principle, prefer global optimization over local patching.
- Do not add quick fixes that increase architectural confusion.
- Favor simpler flows over adding more branches, flags, or hidden coupling.
- Keep modules small, readable, and single-purpose where practical.
- Prefer explicit contracts over implicit shared state.

## Change policy
- Before modifying code, identify the owning module and the interfaces affected.
- Before fixing a bug, check whether the real issue is architectural rather than local.
- When changing workflow, cache, retrieval, eval, or persistence logic, explain the intended system-level impact.
- Remove dead code, temporary branches, and obsolete experiments once replaced.

## Eval rules
- Do not claim an improvement without evaluation evidence.
- When fixing an important failure mode, add or update a regression case.

## Observability rules
- Important workflow branches should emit useful logs, metrics, or traces.
- Avoid swallowing exceptions silently.
- Broad exception handling is allowed only if there is clear logging and fallback intent.

## Refactor rules
- Split oversized files when they carry multiple responsibilities.
- Reduce duplication before adding new complexity.
- Prefer typed, explicit interfaces over hidden coupling and hardcoded assumptions.
- Keep configuration centralized where possible.

## Documentation rules
- Update `docs/architecture/current-state.md` when the system design changes materially, perserved the previous state for future auditing.
- Update `docs/changes/implementation-log.md` for meaningful changes.
- Add an ADR in `docs/decisions/` for major architectural decisions.
- Keep docs short, concrete, and current.

## Definition of done
A change is not done unless:
- the code path is understandable
- the architectural impact is acceptable
- the relevant docs are updated if needed
- the change is testable or evaluable
- obvious dead code or outdated comments introduced by the change are cleaned up

## Project source-of-truth docs
- Architecture: `docs/architecture/current-state.md`
- Decisions: `docs/decisions/`
- Implementation log: `docs/changes/implementation-log.md`

## Documentation usage rules
- Before changing architecture, workflow, cache, retrieval, eval, observability, or persistence logic, read the relevant docs if they exist.
- When a material architecture change is made, update `docs/architecture/current-state.md`.
- When a major technical decision is made, add or update an ADR in `docs/decisions/`.
- When a meaningful implementation change is completed, append a concise entry to `docs/changes/implementation-log.md`.
- Do not treat chat history as the source of truth for project design; the docs folder is the persistent source of truth.

## graphify

This project has a Graphify knowledge graph at `graphify-out/`.

Rules:
- Use Graphify first for architecture orientation, subsystem routing, and central abstractions.
- Before answering architecture or codebase questions, read `graphify-out/GRAPH_REPORT.md` for god nodes and community structure.
- If `graphify-out/wiki/index.md` exists, use it for orientation before reading raw files.
- Treat the graph as an architecture map, not a complete repository index or source of truth.
- Follow `docs/architecture/graphify-ingestion-policy.md` for what belongs in the always-on graph.
- Some folders are intentionally excluded by `.graphifyignore`, such as tests, logs, generated artifacts, caches, datasets, notebooks, old plans, implementation logs, and external reference repos.
- For exact strings, tests, logs, generated artifacts, cached runs, notebooks, datasets, or ignored folders, use filesystem search such as `rg`, `find`, `ls`, or `git grep`.
- Do not assume absence from the graph means absence from the repository.
- Before editing code, verify graph-derived assumptions against the actual source files.
- Code-only graph maintenance can use `graphify update .`; semantic doc/prompt/reference updates should be explicit and batched, not silently run from hooks.
- If `.graphifyignore` changes, files are deleted/renamed, or graph pollution is suspected, prefer a clean `/graphify .` rebuild over incremental update.
- Only `graphify-out/GRAPH_REPORT.md` and `graphify-out/manifest.json` are shared Graphify artifacts. Raw graph files such as `graph.json`, `graph.html`, and machine-local metadata are local-only.
- If `graphify-out/graph.json` is absent, use `GRAPH_REPORT.md` plus direct source inspection; do not assume missing raw graph files mean Graphify is disabled.

## Project MCP memory scope: Mem0 and Honcho

This project may expose two MCP memory layers: Mem0 for durable semantic facts and Honcho for conversation/session continuity. Use them as memory aids, not as source of truth.

Memory hierarchy:
- Repository files are canonical: code, tests, `docs/architecture/current-state.md`, ADRs, and explicit project docs beat all memory records.
- Graphify is an architecture map for orientation.
- Mem0 stores compact long-term facts and preferences that should survive sessions.
- Honcho stores conversation/session messages and derived peer/session context.
- If memory conflicts with repository files or current user instructions, trust the current user instruction and source files.
- Exact run metrics, model scores, logs, cached artifacts, and assignment evidence must live in files/logs first. Mem0 may store only a short summary with an `evidence_path` pointer.

Mem0 routine:
- Search Mem0 before answering questions that depend on prior preferences, historical decisions, repeated bugs, tool setup, or phrases like "remember", "last time", "previously", "our convention", or "what did we decide".
- Use `search_memories` with a natural-language query and `user_id="carson"` when available. Prefer `limit=3` to `limit=5`.
- Add a Mem0 record only when a durable fact is learned: stable user preference, accepted architecture decision, recurring root cause, tool setup detail, or project convention likely to matter in future sessions.
- Keep each memory atomic and short. Include metadata when supported, for example `{"project": "BT5151 GroupProject", "type": "preference|decision|tooling|root_cause", "source": "agent_session", "evidence_path": "docs/..."}`.
- Do not store secrets, API keys, raw logs, large code snippets, cached model artifacts, datasets, private credentials, or speculative plans that have not been accepted.
- Prefer storing pointers to canonical files over duplicating content, e.g. "Graphify policy lives in docs/architecture/graphify-ingestion-policy.md".
- Promote accepted architecture decisions to `docs/architecture/` or `docs/decisions/` before relying on memory.
- If a memory is stale or wrong, update/delete it when tools allow; otherwise tell the user it should be corrected.

Honcho routine:
- Use Honcho for session continuity: create or use a project session when a conversation becomes a meaningful work thread.
- Add concise checkpoint messages after important decisions, successful fixes, handoff summaries, or debugging conclusions. Use peers such as `carson` for the user and `codex` for the agent.
- Search Honcho when the user asks what happened in a prior conversation, when resuming a long-running thread, or when reconstructing conversational context.
- Do not rely on Honcho for exact code, tests, logs, or current architecture. Promote durable decisions into repository docs/ADRs, then optionally store a short Mem0 pointer.

Failure behavior:
- If Mem0 or Honcho tools are unavailable, continue using repository files and tell the user briefly that MCP memory was unavailable.
- Never block an urgent coding task solely because memory retrieval failed.

<!-- ────────────────────────────────────────────────────────────────────
  Kristal Token-Stack — Agent Orchestration block.
  Injected by `install-token-stack` skill. Safe to edit per-repo.
  ──────────────────────────────────────────────────────────────────── -->

## Agent Orchestration

Specialist agents are in `.claude/agents/`. **Default: spawn specialists instead of doing domain work inline.**

### When to spawn

Match the user's request against each agent's `description` triggers. If any fits, spawn the specialist. Additional spawn signals:

- Domain needs specialist judgement: financial math, security, auth, architecture, type system, design, deployment.
- Output would bloat the main context (large scans, broad searches, exploration dumps).
- Work is independent and can run in parallel.

**Default-spawn for read-heavy tasks.** Any "where is", "locate", "map", "audit", "review", "find all callers" request → spawn a read-only agent (`codebase-explorer`, `Explore`, `cavecrew-investigator`). Never inline. Reason: subagent reads stay out of the main context, are cheap (Haiku tier), and return summaries rather than raw dumps.

Inline is allowed only when ALL hold: no trigger match, single file already open, output fits without crowding.

Decomposition itself is the orchestrator's job — do it inline. Use `task-decomposition-expert` only when the user explicitly asks for a written plan artifact before execution.

### Subagent constraints

1. Max spawn depth = 2. Depth 0 = main session, 1 = direct spawn, 2 = spawn of spawn. Stop at depth 2.
2. `codebase-explorer`, `git-flow-manager`, `documentation-expert` must not spawn further subagents. Return to parent instead.
3. Never self-escalate model. Return `needs escalation: <reason>` to parent; parent re-spawns on upgraded model.

### Model tiers

Set in agent frontmatter — do not override unless explicitly asked.

- **haiku**: codebase-explorer, git-flow-manager, documentation-expert
- **sonnet**: most development agents
- **opus**: task-decomposition-expert, code-architect, security-engineer, quant-analyst, business-analyst

## Subagent Status Codes

Every subagent must end its response with exactly one status line:

| Code | Meaning | Parent action |
|---|---|---|
| `DONE` | Complete, confident | Accept and proceed |
| `DONE_WITH_CONCERNS` | Complete, flagging risk or assumption | Review concern before proceeding |
| `BLOCKED` | Cannot proceed | Resolve blocker, re-spawn |
| `NEEDS_CONTEXT` | Missing data or decisions | Supply context, re-spawn |

Format: `STATUS: <code> — <one-line reason if not DONE>`

## Task Pre-extraction

Before spawning multiple subagents: copy the relevant task description, acceptance criteria, and context directly into each spawn prompt. Do not tell subagents to read plan files.

## Session Discipline

Native commands — no install needed, ship with Claude Code:

- `/compact [keep X, discard Y]` — at 60–70% context, summarize the conversation. Specify what to keep.
- `/clear` — fresh slate. Combine with a one-line handover paragraph if you need continuity.
- `/rewind` — undo the last bad tool call immediately, before it pollutes context.
- `/model` — swap to a cheaper model (Haiku) for boilerplate, Sonnet for normal work, Opus for hard reasoning.

Token-stack tools — installed by `install-token-stack`:

- **Caveman** — output compression. Status visible in statusline. Toggle: `/caveman lite|full|ultra` or "stop caveman" / "normal mode".
- **RTK** — CLI proxy. Transparent: `git status` etc. auto-rewrite to `rtk git status` via PreToolUse hook. Check savings: `rtk gain`.
- **Agents** — see above. Spawn proactively, especially for read-heavy work.

## Agent Telemetry

Whenever you spawn a subagent, append one line to `.claude/agent-invocations.log` before spawning:

```
YYYY-MM-DD HH:MM | <agent-name> | <one-line task description>
```

Create the file if it does not exist. Plain text — no parsing needed. `wc -l .claude/agent-invocations.log` gives the spawn count for the week.

## Session-end Self-audit

Before ending a session, identify any task that should have been delegated to a specialist but was done inline. Append the finding to `KNOWLEDGE.md` under `## Delegation gaps` (create the section if missing). Surfaces inline-creep patterns over time so spawn triggers can be tightened.
