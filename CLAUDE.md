# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`cc-guide` is **not an application** — it's a distribution of Claude Code configuration (skills, sub-agents, MCP server config) plus documentation and slides aimed at SAP developers. The bundled `.claude/` directory is the *deliverable*: users either run `./setup` to merge it into `~/.claude/` or copy it into a project root. Treat `.claude/` as user-facing artifact, not internal tooling.

## Commands

```bash
./setup                  # Install .claude/ and .mcp.json into ~/.claude/ (idempotent; won't clobber existing settings.json or .mcp.json)
pre-commit run --all-files   # Run all pre-commit hooks locally (shellcheck, markdownlint, basic hygiene)
```

There is no build, test suite, or lint config beyond pre-commit. Most "validation" is structural — does the install land correctly, do hooks pass.

All skills live under `.claude/skills/` and ship via `./setup`. There is no staging directory — if a skill is tracked in the repo, it's distributed.

## Setup script behavior

`./setup` is **non-destructive** for user data:

- Always copies `.claude/skills/` and `.claude/agents/` contents over (overwrites bundled skills, leaves unrelated user skills/agents alone — `cp -R` with trailing `/.`).
- Skips `.claude/settings.json` if the user already has one (prints a warning pointing to the reference file).
- Skips `~/.claude/.mcp.json` if it exists.

When editing the installer, preserve this contract — never clobber a user's `settings.json` or `.mcp.json`.

## Docs convention

The `docs/` folder has its own [CLAUDE.md](docs/CLAUDE.md). Quick version: `roadmap/` is proposed work, `prds/` is approved "what/why", `architecture/` is approved "how". Don't edit accepted PRDs/ADRs in place — write a new doc that supersedes them. File names use `NNN-short-slug.md` so they sort chronologically.

## Contribution rules

See [docs/RULES.md](docs/RULES.md) for contribution rules — how to add skills/agents, the non-destructive `setup` contract, vendored-skill tracking via `skills-lock.json`, commit style, and pre-commit expectations. Follow it when changing anything under `.claude/`, `.mcp.json`, or `setup`.

## Pre-commit

`shellcheck` runs on shell scripts (`setup`). `check-added-large-files` caps at 500kb. Markdown is intentionally not linted — most skills are vendored from upstream repos with varying styles, and enforcing a single ruleset turns syncs into churn.

## Setup script behavior — keep dynamic

`setup` enumerates `.claude/skills/*/` and `.claude/agents/*.md` at runtime — it does not hardcode skill names. When adding or renaming a bundled skill, only the directory needs to move; the installer picks it up automatically. The one place skill names appear literally is the "Next steps" hint in `setup` (currently `/to-onboard`, `/to-prd`, `/to-sap-plan`) — keep it pointing at the most useful entry points.