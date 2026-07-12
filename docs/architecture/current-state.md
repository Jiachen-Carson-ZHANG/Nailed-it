# Architecture: Current State

Last updated: 2026-07-12

## Agent runtime v3 (ADR-0014 → 0016, 2026-07-11/12) — supersedes parts of "Recent additions" below

The agent service moved from restate-and-execute to **facts → briefs → bounded executor autonomy**:

- **Business engine emits facts, never verdicts** (`src/domain/decision/decision.ts`): 4 scores +
  signal tags + ad economics + coupon economics (floor price binary-searched from the profit/hour
  floor). The `candidate: ad|coupon|display_only|skip` output is gone (ADR-0016 §1).
- **Action Briefs**: 决策 (strong tier) receives an injected strategic environment (mission /
  policy snapshot / capacity / candidate index — `_decision_context`) + memory hints, and submits
  briefs (objective + hard boundaries) via the schema-enforced `submit_action_brief` tool;
  `simulate_action_portfolio` checks the combined plan deterministically (attribution conflicts,
  budget competition, capacity pressure). Briefs land on the blackboard and are injected verbatim
  into executors; tools enforce them as law (`budget_exceeds_brief` refused pre-side-effect).
  Live-hardened (2026-07-12): the marketing **wallet** is law too (`committed_budget_cents` = draft
  asks + active unspent remainder; spent money is history), one campaign per style (live → revise
  in place; ended → fresh run with version++ and measured history archived to zero), and an
  executor dispatched with an EMPTY brief set refuses to spend (`no_ad_brief_filed`) — the strong
  tier was measured narrating brief submissions it never made; prose can never become spend. The
  merchant's weekly focus (`pref-weekly-focus` preference row) is lifted into
  `mission.merchant_weekly_focus` — deterministic mission state, not a rankable memory hint.
- **Ad sandbox** (`nailed_agents/sandbox.py`, migration `0033`): 3 audiences, deterministic forecast
  (ranges + saturation + frequency fatigue) from public priors, delivery from **hidden scenario
  state** (same seed → same divergence), campaign state machine with versioned in-place revisions,
  and an accelerated business clock (`python -m nailed_agents advance-clock` — operator control,
  never an agent tool). 投广 runs a forecast-compare loop and may report a brief **infeasible**.
- **Risk Reviewer** (10th agent, strong tier): soft-risk verdicts over the brief portfolio
  (`[APPROVED]/[APPROVED_WITH_CONDITIONS]/[REVISION_REQUIRED]/[MERCHANT_APPROVAL_REQUIRED]`);
  the orchestrator gates executors on REVISION_REQUIRED and skips the reviewer when no briefs exist.
- **Coupon templates**: discounts only from merchant-pre-approved templates; code computes prices and
  refuses below the floor; the agent configures restrictions (window/count/expiry/audience).
- **Message classes**: transactional notices auto-send labeled 【Nailed-it 商家助手】; relationship
  marketing only ever creates a merchant-send draft (`draft_customer_message`, human gate).
- **Merchandising verbs**: `deprioritize_style`/`feature_style` adjust exposure allocation; agents
  never remove assets (true stop-sale is merchant-only).
- **Memory v2 + context routing** (ADR-0014/0015, 2026-07-11): deterministic context injection
  (CONTEXT_POLICY + execution/due lists with real action ids), monitor-only anchored memory writes
  (`record_action_outcome` — code derives identity/comparison/expiry), relevance-scored
  `search_memory` with per-agent domain access, prompt identity on every run (`prompt_sha` +
  final rendered task persisted), 团队记忆 card on `/merchant/agents`.
- **Model tiers (measured)**: strong tier (gemini-2.5-pro) = orchestrator, decision, ad, coupon,
  reviewer, monitor — each moved after a measured flash chain-abandonment/narration failure; flash =
  insight, trend, catalog, customer_ops. Provider fallback `MODEL_PROVIDER=gemini` (direct Google
  endpoint) with bounded reasoning and temperature 0.2.
