---
name: go
description: This skill should be used when the user invokes "/go" followed by a feature request, task description, or bug to fix. Plans the work (deciding autonomously whether to proceed or pause for approval), implements it, invokes the simplify skill to clean up, then reviews the result against general engineering rules and applies fixes for Critical and High findings.
disable-model-invocation: true
argument-hint: [feature request or task description]
allowed-tools: Read, Write, Edit, Grep, Glob, Bash(git:*), Bash(ls:*), Bash(test:*), Agent
---

# /go — Plan, Build, Simplify, Review

Execute the user's request in `$ARGUMENTS` through four sequential phases. Track progress with TaskCreate — one task per phase, mark completed as each finishes. Do not skip phases.

## Phase 1 — Plan

Analyze `$ARGUMENTS` and produce an implementation plan covering: goal, files likely to change, approach, risks, test strategy.

Then decide autopilot vs. approval based on complexity and blast radius.

**Proceed autonomously when ALL hold:**
- Scope is concrete and unambiguous
- Touches ≤ 3 files, no shared infrastructure, no public API surface
- No destructive ops (deletions, migrations, force-push, dependency removals, schema changes)
- Existing tests cover the area, or the change is small enough that a smoke check suffices
- One obviously-correct approach exists

**Pause for approval when ANY hold:**
- Requirements are ambiguous or have multiple valid interpretations
- Touches > 3 files, shared modules, public APIs, data layer, CI/config, or dependencies
- An architectural decision is required (which layer, which abstraction, which framework feature)
- Risk of data loss, breaking changes, or security impact
- More than one reasonable approach exists and the right pick depends on user intent

State the verdict explicitly as one line:
- `Decision: autopilot — <one-line rationale>`
- `Decision: pause for approval — <what needs confirming>`

If pausing: use `EnterPlanMode` and present the plan via `ExitPlanMode` for approval. Do not edit code until approved.

## Phase 2 — Implement

Execute the plan. Apply any project conventions documented in `CLAUDE.md` or repo-level rules files. Default engineering principles:
- Readability and simplicity first; smallest correct solution
- Explicit dependencies, no hidden globals, no inline imports, no nested function definitions
- Respect the project's existing layering — keep data-access, business logic, and transport concerns separate as the codebase already does
- Delete what is no longer used; do not leave shims, aliases, or `// removed` markers
- Apply the campsite rule for genuine bugs noticed in touched files — surgical, in-scope only

If the change adds non-trivial new behavior that existing tests don't cover, delegate test creation to the `test-writer` sub-agent before verifying. Skip this for trivial edits (small refactors, doc-only changes, one-liner fixes) or when the touched area is already well covered.

Run targeted verification appropriate to the change (type check, unit tests, build, manual smoke). Do not advance to Phase 3 until verification passes.

## Phase 3 — Simplify

Call the Skill tool with `skill="simplify"`. This is mandatory — do not inline a simplify pass, do not summarise what simplify would do, do not skip it even if Phase 2 looked clean. The `simplify` skill owns this phase entirely; it will review the Phase 2 diff for reuse, quality, and efficiency and apply its own edits.

Wait for the Skill call to return before advancing to Phase 4. Treat its edits as part of the final diff that Phase 4 reviews.

## Phase 4 — Rules Review

Delegate grading to the `code-reviewer` sub-agent for an independent read. Phase 4 reviews the **final diff** (Phase 2 work + Phase 3 simplify edits).

### Delegate to code-reviewer

Spawn `code-reviewer` via the Agent tool. The agent is read-only and returns the report; it does not patch. Compose its prompt with:

- **Scope** — the final diff for `$ARGUMENTS`. Name the changed files (use `git diff --name-only main...HEAD` if unsure) and instruct the agent to read each in full plus surrounding context.
- **Rubric** — paste the "Rubric" sub-section below. The agent must grade against these 10 rules and cite `file:line` for every finding.
- **Scope discipline** — paste the "Scope discipline" sub-section below.
- **Output format** — paste the "Report format" sub-section below and instruct the agent to follow it **exactly**, overriding its default review format.

When the agent returns, print its report verbatim before doing anything else.

### Scope discipline (include in the delegation prompt)

