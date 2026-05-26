# Ownership Map — Nailed-it UX

Date: 2026-05-26
Owner: Carson

RACI for UX decisions. Resolves loops where multiple parties think they own the same call.

## Roles

- **Carson** — product owner, final say.
- **Melissa** — frontend / visual design owner (colleague).
- **Claude** — implementation + research + audit (this agent).
- **Future hires / external testers** — usability test participants only.

## Decision matrix

| Decision area | R (Responsible) | A (Accountable, final say) | C (Consulted) | I (Informed) |
|---|---|---|---|---|
| Product strategy / personas | Carson | Carson | Claude (drafts) | Melissa |
| Visual design (colors, type, motion) | Melissa | Melissa | Carson | Claude |
| Copy / tone / banned words | Claude (drafts) | Carson | Melissa | — |
| Component primitives & layout | Melissa | Melissa | Claude (implements) | Carson |
| Flow architecture (routes, steps) | Carson | Carson | Melissa, Claude | — |
| Edge case behavior | Claude (drafts) | Carson | Melissa | — |
| Performance budgets | Claude (drafts) | Carson | Melissa | — |
| Analytics / event taxonomy | Claude (drafts) | Carson | — | Melissa |
| Patch implementation | Claude | Carson | Melissa (visual review) | — |
| Patch acceptance (ship / reject) | Carson | Carson | Melissa (if visual) | — |
| Quarterly re-audit | Claude (runs) | Carson | Melissa | — |

## Conflict resolution

If Melissa and Claude disagree on visual matter → Melissa wins (A on visual).
If Claude and Carson disagree on copy → Carson wins (A on copy).
If Melissa and Carson disagree on flow → Carson wins (A on flow).

Document disagreement + resolution in `docs/decisions/` as ADR if non-trivial.

## Async review channel

Every patch claiming **visual change** must post to Lark (channel TBD by Carson) with:
- Before screenshot
- After screenshot
- One-line summary
- Tag: @melissa

Melissa response within 48h or auto-approved.

Every patch claiming **flow change** (new route, step removed/added) must:
- Open issue or thread tagged @carson
- Wait for explicit approval before merging
- No auto-approve window

Copy-only patches → no review channel needed; banned-word lint catches obvious violations.

## Out-of-band escalation

If a patch needs a decision beyond this matrix (legal, payment, brand identity, naming):

1. Claude flags in patch description with `NEEDS_DECISION:`.
2. Carson routes to right person.
3. No merge until decision logged in ADR.

## Resolved (2026-05-26)

- **No third stakeholder.** Carson (product) + Melissa (visual) + Claude (agent) is the full RACI. No brand designer, legal, or external review needed in this phase.
- **Merchant UX uses the same surface as customer.** Same design tokens, same component library, same content-style rules. No separate ownership track; Carson is final say for both. Patches touching merchant flows follow the same review channel.

## Open questions

- Melissa's Lark handle + preferred review channel (Carson to confirm).