- Eval: 14 scenarios, five blocking gates, all green at n=2 on gemini-direct. Migrations `0030`–`0033`.
- **Live-verified** (2026-07-12, finals-a, doc 08 §2): briefs → `[APPROVED]` → forecast loop →
  placement + an infeasible report → delivery diverged from the hypothesis (CAC ~2×) → same-entity
  revision to v8 → monitor outcome memories + a bright-line-cited non-revision → next 决策 cites
  the memory by id.

## Stack

Next.js App Router, TypeScript, mobile-first shell (`MobileLayout` + `TopBar` + `BottomTabBar`). Operational booking, messaging, pricing, scheduling, and merchant-style data use Supabase behind a repository seam. The booking draft remains in per-tab `sessionStorage`. AI calls run server-side through API routes or server actions.

## Recent additions (2026-07-06 → 2026-07-10)

Additive to the subsystems below; see the ADRs for detail.
- **Merchant 今日 home (ADR-0011).** Tab-1 (`/merchant/calendar`) is the agent-first ops home: one deterministic read model (`src/domain/merchant-home.ts` + `getMerchantTodayHomeAction`, compute-on-read, per-field failure isolation) driving a stat strip / needs-you feed / technician roll + a reasoning drill-down sheet (`AgentRunSheet`). The full calendar moved to `/merchant/calendar/schedule`.
- **StyleAd ad campaigns (merged from `main`).** A 投广中心 at `/merchant/ads` + per-style editor at `/merchant/styles/[id]/ads`; entity `src/domain/style-ad.ts` (status draft→active→paused→ended, promotion goal, ROI/exposure targets, audience, schedule); migrations `0022_style_ad_campaign` + `0023_style_ad_campaign_goal`/`0024_style_ad_exposure_range`/`0025_style_ad_promotion_settings`. Merchant-authored today; agent-proposed drafts land in Phase 2.
- **Agent action↔entity contract (ADR-0012, migrations `0027`–`0029`).** `agent_actions` carries a polymorphic forward link (`entity_type`/`entity_id`); `style_ad_campaign` + `groupbuy_deal` carry `source_run_id` (the backward link). Group-buy moved off browser `localStorage` into `groupbuy_deal` + relational `groupbuy_deal_item` behind a `GroupbuyRepository` seam; `save` is one atomic RPC (`save_groupbuy_deal`, `0029`) so a deal never persists with a half-written item list. `src/domain/action-entity-contract.ts` holds the status state machine **and the withdrawal targets**.
- **Entity-aware undo (ADR-0012 Phase 2).** Undo/reject withdraws the **real entity first** (pause the `StyleAd`, unlist the `GroupbuyDeal`), then mirrors the coarse `agent_actions.status`. A mid-way failure therefore leaves money *stopped*, not merely reported as stopped — the entity's own status is authoritative. Applied irreversible actions (a sent message) are refused before any entity is touched.
- **Dynamic orchestration (ADR-0013 P0+P1, 2026-07-10).** The round is no longer a fixed Python chain: 运营助手 runs as an agent (`ORCHESTRATOR_MODEL`, stronger tier) with `dispatch_agent`/`dispatch_many` tools — it reads the briefing + decision brain itself, decides which lanes to wake, skips with citable numbers (full capacity → no 投广/团购 dispatch; eval-pinned), and fans independent executors out in parallel. Deterministic guardrails stay in Python (`RoundState`: lane whitelist, one dispatch per agent, dispatch budget); per-lane tool allow-lists unchanged. Proposal hygiene: `propose_listing` supersedes older rounds' pending proposals, dedupes by gapTag, and caps at `MAX_PENDING_PROPOSALS` (5). P2 (round blackboard + cross-round memory) and P3 (monitor revision edge) pending.
- **Merchant-readable agent transcripts (UI-alignment pass, 2026-07-10).** All thinking-chain surfaces render through one pure describer (`src/domain/agent-transcript.ts`: per-tool one-sentence summaries, action sentences, entity deep-links, latest-per-entity dedupe) + one shared renderer (`TranscriptChain` — Multica-inspired tone pills; raw payloads only inside a capped `查看数据` expander). The 今日 sheet and the run page therefore read identically. AI-proposed entities are marked and auditable everywhere: 团购管理 detail and 投广中心 rows link back to the proposing run (`source_run_id`), the ads center gains a live-campaign 暂停 button on `withdrawStyleAdCampaignAction`, and `?panel=groupbuy` deep-links the manage tab.
- **Decision brain (ADR-0012 Phases 1–2, `src/domain/decision/`).** Pure, advisory per-style analysis: `economics` → `funnel` → `capacity` (utilization + fragment-fit) → `ads` (ROAS + measured exposure) → `decision` (4 scores + rule engine → `ad|coupon|display_only|skip` + signal tags). The ad lever additionally requires `expectedRoas ≥ targetRoi` (unknown ROAS is a NO) and measured underexposure (`impressionShare / demandShare < 0.8`). Deterministic; the agent synthesizes and narrates. Served to the 决策 agent by `getStyleBusinessDecisionsAction` via `GET /api/agent/decisions`.

