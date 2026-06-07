# Plan: Merchant Intelligence Layer (event-sourced, compute-on-read)

Date: 2026-06-07
Status: Design locked, not started. Decisions in [ADR-0006](../decisions/ADR-0006-intelligence-layer.md).
Source PRD: Lark "PRD: Merchant Intelligence & Personalized Style Recommendation System".

## Goal

Make the merchant *know what customers want* and let the customer *see more relevant designs*,
demonstrated by a single live demo flow. Hero = merchant demand intelligence. Everything is
derived from one real event log over a seeded ~2-week history; the live demo customer is Melissa,
whose actions append to that log in real time.

Locked decisions (see ADR-0006):
- Demo-truth, seed-backward. `analytics_events` + `trackEvent` are real; history is seeded.
- Compute-on-read. Only `customers` (seed) + `analytics_events` (real) are stored.
- Catalog is the taxonomy. Reuse `category` + `discovery_facets` via a shared adapter.
- Thin reason-coded ranking, one function. Technician analytics reuse the existing workload card.
- AI narrates computed numbers only. No tenant/RLS, no A/B infra, no cron.

## Schema (migration `0017_intelligence_layer.sql`)

Two tables. All id/reference columns are `text` to match existing PKs.

```
customers
  id text primary key                       -- e.g. 'cust-melissa'
  merchant_id text not null references merchants(id)
  handle text unique                        -- stable key for mock-session mapping ('melissa')
  name text not null
  avatar_url text
  persona_note text
  created_at timestamptz not null default now()

analytics_events
  id uuid primary key default gen_random_uuid()
  merchant_id text references merchants(id)
  customer_id text references customers(id)  -- null for anonymous
  session_id text
  event_type text not null                   -- style_impression | style_card_click |
                                             -- style_detail_view | style_save | search_submitted |
                                             -- search_no_result | try_on_completed |
                                             -- booking_confirmed | recommended_style_sent | ...
  event_source text                          -- surface (customer_home_feed, search, try_on, ...)
  style_id text                              -- references merchant_style(id), soft (no FK)
  booking_id text
  technician_id text
  query text
  rank_position int
  algorithm_version text
  metadata jsonb not null default '{}'
  created_at timestamptz not null default now()

indexes: (merchant_id, created_at), (customer_id, created_at), (style_id), (event_type, created_at)
```

No change to `bookings` / `conversation_threads`. Booking conversion is read from
`booking_confirmed` events (seeded + live), which carry `style_id` + `customer_id` + price in
`metadata`. The intel panel's "appointment context" matches the customer-facing booking table's
`customer_name` to `customers.name` for the demo (which table — `booking` interval vs legacy
`bookings` — is confirmed in Phase 0; both exist).

## Read model (pure functions over events + catalog adapter)

New module `src/domain/intelligence/` (pure, unit-testable). Catalog→category mapping is
extracted from `src/features/customer/style-facets.ts` into a shared `src/domain/catalog-tags.ts`
(`categoryOf(label)`, `tagsByCategory(facets)`); `style-facets.ts` re-exports so the feed filter
is unchanged.

- `getCustomerProfile(events, customerId)` → weighted, time-decayed tag scores per category +
  `average_budget` + `recent_interest`. Weights/decay per PRD (save 3, try_on 4, booking 6;
  decay 1.0 / 0.7 / 0.4 / 0.2 by age bucket).
- `getMerchantInsights(events, styles, merchantId, range)` → `{ snapshot, demand_trends,
  design_performance (incl. high_interest_low_conversion), catalog_gaps }`. Trends compare this
  period vs previous; tags resolved from `style_id` via the adapter and from `search_submitted`
  queries.
- `rankStyles(profile, candidates, context)` → ordered list + `reason_codes` / `reason_text`.
  `score = tag_affinity (adapter overlap) + popularity (event counts) + freshness`. One function,
  two call sites (customer feed, panel recommendations).
- `getCustomerIntelligence(events, styles, bookings, customerId)` → profile + recommended styles
  (`rankStyles` over merchant catalog) + appointment context.
- `summarizeInsights(structuredMetrics)` → grounded AI headline/insights/actions via the existing
  model client; receives only pre-computed numbers.

## Capture (`trackEvent`)

- `src/lib/repositories/supabase/analytics-repository.ts` + an in-memory variant for tests
  (mirrors the existing repository seam, ADR-0004).
