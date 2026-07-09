# ADR-0011 — Merchant 今日 home read model + backend-honest controls

Status: Accepted · 2026-07-06

## Context

The merchant 今日 home (DESIGN.md → "Merchant Agent Home") shows five zones from different sources:
a compute-on-read **stat strip** (revenue / orders / new customers), a **需要关注** feed (pending agent
actions + recently-applied actions), a per-**technician** "today" roll, a **常驻** launcher, and a
drill-down sheet. A backend-contract audit (2026-07-06) found that a naive build could make the UI *lie*:

- Action **controls were ahead of the backend** — DESIGN.md implied 停止投放 / 停止新拼团, but
  `setActionStatus` (agent-repository.ts) only supports `approved` / `undone`; there is no stop/unlist API.
- **Group-buy is browser localStorage** (groupbuy-repository.ts) — a coupon action is a *record*, not a
  live deal, so "停止新拼团 / 查看团购效果" cannot be real.
- The calendar mixed DB bookings with `mockTechnicians` and used a **UTC** `todayIso()`, wrong for a
  merchant in Asia/Singapore.
- Self-fetching client widgets (one per zone) would be non-deterministic, hard to test, chatty, and could
  render inconsistent partial states.

## Decision

One server **read model**, `getMerchantTodayHomeAction()`, returns the whole home in a single shape
`{ stats, pending, recent, technicians, agents, errors }`. Rules:

1. **Pure, deterministic compute** lives in `src/domain/merchant-home.ts` (no I/O) → unit-testable. The
   action only fetches raw rows and hands them to the pure functions.
2. **Compute-on-read** (ADR-0006): stats are derived from the booking list, never stored. Revenue is a
   rolling-7d vs prior-7d delta (null when there is no prior week → "暂无对比").
3. **Merchant timezone**: "today" / "this week" use `merchant.timezone` (demo = Asia/Singapore, +08:00),
   fixing the UTC `todayIso()` bug. Booking dates are local `YYYY-MM-DD`, so date-key string compares are
   exact and DST-free for the demo tz.
4. **Independent failure**: each zone is fetched in its own try/catch; a failure pushes its key to
   `errors` and only that zone renders its error state — the page never blanks. The client also races the
   action against an 8s timeout so a hung/unreachable source degrades to the error state, never an
   infinite spinner.
5. **Backend-honest controls**: `controlCapabilities(action)` returns only what the backend can actually
   do today — a proposed `draft_upload` (the one human gate) → 批准 / 拒绝; **everything else → 查看**.
   No fabricated stop/unlist, and no fake-undo of an already-sent message or spent ad.

## Design principles

- One source of truth per render; the UI is a pure function of the read model.
- The deterministic core is separable and testable; I/O is a thin shell.
- The UI may only offer what the backend can honor (truthful controls).
- Degrade gracefully and independently; never lie about progress.

## Alternatives considered

- **Per-zone self-fetching client widgets** — rejected: non-deterministic, N round-trips, inconsistent
  partial states, and the compute is trapped in React (untestable).
- **Store/materialize stats** — rejected: violates ADR-0006 compute-on-read; adds write paths + drift.
- **Trust DESIGN.md's aspirational controls (停止投放 etc.)** — rejected: the APIs don't exist; the card
  would lie. Those controls move to the backlog behind real ad-stop + DB-backed group-buy.

## Consequences

**Positive:** deterministic, unit-testable, backend-truthful home; one action; per-field resilience;
timezone-correct numbers.

**Negative / follow-ups (backlog):** the single action fans out to several reads (fine now; parallelize /
cache later). Controls stay minimal until real stop/unlist APIs + DB-backed group-buy exist. Per-merchant
tz/currency is read from a demo constant until wired to the merchants repo.

*Update (Phase 5):* the technician roll's `off` state is now real — `computeTechnicianDay` takes the
scheduling kernel's `workingPlans` (the same source the booking availability grid uses), so a technician
with no plan covering today's weekday is 今日未排班. Blocked-time (partial-window training/leave) is left
to the full calendar rather than folded into the coarse card state.

**Reversibility at the source (2026-07-06 remediation):** the honest-controls rule is client-side, but the
`risk` flag written by the Python tools drives the *existing* agent panel's undo control too. Corrected the
one factual lie there — `send_customer_message` is now `risk="irreversible"` (a sent message cannot be
un-sent), so the panel stops offering undo for it. Still open (deliberately not changed): `place_ad` and
`set_group_buy_coupon` are "stoppable in concept" but have no stop/unlist API — their `reversible` labels
and the panel's undo UX are a product decision pending those APIs.

## References

- DESIGN.md → "Merchant Agent Home" (canonical) · ADR-0006 (compute-on-read) · ADR-0007 (agent team)
- Backend-contract audit, 2026-07-06 · `agent-repository.ts` `setActionStatus` · `groupbuy-repository.ts`
- Code: `src/domain/merchant-home.ts`, `src/lib/actions/merchant-home-actions.ts`, `src/features/merchant/TodayHome.tsx`