## Entry points

| Route | Purpose |
|---|---|
| `/` | Landing page (`src/components/landing/`) or role dispatch via `src/domain/session.ts` |
| `/customer/*` | Customer flows: discovery, style detail, booking, try-on, messages, profile |
| `/merchant/*` | Merchant flows: calendar, booking detail, roster/manage, insights, messages, profile |
| `/merchant/insights` | Merchant demand-intelligence dashboard: snapshot, demand trends, design performance, catalog gap, grounded AI summary |
| `/merchant/styles` | Merchant-owned style collection: one-image upload, preview, archive |
| `/merchant/styles/[id]/review` | Dedicated AI suggestion, catalog configuration, quote preview, save, publish, and archived republish workspace |
| `/merchant/agents` | Merchant operations agent-team panel: team, runs, transcripts, actions, approval gate |
| `/privacy` | Public privacy disclosure (no auth required) |
| `/api/integrations/pinterest/callback` | Placeholder Pinterest OAuth redirect URI |
| `/dev` | Internal dev/debug page |

## AI API routes

| Route | Model | Purpose |
|---|---|---|
| `/api/ai/recognize-nail-style` | Volcengine Ark `responses` (`ARK_VISION_MODEL`) | Image → nail attributes + confidence for booking |
| `/api/ai/try-on` | Ark `responses` validation + Ark `images/generations` (`ARK_IMAGE_MODEL`) | Hand + style images → try-on composite |
| `/api/ai/breakdown` | Volcengine Ark `responses` (`ARK_VISION_MODEL`) | Image → strict-schema catalog selections; effective merchant pricing is loaded server-side before returning the quote |
| `/api/ai/trending-styles` | Volcengine Ark `responses` (`ARK_TRENDING_MODEL`) | Text → ranked trending style suggestions |

## Persistence layer

A repository seam and a Supabase (Postgres) implementation exist, and the customer + merchant surfaces are **cut over to the DB** (P4c/P4d) through server actions in `src/lib/actions/`:
- **Writes**: catalog-backed custom images and published styles create an interval booking + relational items + linked conversation thread + greeting in **one transaction** (the `create_booking_with_thread` RPC, migration `0010`). The server reloads/validates catalog selections and recomputes price/duration for the selected technician; browser totals are ignored. The legacy flat snapshot action remains only as an explicit compatibility fallback and always enters `pending_review`.
- **Reads**: calendar / merchant profile / booking detail use `listMerchantBookingViewsAction`; customer profile uses `listCustomerBookingViewsAction` (server-filtered to the demo customer — private bookings never reach the browser). Messages use customer/merchant-scoped conversation actions that fix the actor server-side. Catalog-backed confirm availability quotes each technician separately, attaches that exact quote to the offered slot, and uses the same selections + technician at create time.

