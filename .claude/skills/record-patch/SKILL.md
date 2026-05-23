---
name: record-patch
description: Record a visual UX change in the Nailed-it project by capturing before/after screenshots via Playwright (with git-stash-and-restore for the "before" state) and atomically writing PATCHES.md + CHANGELOG.md + BACKLOG.md in the correct dependency order. Invoke ONLY for Bucket A patches — visual UX changes where a screenshot surfaces the diff (button moved, panel layout, new modal, color/spacing/typography). For non-visual user-facing patches (CLI flag, API contract, error text), follow the native path in `.claude/rules/doc-discipline.md` instead — it writes the same three files without the Playwright orchestration. Triggers on phrases like "record this patch" / "log this change" / "ship this patch" combined with visual context (UX, screenshot, before/after, modal, layout). Use this skill — do not write the entry freehand — because the hard parts (capturing the "before" state when the patch is already in the working tree, generating GitHub-style anchors, keeping the CHANGELOG bullet's link in sync with the PATCHES anchor) all benefit from atomic skill-level orchestration.
---

# record-patch

Single entry point for recording a **visual UX change** in the Nailed-it project. Captures before/after screenshots, then writes PATCHES.md + CHANGELOG.md + BACKLOG.md atomically.

**This skill is Bucket A only.** For non-visual user-facing patches, use the native path in `.claude/rules/doc-discipline.md` — it writes the same three files without the Playwright dance. See `doc-discipline.md` for the bucket-classification rule.

**Why a skill, not a template:** the hard part isn't writing the markdown — it's capturing the "before" state when the patch has already been applied to the working tree. The skill exists for the screenshot orchestration. The text formatting (per-entry template · anchor format · area heading map · Index row · CHANGELOG bullet) lives in `.claude/rules/docs-files.md` and activates automatically when you write under `docs/`.

## When to invoke

A visual UX change has just shipped. The frontend is runnable locally. A before/after screenshot pair would clarify what changed for a future reader.

## When to refuse / route elsewhere

| Situation | Action |
|---|---|
| Patch is non-visual (CLI flag, API shape, log text) | Refuse → tell user to follow the native path in `doc-discipline.md` |
| Patch is internal-only (refactor, log message, dep bump) | Refuse → skip patch tracking entirely (Bucket C) |
| Frontend not running and cannot start | Refuse → ask user to start the dev server first |
| Working tree has uncommitted unrelated changes that would conflict with `git stash pop` | Refuse → ask user to commit or stash unrelated work first |

## The five-step workflow

### Step 1 — Scan IDs

```bash
python3 .claude/skills/record-patch/scripts/scan_ids.py
```

Returns JSON keyed by `<AREA>-<KIND>`. The `next` value is the only valid choice. Frozen-ID rule: never renumber existing entries. See `docs-files.md` for ID conventions.

### Step 2 — Confirm classification + gather content

Surface the four classification fields and propose defaults from conversation context. Ask the user to confirm or override:

| Field | Choices | How to pick |
|---|---|---|
| **Area** | UI · API · AI · DOC · TEC | See area heading map in `docs-files.md`. |
| **Type** | Enhancement OR Feature | **Feature** = new capability that did not exist before. **Enhancement** = existing capability behaves differently / looks better. Default Enhancement when unsure. |
| **Priority** | P0 / P1 / P2 / P3 | **P0** blocks compliance / wrong numbers · **P1** blocks user workflow · **P2** UX or functional improvement (most patches) · **P3** polish. |
| **Title** | short, descriptive | One short noun phrase. Past-tense state, not change verb. No leading "Add" / "Fix". |

Then gather entry content: **What** · **Why it matters** · **Fix applied** · **Trade-off** (when applicable) · **Must remain true** (optional). Per-entry template is in `docs-files.md`.

### Step 3 — Capture screenshots (the actual hard part)

This is the skill's unique value over the native path.

#### 3a. Capture the "before" state via git-stash + Playwright

The patch is already in the working tree — the **before** image needs the patch temporarily reverted.

```bash
# 1. Record git state so we can verify clean rollback at the end
git status --porcelain > /tmp/record-patch-status-before.txt

# 2. Stash all working-tree changes including untracked
git stash push -u -m "record-patch: capture before-state for <PATCH-ID>"

# 3. Capture the before screenshot (see 3c for which capture path)

# 4. Restore working tree
git stash pop

# 5. Verify the state matches what it was before
git status --porcelain > /tmp/record-patch-status-after.txt
diff /tmp/record-patch-status-before.txt /tmp/record-patch-status-after.txt
```

If the diff is non-empty, **STOP**. Report the actual diff to the user — `git stash pop` left residue that needs manual cleanup. Do not proceed.

#### 3b. Capture the "after" state via Playwright

With the patch reapplied (after `git stash pop`), capture the same view that showed the old behaviour in 3a. The view selector, navigation steps, and viewport must match exactly — otherwise the comparison is meaningless.

#### 3c. Pick the right Playwright capture path

Frontend URL for this project: http://localhost:3000

| Patch surface | Tool |
|---|---|
| **Simple** — load a URL, wait for a single selector, screenshot the page | `python3 .claude/skills/record-patch/scripts/capture.py --url <URL> --wait-for <selector> --out <path>` |
| **Complex** — multi-step (upload file, click button, open modal, scroll into view, then snap) | Generate a one-off script at `/tmp/<PATCH-ID>-capture.js` following the template at `.claude/skills/record-patch/references/playwright-template.js`. Run with `node /tmp/<PATCH-ID>-capture.js`. Delete after use. |

#### 3d. Naming + verification

Save into `docs/screenshots/`. Filename pattern:

```
YYYY-MM-DD-<area-lowercase>-<id-lowercase>-<state>[-<detail>].png
```

After both captures, verify with `test -s docs/screenshots/<before>.png && test -s docs/screenshots/<after>.png`. Missing or zero-byte files = report the error (Playwright timeout, wrong URL, frontend not running).

### Step 4 — Atomic write of all three files

Dependency order: PATCHES first (CHANGELOG's anchor link points to it), CHANGELOG second, BACKLOG last.

#### 4a. Write PATCHES.md

Two edits:

1. Insert per-entry block at TOP of matching area section (newest-first within area). Use the per-entry template from `docs-files.md`. Include both `**Before**` and `**After**` image blocks since this is Bucket A.
2. Insert Index row at TOP of matching Priority bucket. Row format and anchor format both in `docs-files.md`.

#### 4b. Write CHANGELOG.md

Append bullet under today's `## YYYY-MM-DD` section. Create the date section if missing (newest at top). Bullet format in `docs-files.md`.

#### 4c. Update BACKLOG.md (if applicable)

Find row with matching ID, remove it. If no matching row, no-op.

#### 4d. Atomicity

If 4a succeeds but 4b or 4c fails, wrap in a try block with in-memory snapshots and restore on failure. Do not partially-apply silently.

### Step 5 — Confirm to the user

Report:
- The PATCHES anchor URL (relative): `docs/changes/PATCHES.md#<anchor>`
- Suggestion: `git diff docs/changes/` to review the three file edits before committing.

No interactive approval gate — user reviews via git diff and commits when ready.

## Notes on robustness

- Frozen-ID rule is non-negotiable. If `scan_ids.py` returns `UI-E16`, that is the ID.
- Atomic write is mandatory. Fix partial-write errors before retrying — do not leave the three files inconsistent.
- The git-stash flow requires a clean stash-pop. The verification step catches the most common failure (untracked files surviving the pop). When verification fails, the working tree needs attention — do not power through.
- Playwright capture needs the frontend running. If the URL is not responding, fall back to asking the user to start the dev server.

## Resources in this skill folder

- `scripts/scan_ids.py` — deterministic ID scan, prints next-available per area+kind
- `scripts/capture.py` — simple-case Playwright capture (one URL → wait → snap)
- `references/playwright-template.js` — template for complex multi-step captures