- `trackEventAction` server action inserts one row. Client helper `track(eventType, payload)` is
  fire-and-forget and must never break the user flow on failure.
- Impression tracking via `IntersectionObserver` on `StyleCard` (fire once visible ≥1s or ≥50%).

## Surfaces

- **Customer feed** (`StyleWaterfallGridClient`): order via `rankStyles` for Melissa; wire
  `style_impression` / `style_card_click` / `style_save`; optional subtle reason chip.
- **Search / try-on / booking**: `track` at existing points (`search_submitted`,
  `search_no_result`, `try_on_completed`, `booking_confirmed`).
- **Merchant Insights** (`/merchant/insights`, new route + nav entry): "Nailed AI Insights" page —
  cards: Today Snapshot, Demand Trends, Design Performance (incl. high-interest/low-conversion),
  Catalog Gap, AI Summary. Empty-state when data is thin; no fake metrics.
- **Merchant Messages** (`/merchant/messages`): customer-intelligence panel (right side desktop /
  bottom sheet mobile) — snapshot, preference memory, recommended styles to send, appointment
  context. "Send style card" logs `recommended_style_sent`.

## Demo dataset (built backward, real catalog vocab)

Seed ~6 personas + ~2 weeks of events so the numbers land:

Phase-0 audit (2026-06-07, `scripts/audit-intelligence.ts` against live Supabase) anchors these to
the real published set — **34 published styles**, merchant `merchant-nailed-it`:

- **金属感 demand rising** — 7 published 金属感 styles (8252, 8259, 8273, 8274, 8280, 8282, 8284);
  seed prev ~29 → this week ~42 searches/impressions.
- **Low-conversion style** — `style-melissa-img-8284` «鎏金奢华» (金属感): many try-ons (~34),
  ~1 booking. Distinct from the top converter.
- **Top converter** — `style-melissa-img-8265` «极光法式碎钻» (裸色 + 法式风, a real nude-french):
  highest booking conversion. (The plan's earlier 8259 «珠光法式银月钻» carries neither 裸色 nor
  法式风 — rejected by the audit.)
- **Catalog gap (暗黑)** — seeded high 暗黑 search demand (~21×) against **1** published 暗黑 style
  (`style-melissa-img-8281`). Static gap; see "暗黑 catalog-gap" below. (甜美 was the original
  candidate but the audit found it on **19/34** styles — not a gap.)
- **Melissa profile** — 裸色/粉色 · 椭圆/圆形 · 韩系/法式风/极简 · budget ~SGD 80.

No extra `merchant_style` rows needed — 34 styles are already published. A
`scripts/verify-intelligence.ts` runs the read model against the seed and asserts these numbers —
doubles as the regression/eval per repo eval rules. Cleanup: one junk published row
(`style-3c17f12c…` «Untitled design», zero facets) should be archived so it stops polluting the
feed + counts.

## Phases

- **0 — Demo-truth audit (do first).** Dump the live published Melissa `discovery_facets` from
  Supabase; lock the honest gap tag (the one with `matching_active_styles <= 1`), the 金属感
  low-conversion anchor + 裸色法式 top-converter `style_id`s, and confirm which booking table the
  customer confirm flow writes (`booking` interval vs legacy `bookings`). Seed numbers and
  `verify-intelligence.ts` asserts bind to this output. Verify: audit captured in the plan/log.
- **A — Schema + real capture.** Migration 0017; analytics repository (supabase + memory);
  `trackEventAction` + client `track()`; wire feed/search/try-on/booking. Verify: live clicks land
  in Supabase. Tests: repository + action.
- **B — Read model + adapter.** Extract `catalog-tags.ts`; build `getCustomerProfile`,
  `getMerchantInsights`, `rankStyles`, `getCustomerIntelligence`. Verify: unit tests over
  deterministic in-memory events.
- **C — Seed the demo dataset.** `seedCustomers` + `seedAnalyticsEvents` (narrative generator) +
  any extra `merchant_style`; `verify-intelligence.ts` asserts the narrative. Verify: script green.
- **D — Hero 1: Merchant Insights dashboard.** New `/merchant/insights` route + nav entry, cards +
  grounded `summarizeInsights`. Verify: page renders seeded insights; AI summary grounded (mock
  model in test); empty-state path.
- **E — Hero 2: Customer intel panel + ranked feed.** Messages panel + send-style logging;
  feed ranking for Melissa + reason chips. Verify: panel renders Melissa's profile + recos; feed
  reorders; tests.