The only browser-local booking state left is the booking **draft** (`sessionStorage`). **Known gap — no auth:** without a session there is no real server-derived actor, so a direct caller could still invoke the merchant-scoped reads. True cross-account authorization needs the auth system (a future ADR). **ADR-0005's phase table is authoritative for phase numbers and status.**

Repositories live in `src/lib/repositories/` (async interfaces in `types.ts`; in-memory + Supabase impls; `getRepositories()` selects Supabase when env is present and not under test, in-memory otherwise so tests never hit the network):
- **Bookings, conversations/messages, technicians, styles, pricing rules** — P0/P1, the interim flat model.
- **Catalog** (`catalog_item`) — P1.5. Generated from the Lark "Dictionary" sheet into `src/mock/catalog.ts` (109 items) by `scripts/generate-catalog.mjs` (validates enums / parent refs / `affects=yes`→duration and refuses to emit inconsistent data). Platform source of truth for what can be priced + default durations. Each item now carries a platform `defaultPriceCents` (null = merchant must price it); the sheet's allowed-units list was retired, so `allowedPricingUnits` is the single default unit.
- **Merchant pricing** (`merchant`, `merchant_pricing`) — P2 + Phase 2.5. Sparse per-merchant overrides; `src/domain/pricing-resolver.ts` resolves effective pricing in precedence order: merchant override → `merchant`; else the catalog `defaultPriceCents` → `catalog_default`; else a required-price item with no default fails closed (`unresolved`, disabled). Merchant Manage reads/writes this table through server actions, and the breakdown API loads it server-side.
- **Staff availability** (`working_plan`, `blocked_time`) — P3. Reuses `technicians` as the staff/provider entity (no parallel `staff` table); `technicians` carries a `merchant_id` tenant owner (migration `0005`) so availability is scoped per salon. `working_plan` is recurring weekly hours per technician per weekday (0=Sun…6=Sat) with mid-day breaks as a JSONB `{startMin,endMin}` array; `blocked_time` is one-off calendar blocks as absolute instants. The live confirm grid calls the DB-backed availability action, which combines these records with interval-booking occupancy through the pure overlap kernel in `src/domain/scheduling.ts`.
- **Interval bookings** (`booking`, `booking_item`) — P4a/P4c/P4d. `booking` locks a technician over `start_at…end_at` and carries `merchant_id`; `booking_item` is the persisted 积木 quote snapshot. No-double-book is enforced in Postgres by a partial GiST exclusion constraint (`technician_id` + `tstzrange`, excluding cancelled), and creates run through the `create_booking` RPC (booking + items in one transaction). The confirm flow writes here, and calendar/profile/detail surfaces read these rows through scoped server actions.
- **Per-staff durations** (`staff_item_duration`) — P4a. Override table for items whose `duration_config_level='staff_level'`; P4b's quoteService prefers a staff override over the catalog default.
- **Intelligence layer** (`customers`, `analytics_events`) — ADR-0006 (migration `0017`). Two real tables; everything else — customer profiles, demand trends, catalog gaps, low-conversion flags, ranking — is **computed on read** from the event log through the catalog adapter (no materialized metric/profile tables). `customers` holds seeded personas (the live demo customer Melissa maps to `cust-melissa`); `analytics_events` is a real behavioural log written by `trackEvent`. See the Intelligence layer section below.
- **Merchant style library** (`media_asset`, `merchant_style`, `merchant_style_item`) — P6.5 + Phase 2. A media asset owns the private original and optional public published Storage object paths; a merchant style owns review/publication state, a `description`, JSONB `discovery_facets`/`recognition`, and a preview price/duration that is **derived, never typed**. The authoritative catalog breakdown is the relational `merchant_style_item` table (FK → `catalog_item`, quantity), not jsonb — so a removed catalog id can't silently rot a style. A single-image upload only stores the private original and creates a `processing` style, then immediately routes to the phone-sized `/merchant/styles/[id]/review` workspace. The merchant explicitly clicks **AI breakdown** there; that action atomically claims the analysis job, downloads the stored original server-side, runs the shared strict-schema AI catalog recognizer, and commits title/description/facets/normalized items/derived preview plus the `needs_review` transition through the atomic `complete_merchant_style_analysis` RPC; failure transitions to an editable manual-review draft. The claim has stale-job recovery and prevents duplicate model calls from concurrent page loads. Save, publish, and archived republish re-derive price/duration through `quoteService`; republish recreates the public Storage copy and clears `archived_at`. Publishing still requires explicit merchant approval. Customer discovery/detail return published records only, including their `catalogBreakdown` so the booking flow can re-quote it. Merchant Me shows a collection preview. The old `styles` table remains temporarily for migration compatibility.

