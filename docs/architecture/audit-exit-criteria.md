# Audit Exit Criteria — Nailed-it

Date: 2026-05-26
Owner: Carson

## Why this doc exists

Audits expand. Without exit rules, we keep finding "one more thing" and never ship. This doc defines when an audit is **done** so patches can start.

## Per-audit caps

Each audit pass (Phase 2 run) ends when ANY of these is true:

- **20 findings collected** across all 5 lenses (A spec / B Nielsen / C persona / D trust / E competitor).
- **5 calendar days elapsed** since audit started.
- **All P0 + P1 findings exhausted** even if total is below 20.

Whichever fires first → close audit, move to Phase 3.

## Per-finding minimum bar

A finding only enters BACKLOG.md if it has ALL of:

- [ ] Page + element location (file path + line if static, screenshot region if visual).
- [ ] Persona harmed (Yuki / Mira / Linlin / Auntie Wang). If "none of the above", reject.
- [ ] JTBD blocked or degraded (cite from personas.md).
- [ ] Source lens (A/B/C/D/E) + specific criterion (e.g. "Nielsen #2 — match real world").
- [ ] RICE score (Reach 0–10 × Impact 0–10 × Confidence 0–1.0 ÷ Effort 1–10).
- [ ] One-line proposed fix (not full design — enough to scope effort).

Findings missing any field → either fill the gap or drop.

## Re-audit cadence

Full audit re-run quarterly. Trigger immediately if any of:

- Major flow added (new route or new persona served).
- Persona file updated (priorities change).
- Conversion metric drops > 10% week-over-week (post-launch only).
- Competitor ships an obvious copy/feature we should answer.

## Out-of-scope categories

Audits do NOT cover:

- Backend correctness (own audit lane).
- AI quote accuracy (own evaluation pipeline).
- Performance beyond Lighthouse mobile score (perf audit separate).
- Internationalization quality (defer until language decision changes).
- Marketing landing pages beyond `/` (none exist yet).

If a finding is in one of these categories, route to its own backlog, not UX BACKLOG.

## Done-of-done for the whole UX maturity initiative

This whole effort (Phases 0–5) is **done** when:

- All Phase 0 + Phase 1 docs exist and are reviewed.
- One full audit pass complete with ≥ 10 findings shipped.
- Hallway test run on shipped state (≥ 3 humans).
- Visual regression baseline in place.
- Banned-word lint in CI.
- `ux-design-maturity` skill extracted and applied to one other product (proves portability).

After that → maintenance mode. Quarterly re-audit. No more meta-doc work unless personas / market shifts.