Phase 4 reviews the **final diff**. Surface violations of the rubric AND name strengths — but neither should restate what Phase 3 simplify already addressed (Phase 5's "What was done" table catalogs that) and neither should narrate what the change does (that belongs in the commit message).

- **Findings** = rubric violations that persist in the final diff. If a Phase 3 simplify edit fully resolved an issue, it does not appear here.
- **Strengths** = positive properties of the final diff that were already true *before* Phase 3 ran, OR that emerge from the diff as a whole rather than a single Phase 3 fix. Things like: layering preserved across new modules, trust-boundary checks added at exactly the right seams, naming that follows the convention. Skip strengths that are just "Phase 3 extracted a helper" — that's a Phase 5 entry, not a Phase 4 strength.

### Rubric (include in the delegation prompt)

1. **Readability & Simplicity** — Descriptive names? Functions small, single-purpose? Control flow obvious? Clever where it should be plain?
2. **Explicit Dependencies** — Hidden wiring, global state, or implicit module coupling?
3. **Testability** — Each new unit testable without bootstrapping the whole system? Mocks/patches used where a real fixture or seam belongs?
4. **DRY / SOLID** — Duplication introduced? Single-responsibility honored? Wrappers that add no semantic value?
5. **Minimalism & Deletion-First** — Any added code that could have been deleted instead? Backward-compat shims, dead branches, "future use" scaffolding, re-exports?
6. **Campsite Discipline** — Obvious nearby bugs left unfixed? Out-of-scope churn that should not be in this change?
7. **File & Module Structure** — Cohesive modules? Imports at the top? No nested functions where a top-level helper would do?
8. **State & Lifecycle Management** — Global instances or hidden singletons? Stateful objects created through lazy initializers that obscure ownership?
9. **Boundary Discipline** — Raw/untyped data crossing service boundaries? Persistence types leaking past the data-access layer?
10. **Stack Conventions** — Idiomatic for the language/framework in use? Follows the patterns the rest of the codebase already establishes?

### Report format (include in the delegation prompt)

```
## /go review report

**Task:** $ARGUMENTS
**Files changed:** <list>
**Verdict:** Pass | Pass with fixes | Needs rework

### Findings

#### Critical (must fix before merge)
- [file:line] Rule §<n> — <issue>. Why: <impact>. Fix: <plan>.

#### High (should fix now)
- [file:line] Rule §<n> — <issue>. Fix: <plan>.

#### Medium (nice to have)
- [file:line] Rule §<n> — <issue>. Suggestion: <plan>.

### Strengths
- [file:line] Rule §<n> — <what the diff does well, in one line>.
```

If a tier (Findings or Strengths) has no entries, write `- _None._` under it. Do not omit the section headings.

### Apply fixes (main thread)

After printing the sub-agent's report, **apply fixes for every Critical and High finding** in the main thread — `code-reviewer` is read-only and does not patch. Leave Medium untouched unless the user asks. Re-run targeted verification after fixing.

## Phase 5 — Run Summary (always emit two tables)

After Phase 4's report and any applied fixes, **always** emit two Markdown tables back-to-back: a **What was done** table and a **Skipped & Deferred** table. Do not wait to be prompted; do not omit either section even if one is empty.

### Table 1 — What was done

One row per discrete change shipped in this /go run. Include every Phase 2 work unit, every fix applied in Phase 3 (simplify), and every Critical/High fix applied in Phase 4 (review).

```
## What was done

| ID | Phase | Change | Files |
|---|---|---|---|
| <id> | Implement \| Simplify \| Review | <one-line description> | <key file paths or commit ref> |
```

### Table 2 — Skipped & Deferred

One row per finding that was **not applied** in this run.

- **Skipped** rows: state only the finding. **Do not include rationale** — the user makes the final judgement call on whether the skip was correct.
- **Deferred** rows: state the finding and the trigger that should bring it back (e.g. "if a third caller appears", "after profiling shows this on a hot path"). Triggers are factual and belong here.

```
## Skipped & Deferred

| ID | Phase | Finding | Status |
|---|---|---|---|
| <id> | Simplify \| Review | <one-line finding> | Skipped |
| <id> | Simplify \| Review | <one-line finding> | Deferred — <trigger> |
```

### Rules for both tables

- One row per item. Do not repeat a finding across the two tables.
- IDs follow the simplify-skill convention (`F1`, `Q3`, `E2`, etc.) when available; otherwise pick a short stable id (`Bonus A`, `Campsite-1`).
- If either table would be empty, print the header and a single row `| – | – | _Nothing in this category._ | – |` so the absence is explicit.
- Keep entries to one line. The user will ask for depth if they want it.

End the turn with a one-sentence summary: what shipped, what remains.