DB access: `src/lib/db/client.ts` is the server-only Supabase client (secret key, bypasses RLS). All app reads go through it; nothing uses the anon key. Migrations: `0001_init.sql` (bookings/messages/etc.), `0002_catalog.sql` (catalog_item + CHECK constraints mirroring the TS unions), `0003_merchant_pricing.sql` (merchant + merchant_pricing, RLS with no anon policies), `0004_staff_availability.sql` (working_plan + blocked_time, FK technicians), `0005_hardening_tenant.sql` (drops anon SELECT from the operational tables — only `styles`/`catalog_item` stay publicly readable — and adds `technicians.merchant_id`), `0006_interval_booking.sql` (booking + booking_item, btree_gist exclusion constraint, `create_booking` RPC; server-only), `0007_staff_item_duration.sql` (per-staff duration overrides; server-only), `0008_booking_tenant_fk.sql` (booking tenant and RPC hardening), `0009_merchant_style_library.sql` (`media_asset` + `merchant_style`, private/public Storage buckets, transactional create/publish RPCs), `0010_booking_thread_rpc.sql` (`create_booking_with_thread` — booking + items + thread + messages in one transaction; server-only), `0011_catalog_default_price.sql` (adds `catalog_item.default_price_cents`; drops the 7 items removed from the dictionary — re-run the seed afterwards to upsert the refreshed rows + 4 new items), `0012_merchant_style_description.sql` (`merchant_style.description` + 9-param `publish_merchant_style`), `0013_merchant_style_item.sql` (relational `merchant_style_item`, drops `merchant_style.catalog_breakdown` jsonb, `set_merchant_style_config` RPC), `0014_merchant_style_integrity.sql` (quantity bounds and atomic config/publish hardening), `0015_per_set_quantity.sql` (rejects direct relational writes whose effective pricing unit is `per_set` but quantity is not one), `0016_merchant_style_analysis_workflow.sql` (stale-recoverable analysis claim plus atomic stored-image analysis completion/failure transitions; server-only), `0017_intelligence_layer.sql` (`customers` + `analytics_events`, text ids, server-only RLS with no anon policies; applied manually in the Supabase SQL editor), `0018_republish_archived_merchant_styles.sql` (allows explicit archived-style republish through the same reviewed config/publish RPC path), `0019_message_style_attachment.sql` (message style-card attachment JSONB), `0020_cleanup_non_quoteable_style_items.sql` (removes non-quoteable container rows from merchant style items), `0021_conversation_thread_customer_language.sql` (persists thread language), and `0022_agent_orchestration.sql` (`agents`, `agent_runs`, `agent_actions` for ADR-0007). `scripts/seed-supabase.ts` seeds the relational dependencies; `npm run configure:styles` backfills each live style's relational breakdown + derived price in place; `npm run seed:intelligence` writes the demo personas + ~2-week backdated event history (idempotent — replaces only `session_id like 'seed-%'`, preserving live capture); `npm run seed:agents` writes the demo agent definitions and cold-start runs.

