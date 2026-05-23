---
name: to-onboard
description: |
  Produce a developer onboarding brief for the current repository. Use when the user says "onboard me", "what is this project", "help me get up to speed", "explain this codebase", "where do I start", or when starting work in an unfamiliar repo. Delegates heavy file reading to the code-researcher sub-agent so the main thread stays clean for follow-up Q&A.

  Keywords: onboard, onboarding, ramp up, get started, explore repo, explain codebase, what is this project, project overview, where do I start, new to this codebase
---

# Onboarding Skill

Help a developer get up to speed on an unfamiliar repository quickly, then stay available for follow-up questions.

## When to invoke

- User explicitly asks to be onboarded ("onboard me to this repo", "/to-onboard", "help me understand this project")
- User is clearly new to the codebase ("I just cloned this", "first time working here")
- User asks for a project overview, codebase tour, or "where do I start"

Do NOT invoke for narrow questions like "where is function X" — those go straight to the `code-researcher` sub-agent or a direct grep.

## How to run it

### Step 1 — Delegate the exploration

Spawn the `code-researcher` sub-agent with a prompt like:

> Produce an onboarding brief for this repository. Cover:
> 1. **What it is** — one-paragraph description of the project's purpose, inferred from README/package.json/pyproject.toml/go.mod/etc.
> 2. **Stack** — languages, frameworks, build tools, package manager, runtime
> 3. **Entry points** — the file(s) a developer would open first (main, index, server entry, CLI entry)
> 4. **Repo layout** — top-level directories and what lives in each
> 5. **How to run/test/build** — exact commands from package.json scripts, Makefile, justfile, or docs
> 6. **Conventions** — anything notable from CONTRIBUTING.md, CLAUDE.md, .editorconfig, lint configs, or obvious patterns in the code
> 7. **Start-here files** — 3–5 files a new contributor should read first, with one line each on why
>
> Keep it under ~500 words. Use file:line references. Flag anything you couldn't determine.

Why delegate: onboarding involves reading many files (README, configs, entry points, sample modules). Doing that in the main thread floods context and leaves no room for follow-up dialogue. The sub-agent reads in isolation and returns a tight synthesis.

### Step 2 — Present the brief

Relay the sub-agent's brief to the user, lightly reformatted if needed. Don't add your own interpretation on top — let the brief speak for itself. Then offer concrete next steps:

> Want me to dive deeper into any of these — e.g. walk through the entry point, explain the data model, or show how a typical request flows through the system?

### Step 3 — Handle follow-ups directly

Once the brief is delivered, follow-up questions ("how does auth work?", "where's the database layer?") can usually be answered in the main thread without re-delegating, because the brief already gave you the map. Only re-delegate to `code-researcher` if a follow-up requires reading another large set of files.

## What good onboarding looks like

- **Concrete, not generic.** "Built with Next.js 14 App Router and Prisma" beats "modern web stack".
- **Actionable next step.** Always end with a specific file to open or command to run.
- **Honest about gaps.** If there's no README and the build command isn't obvious, say so — don't fabricate.
- **Short.** Developers want to start coding, not read an essay. ~500 words for the brief, then converse.

## What to avoid

- Don't paste large file contents into the response.
- Don't explain general concepts (what Next.js is, what a monorepo is) unless asked.
- Don't restate things the user already said about the project.
- Don't recommend changes, refactors, or "improvements" — onboarding is descriptive, not prescriptive.
