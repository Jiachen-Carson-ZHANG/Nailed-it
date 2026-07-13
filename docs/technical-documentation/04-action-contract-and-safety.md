# 04 — The Action Contract & Safety Model

*Why should a merchant trust an AI that spends money?* Because every trust question below has a
mechanism, not a promise. This is ADR-0011 (backend-honest) + ADR-0012 (action contract) + the guardrail
layers of ADR-0013, as one story.

## 1. Agents create real objects, through the real code path

`place_ad` does not write "I placed an ad" into a log. It POSTs the app's own
`/api/agent/propose-ad`, which runs the same validated server action the merchant UI uses, and a real
`style_ad_campaign` row exists afterwards — visible, editable, pausable in the 投广中心. Same for 团购:
a real, editable `groupbuy_deal` draft with relational service items, awaiting the merchant's publish.

**The contract** (`src/domain/action-entity-contract.ts`, migration `0027`): every money action links
*forward* to its entity (`agent_actions.entity_type/entity_id`) and the entity links *back*
(`source_run_id`). The merchant can go from any campaign/deal to the reasoning that proposed it ("AI 提案
· 查看推理 →") and from any action row to the object it created ("查看 →"). No orphaned claims in either
direction.

**Entity status is authoritative; action status is a coarse mirror.** The campaign's own
`draft/active/paused/ended` is the truth; `agent_actions.status` only answers "is this live?" for the
feed. All transitions go through one state machine with a legality table — there is no code path that
force-sets an entity status.

## 2. The money envelope: bounded autonomy, not approval fatigue

Per-campaign daily budget ≤ ¥50 (`AGENT_AUTO_LAUNCH_MAX_DAILY_BUDGET_CENTS`): the agent auto-launches —
the spend is a *withdrawable daily drip*, and the merchant has a one-tap 暂停 in the ads center. Above
the cap: the campaign is created as a **draft** and waits for the merchant to launch it. Group-buys are
*always* drafts (publishing a discounted offer is a storefront change; the merchant publishes).
Rationale: gate by **blast radius**, not by "AI did it". A ¥50/day reversible drip doesn't deserve an
approval queue; an unbounded budget or a public price cut does.

The same envelope thinking caps proposals: pending 上架建议 ≤ 5, new rounds supersede old ones
(ADR-0013 P0) — an approval queue that outruns the merchant's attention is itself a safety failure.

## 3. Reversibility is a typed property, and undo touches the entity FIRST

Every action carries `risk: reversible | irreversible`. A sent message is irreversible — the UI never
offers undo on it, and the repository guard refuses the transition (`canUndoAction`). For reversible
actions, **undo ordering is load-bearing**:

```
read action → check canUndoAction → WITHDRAW THE ENTITY → mirror agent_actions.status
```

The entity moves first (campaign → paused, deal → unlisted). If the status mirror then fails, the money
is already stopped and the stale pill self-corrects from the authoritative entity. The reverse order
would report "undone" while the ad kept spending — the exact lie a safety system must never tell.
Withdrawal targets are part of the state machine: a live ad *pauses* (resumable), a rejected draft
*ends*; a rejected group-buy proposal is *shelved* (unlisted), never deleted — the audit trail keeps its
`source_run_id`.

## 4. One human gate, chosen on capability grounds

`propose_listing` (上新建议) is the only always-gated action — because the agent *cannot* complete it:
publishing a style requires an image only the merchant has. Everything else is either auto-with-undo
(inside the envelope) or draft-by-construction. The gate is honest about its own scope: approval records
intent; the merchant still supplies the image.

## 5. Defense in depth against the model itself

Assume the model will, at some point, emit garbage. Layers, innermost first:

1. **Input validation in every tool** (`tools.py`): style-id regex, bounded ints (budget ≤ ¥2,000/day
   hard max), text length caps, slot whitelists. Invalid args raise *before* any side effect and the
   error text goes back into the loop.
2. **Per-lane tool allow-lists** (`LANE_TOOLS`), enforced in the runner: an off-allow-list tool name is
   **not executed** — checked before execution precisely because a side effect would fire before any
   eval could flag it.
3. **Capability objects, not permissions**: dispatch power exists only as the `RoundState` in the
   orchestrator's context; revision power only as the `RevisionPort` in the monitor's. A lane agent
   *cannot* dispatch or revise — the tools refuse contexts without the object.
4. **Server-side revalidation**: the TS actions re-validate everything (style must be published and
   priced, deal terms must parse, budget re-checked against the envelope) — the Python layer is not
   trusted either.
5. **Grounding enforced by eval** (doc 06): any cited style-id that doesn't exist in the grounded inputs
   fails the round's evaluation — the anti-hallucination check runs on every eval run, with attempts
   recorded even when validation rejected them.

## 6. Backend-honest UI (ADR-0011)

The merchant surface never claims what the backend can't do: no fake undo on irreversible actions, no
optimistic "applied" before the write, sales counts show `—` until a real data source exists (never a
fake 0), and a currency picker that failed to reach the DB says so instead of silently showing stale
cache. Trust in an autonomous system is mostly built here — the first time the UI lies about state,
the merchant stops believing the agent entirely.

## 7. Atomicity where partial writes would lie

Group-buy save was three PostgREST calls (deal upsert, items delete, items insert); a failure between
the last two left a **published deal with zero services** — a live offer the merchant can't honour. Now
one Postgres RPC (`save_groupbuy_deal`, migration `0029`): deal + items commit or nothing does, and the
function refuses to move a deal between merchants. Same instinct as undo ordering: the failure mode to
eliminate is the one where the system's claims and the world disagree.