Media Storage:
- `merchant-style-originals` is private and stores merchant uploads.
- `merchant-style-published` is public customer-showcase content.
- Postgres stores stable object paths; it does not store base64 images or signed URLs.
- Server actions validate image MIME type/size and generate object paths. Publish copies the reviewed original to the public bucket before atomically updating media/style records; failures compensate by removing orphaned Storage objects.
- Melissa's local showcase set is backfilled by `npm run backfill:melissa-assets`: files from `nail_assets/*.jpg` are uploaded to both buckets under `merchant-nailed-it/melissa/...` and inserted as published `media_asset` / `merchant_style` rows with deterministic ids. This is separate from `seed:supabase`, which still preserves the legacy external-image demo rows.

Service layer (`src/lib/services/`, orchestration over repositories):
- `quoteService` — catalog + merchant pricing (+ per-staff duration) → priced, duration-aware quote lines; fails closed on unresolved required pricing and malformed quantities, and normalizes `per_set` quantities to one before price/duration calculation.
- `merchantPricingService` — catalog + effective merchant pricing → merchant edit view; validates and persists overrides through the repository seam.
- `availabilityService` — resolves a merchant-local slot (timezone) and returns the merchant's available technicians via the scheduling kernel.
- `bookingService` — create (quote → resolve slot → transactional create, throws `booking_overlap`), cancel, status lifecycle; enforces the technician-belongs-to-merchant tenant guard. `createBookingWithThreadFromSelections` books validated selections into relational `booking_item` rows + the thread atomically. Published styles and configured custom-image breakdowns use this path; the legacy snapshot path remains only for old/unconfigured drafts.
- `timezone.ts` — merchant wall-clock → weekday + local-minute range + epoch-ms interval. The 5 P4b gates: 2/3/5 in `src/lib/services/*.test.ts`, DB-only 1/4 in `scripts/check-db-gates.ts` (`npx tsx`).

Known gaps:
- **No authentication:** merchant-style and other merchant actions are fixed to the single demo merchant server-side; true cross-merchant authorization needs an authenticated session.
- **Historical style reconciliation:** `0015` prevents new invalid `per_set` quantities after it is applied, and all app writes normalize before pricing/persistence. Existing live style rows created before this rule must be deterministically reconfigured so their relational quantities and preview snapshots are recalculated together.
- **Batch administration:** the existing `npm run configure:styles` script remains an admin workflow; there is intentionally no batch-upload/review UI. Single merchant uploads move `processing` → `needs_review` and remain private until manually published.
- **Deployment:** migrations `0016` and `0018` must be applied before the review route can complete/fail stored-image analysis and republish archived styles against the live Supabase project.
- **Legacy cleanup:** the old `styles` and flat booking/pricing tables remain pending P4e cleanup.

## LLM integration

Image-related AI flows now use Volcengine Ark. `nail-recognition`, image breakdown, style-name recognition, try-on validation, and trending styles route through Ark `responses`; final try-on image generation routes through Ark `images/generations`. The remaining text-only `insights-summary` flow still uses OpenRouter. Breakdown and style-name calls continue to validate parsed JSON again at runtime; invalid output retries and then leaves the upload for manual review. All pricing/booking decisions remain deterministic app logic — AI only extracts attributes.

**Recognition → catalog bridge (P6):** `src/domain/recognition-catalog.ts` is the pure layer that turns recognizer-emitted `catalog_item` ids + confidence into a `detected` set and an `uncertain` set the user confirms, then into `CatalogSelection[]` for `quoteService` (`bucketRecognition` / `toCatalogSelections`; the constrained subset is `aiDetectableCatalogItems`). It deliberately validates ids rather than mapping visual attributes. Merchant style uploads use the glossary-driven catalog-id recognizer; the separate customer nail-attribute recognizer still emits free-form attributes.

## Intelligence layer (ADR-0006)

Event-sourced, compute-on-read demand intelligence. Only two tables are stored (`customers`, `analytics_events`, migration `0017`); profiles, trends, gaps, low-conversion flags, and ranking are all derived on read so every number traces to an event.