- **F — Docs + dry-run.** Update `current-state.md` + `implementation-log.md`; demo rehearsal.

A–C are the (mostly invisible) foundation; D–E are the visible heroes; the demo flow ties them.

## Scope cuts vs PRD

Dropped/deferred for v1: `style_tag_definitions` / `style_tags` (use catalog + facets); the
materialized metric/profile tables (compute on read); 8.3 standalone auto-tagging brain (reuse
existing breakdown); 8.7 AI weekly report → fold into the dashboard's AI Summary card; 8.11 A/B
experimentation (keep only `algorithm_version`); tenant_id + RLS; background queues + cron; the
dedicated technician-analytics card (reuse Profile workload).

## Open items / risks

- **Migrations are applied manually** in the Supabase SQL editor (no CLI/exec_sql here). 0017 is a
  live step before seeding.
- **Gap-tag tuning** (resolved in Phase 0): 甜美 rejected (19/34 published); honest gap = **暗黑**
  (1 published style, `style-melissa-img-8281`). Static — no live upload-resolve (sweet pics tag
  甜美, not 暗黑).
- **Live-demo dev-server flakiness** (`.next` cold-compile, `000` responses) — warm routes one at a
  time before the demo; not a code issue.
- **Mock-session → Melissa mapping** needs a stable `customers.handle` the customer shell reads.

## 暗黑 catalog-gap — configured edge case (static)

The catalog-gap card surfaces demand the merchant under-covers, so a tag with high search demand
and **0–1 matching published styles is the intended state**, not a failure. Phase 0 set the gap to
**暗黑** (1 published style, `style-melissa-img-8281`); 甜美 was rejected (19/34 published).

Config:
- **Detection**: gap when `search_count(tag) >= threshold` (PRD MVP ≥10; seed ~21) **AND**
  `matching_active_styles(tag) <= 1`. Use `<= 1` (not the PRD's `<= 2`) for a crisp "only one."
- **Empty-safe**: gap detection must render when `matching_active_styles = 0` ("customers want X,
  you have none") and must never divide by zero in any conversion/coverage calc that assumes ≥1
  style.
- **Static (no live resolve)**: the card states the honest gap; there is no on-stage
  upload→resolve beat. `sweet*.jpg` are **decoupled** into a standalone "AI auto-tags new uploads"
  demo (`scripts/detect-sweet.ts` shows the model tagging them 甜美) — unrelated to the 暗黑 gap.
  A live close-the-loop is deferred (needs unpublished 暗黑 assets) — see Future roadmap.

## Future roadmap — NOT for the hackathon demo

Deferred deliberately. Hackathon scope is ADR-0006 + Phases A–F above. Recorded here so the cuts
are intentional, not forgotten.

### Demo-side (still seeded; richer story later)
- Live close-the-loop on the gap tag: stage unpublished assets matching the gap tag (e.g. 暗黑),
  publish mid-demo, show the gap card resolve. (Dropped from v1: `sweet*.jpg` tag 甜美, not the gap.)
- More personas + deeper seeded history; a "new visitor" cold-start beat alongside Melissa.
- Reason chips on more surfaces; a visible `ranking_v1` vs popularity toggle to show ordering change.
- Free-text search synonym map (镜面 / metallic / 镭射 → 金属感).
- Dedicated technician-analytics card (currently reuses Profile workload).
- AI weekly report as its own artifact (currently folded into the AI Summary card).
- Merchant tag-review UI (accept/reject/edit AI tags) with per-tag `source` + `confidence`.

### Live / prod-side (the real-system path ADR-0006 declined for now)
- Real customer identity + auth; replace the mock session + `localStorage` saves with DB accounts.
- `tenant_id` + RLS for true multi-salon multi-tenancy.
- Materialize the PRD metric/profile tables + incremental update (event → queue → profile update);
  compute-on-read does not scale past demo volume.
- Aggregation jobs (daily/weekly) on a scheduler instead of the seed/refresh script.
- Full A/B experimentation: `experiment_id`, algorithm versions, CTR / save / booking-by-version.
- ML ranking trained on the rule-based `recommendation` logs (the logs are the training data).
- Privacy: event deletion / anonymization, tenant-scoped access guarantees, consent capture.
- Cross-merchant global preference profile (PRD's nullable-`merchant_id` global profile).

