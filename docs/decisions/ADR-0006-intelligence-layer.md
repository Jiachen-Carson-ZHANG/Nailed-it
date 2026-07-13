# ADR 0006: Merchant Intelligence Layer — event-sourced, compute-on-read, catalog-as-taxonomy

**Status:** Accepted
**Date:** 2026-06-07

## Context

A new PRD ("Merchant Intelligence & Personalized Style Recommendation System") proposes a
data + AI layer: behavioral event tracking, a tag taxonomy, customer preference profiles,
rule-based personalized ranking, a merchant insights dashboard, catalog-gap and
low-conversion detection, a customer-intelligence message panel, and AI weekly reports.
It specifies ~12 tables, daily/weekly aggregation jobs, multi-tenant `tenant_id` + RLS, and
authenticated customers accumulating behavior over weeks.

The repository is a single-salon **competition demo**, and the PRD drifts from it structurally:

- **No customer identity.** `bookings` / `conversation_threads` carry a `customer_name`
  *string*, not an FK. Saved styles live in `localStorage` (`SavedStylesContext`). There is
  no `customers` table and no auth. "Preference memory keyed by `(customer_id, merchant_id)`"
  has no subject.
- **No tenancy columns.** There is no `tenant_id`; scoping is `merchant_id` (single salon).
- **The taxonomy already exists.** The catalog (`catalog` table / `src/mock/catalog.ts`)
  defines every nail attribute with a `category` (color, nail_shape, finish, style, …), and
  `merchant_style.discovery_facets` already stores the per-style tag list, written by the AI
  breakdown pipeline (migration 0016, `src/nail-ai/breakdown.ts`). The PRD's
  `style_tag_definitions` / `style_tags` would duplicate both.
- **The AI brain already exists.** Recognition + breakdown already emit tags, price, and
  duration. The PRD's 8.3 auto-tagging + price/duration suggestion is a second brain.
- **Cold start kills the demo.** Every feature reads accumulated events; a hackathon cannot
  generate weeks of real traffic. The PRD's own non-goals warn against "overbuilding a data
  pipeline before collecting events," then specify exactly that pipeline.

The catalog vocabulary is Chinese (裸色 / 椭圆形 / 韩系 / 法式 / 金属感 / 甜美); the PRD's
English examples (pink / almond / french / chrome / coquette) are illustrative only.

## Decision

Build the intelligence layer **demo-truth and event-sourced**, hero'd on **merchant demand
intelligence**:

1. **Seed the history; keep capture real.** Only two things are stored: a seeded `customers`
   table and a real `analytics_events` log. `trackEvent` writes live events; a seed script
   writes ~2 weeks of history for fixed personas. Live demo actions append on top.
   > **Addendum (2026-07-02) — reseed semantics.** In production, capture *accumulates* (append-only).
   > For demo freshness, `npm run seed:intelligence` **resets** the demo merchant's `analytics_events`
   > by default (so the rolling "this week vs last week" story isn't skewed by stray live events). Pass
   > **`--preserve-live-events`** to keep live events and clear only seed-sourced rows (`event_source='seed'`
   > / `session_id like 'seed-%'`). So "append on top" holds within a run and with the flag; a default
   > reseed is a reset.
2. **Compute on read — no materialized metric/profile tables.** Customer profiles, daily
   metrics, demand trends, catalog gaps, low-conversion flags, and ranking are all derived on
   read from `analytics_events` through the catalog adapter. Every number traces to an event.
   A materialized rollup is added only if a specific query is measured to be slow.
3. **The catalog is the taxonomy.** Reuse catalog `category` + `discovery_facets` via a shared
   adapter (extends `src/features/customer/style-facets.ts`). No new tag tables. Trending is an
   event count over time; synonyms, if a free-text search needs them, are a small code map.
4. **Hero = merchant demand intelligence.** Insights dashboard at a dedicated `/merchant/insights`
   route and a customer-intelligence panel in `/merchant/messages`. Customer personalization is a single
   thin, reason-coded ranking function. Technician analytics reuse the existing workload card.
5. **AI is subordinate to computed metrics.** Reuse the existing model client. Summaries
   receive structured, pre-computed numbers and may only narrate them; they must say "not
   enough data" when evidence is weak and must never invent numbers.
6. **No tenant/RLS retrofit, no A/B infra, no cron.** Scope by `merchant_id`. Keep the
   `algorithm_version` field for future comparison but build no experiment system. Aggregation
   is on-read or a single seed/refresh script, not a job scheduler.

Identifier columns in `analytics_events` are `text` to match existing `text` primary keys
(`merchant_style.id`, `bookings.id`, `technicians.id`, `merchants.id`). The live demo customer
maps the mock customer session to the **Melissa** persona so her profile and the dashboard move
during the demo.

## Design Principles

- One source of truth for tags (the catalog); never a parallel taxonomy.
- All intelligence numbers trace to `analytics_events`.
- Reuse the existing recognition/breakdown/pricing brain; do not add a second one.
- AI narrates computed metrics; deterministic logic owns the metrics.
- Minimal real schema; derive everything derivable.
- Honest seeded dataset, framed as such; capture stays real so it can accumulate after the demo.

## Consequences

- **+** Two tables instead of twelve; no duplicate taxonomy; no pricing-brain split; fast at
  demo scale; honest provenance.
- **+** `trackEvent` is real, so the system keeps working (and starts truly accumulating) if it
  outlives the demo.
- **−** Compute-on-read recomputes per request. Acceptable at demo scale (hundreds–low-thousands
  of rows); revisit with a rollup only if measured slow.
- **−** Seeded history is not organic accumulation. Acceptable for a competition; disclosed.

## Alternatives considered

- **Materialize the PRD's metric/profile tables + refresh job.** Rejected: large schema and a
  job to maintain for no demo-visible gain over compute-on-read.
- **Build real auth + customer accounts + tenant/RLS + event pipeline.** Rejected: contradicts
  the hackathon timeline and the PRD's own non-goals; intelligence would be empty at demo time.
- **Build the PRD's parallel `style_tag_definitions` / `style_tags`.** Rejected: duplicates the
  catalog and `discovery_facets`, reintroducing the taxonomy-drift bug already fixed this cycle.

## Addendum (2026-06-08): funnel-coherent seed + data-story presentation

The first insights surface presented computed numbers as siloed text lists with no spine and
over-claimed precision at low volume. Two refinements (they extend, not reverse, this ADR):

- **Seed must be funnel-coherent.** The original seed generated outcomes (try-ons, bookings,
  searches) but no top-of-funnel, so `snapshot` had 0 impressions and try-ons (35) above clicks
  (5) — no honest funnel could be drawn. Fix is **additive**: keep every existing event, layer
  monotonic `style_impression`/`style_card_click`/`style_detail_view` above each try-on beat,
  proportional per style. Every number still traces to an event (§2 holds); the seed stays
  disclosed-as-seed.
- **Presentation = one journey spine + 3 acts**, hand-rolled SVG/CSS (no chart dependency), with
  honesty rules codified in the components (counts primary; rates gated by sample size; explicit
  units; never draw an inverted funnel). This is the §5 "AI narrates computed metrics, never
  invents numbers" principle applied to the visual layer.

Detail: `docs/plans/2026-06-08-merchant-insights-data-story.md`.