- **Capture.** `trackEventAction` (`src/lib/actions/analytics-actions.ts`) writes one `analytics_events` row; the fire-and-forget client helper `track()` (`src/features/analytics/track.ts`, per-tab session id) and `TrackOnMount` never break a user flow. Wired surfaces: feed click/save (`StyleCard`), filter search submit/no-result (`StyleWaterfallGridClient` — tag filters are catalog-label intents), style detail view, try-on completion, and `booking_confirmed` server-side in the booking action (carries `style_id` for per-style conversion). `style_impression` (IntersectionObserver) is deferred — the seed supplies impression history.
- **Taxonomy = the catalog.** `src/domain/catalog-tags.ts` (`categoryOf` / `tagsByCategory` / `isServiceModule`) is the single tag→category adapter; the feed filter (`style-facets.ts`) consumes it. No parallel tag tables.
- **Read model.** `src/domain/intelligence/` — pure, `now`-injectable functions: `getCustomerProfile` (weighted, time-decayed tag affinity + budget), `getMerchantInsights` (snapshot, demand trends this-vs-previous period, design performance incl. high-interest/low-conversion, catalog gaps with the ADR ≤1 rule), `rankStyles` (affinity + popularity + freshness, reason-coded — one function, two call sites), `getCustomerIntelligence` (profile + recommendations + appointment context).
- **Surfaces.** `/merchant/insights` (`getMerchantInsightsAction` + grounded `summarizeInsights`, which narrates only pre-computed numbers and falls back to a deterministic summary when the model is unavailable); the customer-intelligence panel in the merchant conversation view (`CustomerIntelPanel` + `getCustomerIntelligenceAction`; "发送" logs `recommended_style_sent`); and the customer feed re-ordered for the demo customer without showing the internal ranking reason chip (`getRankedFeedAction` → `PublishedStyleFeed`).
- **Demo dataset.** `npm run seed:intelligence` writes ~43 personas (Melissa + Amy + Rachel + 40 anonymous volume) + ~2 weeks of backdated events whose per-style funnel is **sampled from latents** via a seeded PRNG (reproducible yet organic — see `src/mock/prng.ts`, `style-latents.ts`, design spec 2026-06-27). The seed resets `merchant-nailed-it` analytics by default so stale rehearsal events cannot pollute the rolling windows; pass `-- --preserve-live-events` only for an intentional append-style run. Narrative anchors: gap tag 暗黑 (under-supplied, ≤1 active matching style; live is usually 0) / low-conversion 8284 / top converter 8265. The regression `src/mock/intelligence-seed.test.ts` runs the read model over the generated seed and asserts the narrative as bands. Re-seed shortly before a demo to keep the this-week/last-week windows fresh; `npm run preflight` checks the live values.

## Agent team (ADR-0007) — Phase 3

Merchant operations agent team: **reasoning is a full Python tool-call service**; **OpenRouter is the default demo model provider via the OpenAI-compatible SDK**; **Anthropic `tool_runner` remains an optional provider path**; **Supabase is the shared bus**; the panel UI is TS. The Python service never re-derives metrics — it reads grounded briefing/customer data from TS.

- **Substrate (migration `0022`).** `agents` (agents-as-data: slug/name/role/`instructions`/`tools`), `agent_runs` (targeted run + jsonb `transcript` thinking-chain + `parent_run_id` loop), `agent_actions` (type/risk/status/payload — the undo ramp). Read via `AgentRepository` (memory + supabase, ADR-0004); `src/domain/agents.ts`.
- **Grounded reads.** `GET /api/agent/briefing` reuses `getMerchantInsightsAction`; `GET /api/agent/customers` returns a server-derived customer roster. Agents act on these numbers/signals rather than inventing metrics.
- **Python service (`agent-service/`).** `config` selects `MODEL_PROVIDER=openrouter` by default or `anthropic` explicitly. `runner` uses the OpenAI-compatible function-call loop for OpenRouter and Anthropic SDK `tool_runner` for Anthropic; both execute the same plain Python tool bodies. `orchestrator` runs the deterministic full chain: 数分 → 决策 → 投广 → 团购 → 运营(上下架) → 用户运营 → Monitor → 数分'. Run: `python -m nailed_agents`.
- **Surfaces.** `/merchant/agents` (team + recent runs) + `/merchant/agents/runs/[id]` (thinking chain + one-click undo on reversible actions + approve/reject for proposed listing); entry card on the merchant Me page. `npm run seed:agents` writes the definitions + a full demo loop so the panel renders before the service runs.
- **Phase 3b partial.** The panel can trigger a local dev round by spawning `python -m nailed_agents`, and in-context cards render applied `agent_actions` on the style library, price config, and boss-message surfaces with one-click undo. These cards are still backed by `agent_actions` payloads; true business-side effects (real ad/coupon/message entities), streaming, and actual publish-on-approve into `merchant_style` remain pending.
- **选品 trend matching (ADR-0008, migration `0023`).** The trend agent matches trends→catalog behind `MATCH_MODE=tag|concept`. `concept`: each nail photo is enriched once to a VLM CN concept (cached in `style_concept`, pgvector), then a trend keyword matches via embed (`EMBED_PROVIDER`, default **Google gemini-embedding-001**) → pgvector cosine top-k → **Cohere rerank** → threshold; degrades to tag-overlap per-trend on error. Concept rows carry `matchSource`/`matchWhy` (auditable) and re-enrich on (media, model, pipeline_version) change. Live trends come from `TREND_SOURCE=fixture|pinterest` (Pinterest = keyword+growth, no images; `interests=beauty`, region Western-only). `trend_logic.trend_opportunities` stays pure (matcher injected). Enrich: `python -m nailed_agents.enrich`.

## Domain modules (`src/domain/`)

- `session.ts` — route intents, tab visibility, home paths, detail-link helpers for both roles
- `nail.ts` — shared nail/booking/technician/quote contracts; confidence-review policy (low-confidence → `pending_review`)
- `pricing.ts` — legacy rule-based quote calculator retained for old flat snapshot drafts
- `availability.ts` — pure technician-slot assignment (no same-technician/date/time conflicts; earliest-wait ranking)
- `booking-draft.ts` — sessionStorage draft boundary across `/customer/booking` → `/customer/booking/confirm`
- `merchant-style.ts` — merchant media/style lifecycle and customer-safe published-style mapping
- `messaging.ts` — role-aware mapping from repository-backed booking threads to the shared `Conversation` UI contract

## Glossary (`src/data/`)

- `glossary.ts` — prompt-facing glossary views derived from canonical `src/mock/catalog.ts`, including `type_zh` translations. Provides `billableComponents`, `aiDetectableComponents`, `serviceModules`, and `glossaryById` lookup without maintaining a second catalog-id list.

## Mock data (`src/mock/`)

`styles.ts`, `merchant-styles.ts`, `bookings.ts`, `conversations.ts`, `technicians.ts`, `pricing.ts`, `customers.ts` — seed/demo data.
`ai.ts` — sample image path so booking flow works without a provider key.

## LLM adapters (`src/nail-ai/`)

- `openrouter.ts` — legacy-named compatibility wrapper that maps the existing OpenRouter-style payload shape onto Volcengine Ark `responses`
- `nail-recognition.ts` — Ark image recognition; structured JSON output; normalises to supported nail attributes; logs `[nailed-it:vision-cost]` telemetry when `VISION_COST_LOGGING_ENABLED` is not `false`
- `try-on.ts` — Ark validation plus Ark image generation
- `breakdown.ts` — Ark glossary-driven catalog-id extraction; the API validates against server-loaded effective merchant pricing and requotes selections through `quoteService`
- `style-config-recognition.ts` — Ark style name/config recognition for merchant style review
- `trending-styles.ts` — Ark trending style feed
- `insights-summary.ts` — remaining text-only OpenRouter summary path
- `usage-cost.ts` — usage metadata parser and USD cost estimator

## Testing

Vitest for unit/integration tests (`.test.ts` / `.test.tsx` colocated with source). Playwright for e2e (`e2e/`). Run with `npm test`.
