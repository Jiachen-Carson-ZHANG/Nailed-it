# Implementation Log

## 2026-07-14 — Deterministic Orchestration Runtime replaces default LLM orchestrator

What changed:
- `run_round()` now defaults to `ORCHESTRATION_MODE=runtime`: known business triggers are routed by
  code, not by a separate LLM orchestrator call.
- Planning rounds run insight → trend → decision, then dispatch ad/coupon strictly from structured
  Action Briefs (`state.briefs`) **after** 决策 has completed `simulate_action_portfolio` with
  `feasible=true`; catalog/customer_ops run through independent non-spend candidate gates (陈列候选 /
  可召回老客候选) rather than the marketing portfolio gate; monitor still runs last as the snapshot
  barrier.
- Follow-up triggers (`evidence_matured`, `threshold_alarm`) route directly to monitor. Parameter-level
  fixes continue through the existing bounded edge: monitor `request_revision` → original executor →
  same entity.
- The old LLM orchestrator is preserved as `_run_round_llm_orchestrator` for `merchant_request` /
  `open_request` and for `ORCHESTRATION_MODE=llm`.

Why:
- A fixed weekly/evidence/threshold workflow does not need an LLM to rediscover routing. The valuable
  control plane is the runtime: trigger handling, allow-lists, context injection, blackboard, lineage,
  dispatch budget, Action Brief routing, and persistence.

Aligned assumptions:
- Decision still does not own dispatch authority; it emits structured intent. Runtime routes it.
- The runtime never parses agent prose for spend. Only feasible, simulated `state.briefs` and code
  guardrails can route ad/coupon.
- Non-spend executors should not run just to discover emptiness. Runtime may skip catalog/customer_ops
  when their grounded candidate gates are empty, and must record the skip reason in the transcript.
- Open-ended merchant questions can still use the LLM orchestrator because task decomposition is
  genuinely unknown there.

## 2026-07-14 — Clarify Trend vs Merchandising lanes for the finals demo

What changed:
- **Trend Agent scope tightened** — it is now the read-only trend sensor: curated visual trend pack
  (`TREND_SOURCE=curated_visual`) + internal demand → concept/RAG or tag fallback matching → grounded
  opportunities. Pinterest remains optional keyword telemetry, not the primary demo source.
- **Merchandising lane renamed and bounded** — `catalog` is now presented as 陈列运营, not 上下架. Its
  preferred read tool is `get_merchandising_candidates`, returning `increaseExposure`,
  `decreaseExposure`, and `proposeListing`; existing styles are never deleted/delisted by this lane.
- **Prompt/data contract aligned** — catalog now parents to trend, handles at most three candidates, and
  may no-op. Legacy action ids (`feature_style`, `deprioritize_style`) remain for compatibility, but UI
  copy says 提高/降低推荐曝光.

Why:
- The old "上下架" language overstated the capability and made the catalog lane look like a deletion
  agent. The real product value is safer: use trend matching to tune exposure and propose new supply
  when the catalog has a gap.

Aligned assumptions:
- Commercial decisions remain in the deterministic brain + Decision Agent; Trend does not execute
  business actions, and Merchandising does not recompute business economics.

## 2026-07-14 — Runtime hardening (pre-finals audit): make the claims true in code

Closes the gap between the pitch and the runtime. Each item defends a specific stage claim.

- **Reviewer gate fail-CLOSED** (orchestrator): spend lanes (投广/团购) dispatch only on an explicit
  APPROVED / APPROVED_WITH_CONDITIONS verdict; missing/unparseable/REVISION_REQUIRED/
  MERCHANT_APPROVAL_REQUIRED all block. Was REVISION_REQUIRED-only → 风控 silence meant money out
  (fail-open). A blocked lane rolls back its dispatch slot so a later approval can re-dispatch it.
- **Action Brief atomicity** (tools + decision skill): added `withdraw_action_brief`; re-submitting the
  same (action_type, style_id) now REPLACES. A prose "撤回" after `simulate_action_portfolio` used to
  leave the conflicting brief live for reviewer + executors — the audit's most dangerous bug.
- **Trigger-aware execution** (P1-3): `run_round(trigger_kind, trigger_reason)` injects the firing
  reason into the orchestrator task and maps kind→trigger_source (cadence→schedule, alarm/evidence→
  event). Orchestrator runs no longer all say `manual`. Verified live: a threshold_alarm round recorded
  trigger_source=event with the CAC reason.
- **CAC alarm end-to-end** (P1-4): `fetch_campaign_outcomes` joins the place_ad payload hypothesis onto
  the campaign, so the 2×-CAC alarm has its baseline. Verified live: `实测获客成本 ¥16.67 超预测下限
  ¥8.08 的 2 倍`.
- **Evidence maturity codified** (P1-5): due-check is ≥24h ∨ ≥500 impressions ∨ ≥15 clicks (was
  `impressions > 0`), matching monitor.md.
- **Currency comment → CNY** (P1-6); +13 regression tests (test_gate_hardening.py); 91/91 pass.
- Deferred (say the honest sentence on stage): structured JSON verdict, planning/follow_up execution
  modes, enforcing the remaining brief fields.

## 2026-07-14 — Demo-week hardening: universal approval gate, in-sheet lineage, ×3 pricing, 7/16 calendar

- **Universal human gate** — setActionStatus's approve path was draft_upload-only; every PROPOSED
  action (coupon/ad included) now takes 批准/拒绝, in both repos + controlCapabilities.
- **Run sheet** — 批准/拒绝 live inside the popup on proposed action cards; 上下游 chips navigate
  IN-sheet with ‹返回 (full record stays one link away); sheet width = shell (430px exact).
- **今日 home v2** — silent retry for the read model (no error flash mid-demo); stat metric captions
  (本周营收/今日预约/本周热点); 管理 AI 团队 CTA; expandable 待确认 queue with per-row gates;
  美甲师管理 section removed.
- **Pricing ×3 (data)** — user call: SGD-magnitude numbers ×3 ≈ domestic RMB. All 39 merchant_pricing
  rows scaled; 38 previews resynced through buildQuote (styles now ¥120–510).
- **Breakdown prompt** — structure mandate: the recognizer must answer 本甲 or exactly ONE concrete
  structure billable; naming only the container (延长服务) is rejected. Fixes new uploads.
- **Demo calendar** — scripts/reseed-demo-calendar.ts: capseed bookings anchored 7/16–22 with per-day
  varied utilization (demo day busy, weekend rush, quiet Monday), live style names; 72 rows. Two stale
  test bookings on demo day removed.
- Merged origin/main PR #11 (C-end commercialisation: hand-match, 拼贴小屋, loading screen) — clean;
  feed scoping survived; one stale test CTA assertion updated.

## 2026-07-14 — Style library enrichment: own 中文名 + per-photo 建构/延长 (data, via gemini)

All 38 published styles carried the importer's placeholder title ("Melissa Design 8251") and no
structure items (the June import never detected 延长/建构). Enriched via a temp route (deleted after):

- **Names** — 11 curated demo labels (`src/domain/demo-style-labels.ts` — keeps agent-narrative names
  like 鎏金奢华 aligned) promoted into `merchant_style.title`; the other 27 named by gemini vision from
  their own photo (蓝星点点, 珍珠钻饰法式, 落英缤纷 …). One collision deduped with a shape qualifier
  (星河闪耀·杏仁). Feed/detail/booking now show each style's own name — zero "Melissa" remains.
- **建构/延长** — the general recognizer only names the container (延长服务), so a focused per-photo
  classifier asked: natural | builder_gel | which tip type. 29/38 got a concrete structure item added to
  `merchant_style_item` (20 建构, 6 浅贴, 3 全贴), 9 read as 本甲 and honestly got none. Previews
  resynced through `buildQuote` → item-traced ¥40–170 spread; card↔detail verified matching live, 建构
  chip lights on both sides.
- Currency context: prices are CNY-base since `0fdcd07` (no SGD conversion) — the enrichment prices
  land in that base.

## 2026-07-13 — "Reseed scare" triage: feed scoping, breakdown qty round-trip, gemini provider routing

Branch `feat/demo-uiux-polish` → main. User reported "breakdowns gone / images wrong / prices random"
after a reseed. Investigation: **no data loss** — all 45 merchant styles kept items (171 rows, FKs 0
orphans), real photos (storage 200s), and real per-item pricing. The reseed had only re-touched 3
baseline demo styles (Unsplash stock, flat ¥28), bumping them above the real work in the updated-at sort.

What changed:
- **DB hygiene (no code)** — archived the 3 stock demo styles; resynced all 38 published styles'
  `preview_price_cents`/`preview_duration_min` from their items via the app's own `buildQuote`
  (stored flat ¥88 placeholder → item-traced totals).
- **Customer feed scoping** — `PublishedStyleFeed` filters to `demoMerchantId`: the 72 seeded filler-
  merchant styles (4 reused Unsplash photos via `#hash`) no longer front the customer surface; they stay
  in the DB for the 选品/trend agent. Test updated to assert the scoping.
- **Breakdown quantity round-trip fix** — `seedStateFromBreakdown` kept quantities only for art/deco;
  colour/colour-effect selections rebuilt at qty 1, so 腮红甲 ×4 styles showed a different price on the
  feed card vs the detail (live: 8258/8280). Quantities now kept symmetrically; regression test added;
  all 38 card↔detail prices verified matching live.
- **AI provider routing** — Ark (cn-beijing) unreachable from the dev network killed every AI feature at
  the single choke point `postOpenRouterChat`. `VISION_MODEL_PROVIDER=gemini` now routes to Gemini's
  OpenAI-compatible endpoint (same message shape + response_format); default stays Ark.
- **甲型/甲长 facet backfill (data)** — the June bulk import left generic facets (`Melissa`/`Showcase`)
  + null recognition, so shape/length chips were empty everywhere. Ran gemini vision over all 38 photos,
  wrote `discovery_facets` only (items/prices untouched; service-module + billable labels filtered out).
  35/38 got a shape facet; chips verified lighting on both sides with totals unchanged.

## 2026-07-12 — Demo UIUX polish: business clock + agent-chain / insights / currency fixes

Branch `feat/demo-uiux-polish`. Merchant-side demo-readiness pass over the multi-agent surfaces.

What changed:
- **业务时钟 (P1)** — new `BusinessClock` on `/merchant/agents` (`src/domain/business-clock.ts` pure +
  `src/features/merchant/BusinessClock.tsx`). A stage-safe sprint clock: an always-clickable "推进" button
  steps a sim clock through a curated spine faithful to the real finals-a trace (决策 → 实测背离 72h →
  修订+记忆), then a deterministic procedural tail (seeded PRNG) so it never dead-ends. Procedural periods
  are tagged 模拟. Revealed count persisted in localStorage. Keeps live gemini rounds off the on-stage
  critical path (advance-clock stays a terminal-only operator control).
- **Thinking-chain sanitizer (P2b)** — `humanizeReasoning` in `agent-transcript.ts`: strong-tier reasoning
  leaked raw markdown (`###`/`**`/backticks) + internal action UUIDs into the merchant-facing chain. Now
  resolves style ids → names, drops UUIDs, strips markdown; clean prose passes through. Regression added.
- **Insights summary no longer hangs (P2c)** — the grounded card renders the deterministic fallback
  immediately (computed client-side from the loaded metrics via new client-safe `nail-ai/insights-fallback.ts`)
  and upgrades to the AI narration only if it returns. Previously gated on the AI action, which stalls (the
  OpenRouter→Ark wrapper is fed an OpenRouter model id Ark won't serve) → stuck on "AI 摘要生成中" forever.
  Badge reads 规则生成 until real OpenRouter narration is wired.
- **Currency conversion (P3)** — `formatCurrency` now CONVERTS SGD-base cents to the chosen display currency
  via a frozen `FX_FROM_SGD` table + `Intl.NumberFormat` (symbol + per-currency decimals; NBSP normalized to
  keep the old `SGD 12.34` form byte-stable). FRF dropped (retired 2002; Intl throws). Display-only; merchant
  edit inputs still author in the base currency.
- **Density + dev polish (P2a/P2d)** — `devIndicators:false` (the dev badge overlapped the 今日 tab, and live
  agent demos run in dev); `/merchant/agents` 团队记忆 capped to 4 with a toggle (page 7786px → 3442px).
- **Judge-first multi-agent framing** — `/merchant/agents` now opens with a compact closed-loop proof strip
  (configured agents, auditable runs, cross-round memories, and the 主控→数分/选品→决策→风控→执行→监测 chain),
  then the team lane map, then the business clock. This keeps the architecture visible before the timeline
  proof and avoids a first-screen "timeline only" read.
- **Friendly nail names** — known Melissa demo anchors now render as nail names in 今日 action cards,
  agent transcripts, and the business clock (`薄荷青法式`, `碎冰玫瑰猫眼`, `鎏金奢华`, etc.) instead of
  bare numbers or generic "Melissa Design ####" titles. Unknown/deleted styles still fall back to the id
  so the UI remains honest.

Aligned assumptions:
- Logo left untouched (owner decision).
- Demo-data hygiene (≈205 accumulated runs / 36 pending from eval test rounds) is a reseed step owned by the
  eval workstream — run `seed:agents` + `seed:agent-history` right before the demo; not done here to avoid
  disrupting in-flight eval data.

Verification:
- tsc clean. New tests: `business-clock.test.ts` (5), `agent-transcript` sanitizer regression, `format`
  currency-conversion cases. Pre-existing failures in `style/[id]` + `booking/confirm` page tests are
  unrelated (stale description/heading assertions; `SGD 28.00` itself renders) — confirmed via stash-run.
- Visual (Playwright, localhost, 430px): clock steps Day 0→3→7 then 模拟 tail; dev indicator gone; insights
  card settles with grounded numbers; agents page height halved.

## 2026-07-02 — Demo analytics reset + 暗黑 gap wording

What changed:
- `npm run seed:intelligence` now resets all `analytics_events` for the demo merchant before inserting
  fresh backdated seed history. This is deliberate for the final demo: old rehearsal clicks/searches can
  otherwise make the rolling "this week vs previous week" trend stale. Use `-- --preserve-live-events`
  only when intentionally keeping non-seed captured events.
- The `暗黑` gap story is normalized to the actual business rule: high demand + **≤1 active matching
  style**. Live Supabase currently has `style-melissa-img-8281` archived, so the gap can honestly be
  supply `0`. The seed fixture no longer treats 8281 as a published style, and the regression asserts
  `matchingActiveStyles <= 1`.

Aligned assumptions:
- Pre-demo runbook should be: `npm run seed:intelligence`, `npm run seed:agents`, then `npm run preflight`.
- The older synthetic plan doc may still contain historical wording; `current-state.md` is the source of
  truth for current behavior.

Verification:
- `npm run test -- src/mock/intelligence-seed.test.ts src/domain/intelligence/insights.test.ts`

## 2026-06-27 — Demo-safe: Supabase filler backfill + 1000-row read cap fix

Made the deployed (Supabase) demo actually match the design, and fixed a silent undercount the
preflight surfaced.

- **Filler backfill (#2):** `scripts/backfill-filler-merchants.ts` (`npm run backfill:fillers`) upserts
  ONLY the 4 filler merchants + media + published styles (narrow, idempotent — not the broad
  `seed:supabase`). Filler image paths get a `#<id>` fragment so each is unique (media_asset has a
  unique (bucket, path) constraint; placeholder reuse would collide) while the same image renders.
  Live now: 5 merchants, multi-merchant feed + cross-merchant platform-hot (韩系 across 3 shops).
- **CRITICAL read-cap fix:** `supabase/analytics-repository.ts` `listByMerchant`/`listByCustomer` did a
  single `.select('*')` → capped at PostgREST's ~1000 rows. With 1485 seeded events the read model was
  **truncated**, undercounting every metric (金属感 read as *down* 11-vs-16; 8284 as 6 try-ons). Now
  paginates with `.range()` past the cap. After the fix: 金属感 up 463-vs-198, 8284 try 10 (flagged),
  preflight all-green.

Preflight (`npm run preflight`) now PASSES on live Supabase. Note: 暗黑 supply is 0 (8281 unpublished) —
the gap holds (arguably cleaner); the "1款在售" wording in the agent seed/docs is the last stale bit.

## 2026-06-27 — Audit fixes: merchant-scoped insights/matching + demo preflight

Addressed the validate-audit High finding that multi-merchant fillers would corrupt single-merchant
intelligence:

- **Merchant-scoped supply (#3):** `getMerchantInsightsAction` now reads the merchant's OWN published
  styles (`merchantStyles.listByMerchant` + `status==='published'`), not all-merchant `listPublished`
  — so a filler shop's 暗黑 supply can no longer hide the hero's catalog gap. The 选品 tool likewise
  matches opportunities against **hero-only** styles (`get_trend_opportunities` filters by
  `MERCHANT_ID`); `get_platform_hot` stays cross-merchant by design.
- **Preflight (#5):** `scripts/preflight-demo.ts` (`npm run preflight`) hits the running app's agent
  endpoints and prints PASS/FAIL on the demo-critical bands (merchant/style counts, 暗黑 gap, 金属感
  rising, 8284 low-conv, 8265 top, platform-hot). First run confirmed the audit live: Supabase has no
  fillers, 金属感 reads down (stale wall-clock window), 暗黑 supply 0.

Still open (operational): re-run `seed:intelligence` before demo (#1); seed fillers to Supabase for
multi-merchant/platform-hot (#2); decide 暗黑 (republish 8281 vs document supply 0) (#5); refresh
`current-state.md` persona count (#6).

## 2026-06-27 — 选品 (trend) agent end-to-end + Pinterest source (ADR-0007)

Confirmed the 数分/选品 split and built 选品 as a real agent — **tools defined in Python** (the agent is
the only consumer; only internal grounded metrics still come from the TS read model, ADR-0006).

- **Pinterest research** (live): Trends API `GET /trends/keywords/{region}/top/{trend_type}` with
  WoW/MoM/YoY growth; **app-only `client_credentials` token** (no user redirect) from app_id+secret;
  but **no China region** (US/UK/CA + ~30) → Western keywords, likely `ads:read`. So Pinterest = live
  capability; the CN fixture = matching tone.
- **`trends_source.py`** — `TREND_SOURCE` seam: `fixture` (CN-flavored, default) | `pinterest` (live,
  degrades to fixture on error). Config adds `PINTEREST_APP_ID/SECRET/REGION`, `TREND_SOURCE`.
- **`trend_logic.py`** — Python port of the tested TS reference (`platform_hot`, `trend_opportunities`:
  collect→dedup→match tag-overlap→classify amplify/price_test/gap/prune→rank).
- **Tools (Python):** `get_external_trends`, `get_platform_hot`, `get_trend_opportunities` (read-only).
  TS adds `/api/agent/styles` (published styles cross-merchant) → `bus.fetch_styles` for matching.
- **Agent wiring:** `agentSlugs += 'trend'`; `AGENT_DEFINITIONS` 选品 row; `skills/trend.md`; orchestrator
  step **数分 → 选品 → 决策** (决策 now consumes briefing + the ranked opportunities). Re-seeded → 9 agents.

Decisions stay live in the agent runtime — 选品 produces a ranked menu; 决策 chooses. Verification:
py_compile + import/logic smoke; tsc clean; 32 intelligence/agent tests pass. Pinterest live token
untested until the key is placed in `.env.local`.

## 2026-06-27 — Synthetic demo data: distributional generator + multi-merchant (design spec)

Rebuilt the demo dataset so the data is **reproducible yet organic** (sampled, not hand-set) and
**multi-merchant**, per `docs/plans/2026-06-27-synthetic-demo-data.md`. Decision-making stays **live in
the agent runtime** — we engineer *situations*, not verdicts.

- **`src/mock/prng.ts`** — seeded PRNG (`mulberry32`) + samplers (beta/poisson/binomial/weighted). No
  deps; `Math.random` intentionally avoided. 6 tests.
- **`src/mock/style-latents.ts`** — per-style latent funnel params (Beta rates, Poisson exposure)
  encoding the §3 scenarios (winner / low-conv / under-exposed gem / declining star / vanity trap /
  dead). Scenarios override; the rest use a realistic prior.
- **`src/mock/intelligence-seed.ts`** — per-style funnel now **sampled** from latents via the PRNG
  (impressions ~ Poisson → Bernoulli chain → click/detail/try/book/save) instead of fixed counts; 40
  volume personas. Searches + named journeys kept. The locked narrative now holds as **bands** (all 9
  `intelligence-seed.test.ts` assertions pass on sampled data); tuned 2 latents in the band-loop.
- **Multi-merchant:** `merchants.ts` → 5 shops; `filler-merchant-styles.ts` → 72 published filler
  styles (placeholder images = hero pics, swap when real pics land; authored tags). `listPublished()`
  surfaces them → the customer feed is multi-merchant (enables cross-merchant ads).
- **选品 inputs:** `src/domain/intelligence/trends.ts` `getTrendOpportunities` (collect → dedup → match
  tag-overlap → classify → rank) + `getPlatformHotTags` (real cross-merchant 平台热门, no mock);
  `src/mock/external-trends.ts` fixture (swap to live Pinterest later). Tests for both.

Verification: tsc clean; 58 mock/intelligence tests pass.

## 2026-06-27 — Boss-message rendered in-thread + red build fix

- **Boss-message real:** the 用户运营 agent's `send_customer_message` now renders as a real `me` bubble
  in the merchant thread with an **🤖 AI 代发** marker (`ChatMessage.aiSent`), merged from the
  `agent_action` (source of truth); removed the redundant inline card on the thread.
- **Red build fix:** repaired a stale rename from the 2026-06-21 homepage commit that broke `tsc` on
  `StyleWaterfallGridClient` (`titleLocalized`→`title`), `TrendingStylesPanel` (`nameEn`→`name` +
  missing fields; obsolete fetch-test → static), and `try-on.test` (env arg position). Build green.

## 2026-06-27 — Agent audit follow-up: OpenRouter default, guarded actions (ADR-0007)

Post-audit correction to the Phase 3/3b agent work:
- Default agent provider is now `MODEL_PROVIDER=openrouter`; Anthropic SDK `tool_runner` is optional,
  not the default handoff path.
- Python tool bodies validate model-supplied action payloads before writing `agent_actions`.
- Agent action status updates are merchant-scoped and only allow legal transitions (`applied`
  reversible → `undone`, `proposed` draft upload → `approved`/`undone`).
- Runtime action-type filters are sanitized before querying in-context cards.

Verification: `pytest agent-service/tests -q` = 10 passed; `npm run test --
src/lib/repositories/memory/agent-repository.test.ts` = 9 passed. `npx tsc --noEmit` is still blocked
by unrelated existing customer/trending/try-on errors; no agent files were reported.

## 2026-06-27 — Agent service Phase 3b: in-context surfaces + panel Run button (ADR-0007)

The agent team's actions now show up on the **real merchant pages**, not just the dashboard.

- **Read layer:** `AgentRepository.listActions(merchantId, {types, statuses})` (memory + supabase) +
  `listAgentActionsAction(types)` (applied-only).
- **Shared surface:** `src/features/merchant/AgentActionInline.tsx` — one self-fetching, self-hiding,
  AI-attributed card with one-click undo, dropped on three surfaces: `place_ad` → style library
  (`/merchant/styles`), `set_group_buy_coupon` → price-config (`/merchant/manage`),
  `send_customer_message` → the 老板msg thread (filtered by `participantName`).
- **Gate completion:** approving a gated `draft_upload` shows a **去上架/Upload** link to the style
  library — the merchant supplies the image (auto-publish is impossible by design; that's why it's
  gated). New `getMerchantStylesPath()`.
- **Panel Run button:** `triggerAgentRoundAction()` spawns the Python service detached
  (`agent-service/.venv/bin/python -m nailed_agents`, localhost-demo, disabled in production); the
  panel polls `listAgentRunsAction` (~90s) so runs appear and flip running→completed live. Confirms
  before running (it calls the model / spends credits).
- Regression: `listActions` filter test (applied `place_ad` present; proposed `draft_upload` excluded).

Verification: `tsc` clean on all touched files; vitest agent-repository **8 passed**; pytest **10
passed** (unchanged — Python service untouched this step). The spawn trigger is localhost infra (not
unit-tested).

## 2026-06-27 — Agent provider direction clarified + tool payload validation (ADR-0007)

Aligned ADR-0007, the agent README, current-state docs, and `.env.example` with the current decision:
the repo-owned Python agent framework stays, **OpenRouter via the OpenAI-compatible SDK is the default
demo model path**, and Anthropic SDK `tool_runner` is an optional provider when explicitly selected.
OpenRouter does not literally run Anthropic's `tool_runner`; it runs the same plain Python tool bodies
through our OpenAI-format call→tool→call loop.

Also hardened the LLM trust boundary in `agent-service/nailed_agents/tools.py`: model-supplied action
arguments are now validated before any `agent_actions` payload is written (style id shape, ad slot,
positive/bounded money, trimmed/capped text). Added pytest coverage for invalid payloads.

Aligned assumptions:
- One tool source of truth remains the plain Python functions in `tools.py`.
- `MODEL_PROVIDER=openrouter` is the handoff/default path for the demo; `MODEL_PROVIDER=anthropic`
  requires separate verification if selected.
- Agent actions are still data-side records; in-context cards render them, but true ad/coupon/message
  entities and publish-on-approve remain pending.

## 2026-06-27 — Agent service: test coverage (Python + TS) (ADR-0007)

Closed the standing gap — the agent service had no automated tests (only `py_compile`/`tsc`). Added
network-free suites (bus I/O + the model client stubbed):

- **Python (pytest, 9 tests)** `agent-service/tests/`: OpenAI-schema derivation (types/required from
  signatures), registry integrity (IMPL/BETA/OPENAI cover the same 8 tools), tool side-effects +
  transcript steps, the **gated proposal** (`propose_listing` → `awaiting_approval` + proposed/
  irreversible action), and the **OpenRouter loop** (executes the real tool body, plain-text turn,
  feeds tool errors back instead of crashing). `pytest` added as a `[dev]` extra.
- **TS (vitest, +2 → 7 tests)**: the **approve-gate regression** (catalog run `awaiting_approval` →
  `draft_upload` proposed → `setActionStatus('approved')`) + customer-ops reversible boss-message.

All green: `pytest` 9 passed; vitest agent-repository 7 passed.

## 2026-06-27 — Agent service: dual model-provider seam (Claude prod / OpenRouter dev) (ADR-0007)

Added a one-flag provider seam so dev can run on cheap models (Gemini/GPT via OpenRouter, using keys we
already have) while prod stays on Claude — **without** adopting any new agent framework. Only the model
adapter forks; orchestrator, skills, tools, bus, and the panel are untouched/agnostic.

- `config.py`: `MODEL_PROVIDER` = `anthropic` (default) | `openrouter`; provider-aware `require_env`
  (checks the right key) + provider-specific cheap default model (`claude-haiku-4-5` /
  `google/gemini-2.0-flash-001`); `OPENROUTER_API_KEY` / `OPENROUTER_BASE_URL`.
- `tools.py`: refactored to **one plain-Python source of truth**. The same functions are surfaced as
  `BETA_TOOLS` (anthropic `beta_tool`) **and** `OPENAI_TOOLS` (function-schemas **auto-derived** from
  each signature+docstring via `inspect` — no per-backend schema duplication/drift). `IMPL` = the plain
  callables both loops execute.
- `runner.py`: `run_agent(*, system, tool_names, task, ctx)` → branches on `MODEL_PROVIDER`. Anthropic
  path = `tool_runner` (unchanged). OpenRouter path = a manual OpenAI-format call→tool→call loop
  (capped at 8 iters, tool errors fed back to the model). Both append reasoning to the same transcript.
- `orchestrator.py`: passes tool **names** (provider-agnostic) instead of fn objects.
- `pyproject.toml`: + `openai>=1.40` (lazy-imported; only used on the OpenRouter path).

**Verified LIVE** (OpenRouter → `google/gemini-2.5-flash`, full 8-run round): all tools fire
(`place_ad`/`set_group_buy_coupon`/`list`/`delist`/`get_*` applied), the **human gate fired**
(catalog → `draft_upload=proposed`, run `awaiting_approval`), tree parented, transcripts written.
Two dev-skew findings + fixes: (1) the `gemini-2.0-flash-001` default 404'd → default is now
`google/gemini-2.5-flash`; (2) Gemini drafted the boss-message in text without calling
`send_customer_message` → hardened the `customer_ops` task + skill to force the tool call (re-tested:
fires correctly). `beta_tool(fn)` confirmed valid as a functional call. **dev≠prod skew** stands —
test on Gemini, run a final Claude pass before the demo.

## 2026-06-27 — Agent service Phase 3: catalog + customer-ops + the one human gate (ADR-0007)

Extended the agent team to the **full loop** `数分 → 决策 → 投广 → 团购 → 运营(上下架) → 用户运营 → Monitor → 数分'`.

- **运营 (catalog)** agent (`skills/catalog.md`): `list_style` / `delist_style` (existing styles, auto +
  reversible) and the **gated `propose_listing`** — when a demand gap has no internal match the agent
  **cannot fabricate the design**, so it writes `agent_actions.status='proposed'` (risk irreversible)
  and its run finalizes as **`awaiting_approval`**. This is the **one human gate** (ADR-0007 §4).
- **用户运营 (customer_ops)** agent (`skills/customer_ops.md`): reads a new grounded **customer roster**
  (`GET /api/agent/customers`, booking history, most-lapsed first) via `get_customer_intelligence`, then
  `send_customer_message` (boss-message, auto + reversible).
- **Tools** (`tools.py`): added `get_customer_intelligence`, `list_style`, `delist_style`,
  `propose_listing`, `send_customer_message`; `RunContext.awaiting_approval` drives the gated finalize.
- **Approval write-path (TS, panel only):** `approveAgentActionAction` (proposed→approved) +
  `rejectAgentActionAction` (→undone) in `agent-actions.ts`; `AgentRunDetailClient` now renders
  **Approve/Reject** for `proposed` actions (+ a gate note) and an approved/rejected label.
- **Seed:** `agent-seed.ts` gains a catalog run (gated proposal, `awaiting_approval`) + a customer-ops
  run so `npm run seed:agents` shows the full loop **incl. the gate cold — no API key needed.**
- **Deferred to Phase 3b:** actual publish-on-approve into `merchant_style` + the in-context surfaces
  (投广/价格config/老板msg). Phase 3 actions stay panel-level `agent_actions` (same fidelity as Phase 1/2
  place_ad/coupon); rendering on real pages touches the concurrent style + messages WIP — separate pass.

Verification: `py_compile` of `nailed_agents/*.py` OK; 7 skill files present; `tsc --noEmit` clean on all
Phase 3 TS files. Live `tool_runner` run still pending an `ANTHROPIC_API_KEY`.

## 2026-06-27 — Agent service Phase 2: close the loop (团购 + Monitor) (ADR-0007)

Extended the Python agent service from the 3-agent chain to the **full closed loop**:
`数分 → 决策 → 投广 → 团购 → Monitor → 数分'` — all tool-call loops, additive (no substrate change).

- **决策** now emits **two** action intents (an 投广 `place_ad` + a 团购 `set_group_buy_coupon`); skill +
  orchestrator task updated. The two operators each pick up their own segment.
- **团购** agent wired (`skills/coupon.md` + orchestrator step) using the existing `set_group_buy_coupon`
  tool — undoable `agent_actions` row, surfaces on the price-config page.
- **Monitor** agent wired (`skills/monitor.md` + step, read-only `get_merchant_insights`). Hard guardrail
  in the skill: **never invents lift % — records baseline + observation window when no before/after exists.**
- **Loop closure:** Monitor re-dispatches a short `数分'` re-baseline run **parented to itself**
  (deterministic, not recursive); runs are parented end-to-end so the panel renders the loop as a tree.
- No new tools / migration / seed change. README + ADR-0007 §status/phasing updated.

Verification: `py_compile` of `nailed_agents/*.py` OK; all 5 skill files present. Live run still pending
(needs `ANTHROPIC_API_KEY` + `pip install -U -e .` + dev server) — verifying Phase 1+2 together.

## 2026-06-27 — Agent service → tool-call loops + skills (ADR-0007)

Refactored the Phase 1 Python service from a hardcoded JSON chain to **genuine Claude tool-call loops**
(the mentor's steer), without adopting the heavy Claude Agent SDK / Claude Code harness.

- Each agent now runs a loop via the Anthropic SDK's **`tool_runner` (beta)** + **`@beta_tool`** functions
  (`agent-service/nailed_agents/tools.py`: `get_merchant_insights`, `place_ad`, `set_group_buy_coupon`).
  Tools record their own transcript steps + write `agent_actions`; `runner.py` captures reasoning.
- Each agent's **process is a "skill" file we own** (`agent-service/skills/{insight,decision,ad}.md`,
  loaded as the system prompt) — **not** the `.claude/skills` feature (which is on the repo ban-list).
- The **outer** 数分→决策→投广 sequence stays deterministic Python; `bus.start_run`/`finish_run` bracket
  each run so the loop's tools write actions against a live run id.
- agent-seed `tools` allow-lists renamed to the new snake_case tool names (re-seed optional — cosmetic;
  the orchestrator passes tool fns directly).
- ADR-0007 §1 updated (tool-call loop via `tool_runner`; skills = our own files).

Verification: Python compiles (`py_compile`); TS (agent-seed) typecheck clean. Live run not executed
here (needs `ANTHROPIC_API_KEY` + `pip install -e .` + dev server) — see agent-service/README.

## 2026-06-27 — Agent team Phase 1: substrate + panel (ADR-0007)

The TS half of Phase 1 — the observability substrate the (next) Python agent service writes to and
the merchant panel reads from. No agent reasoning yet; that's the Python service (next step).

What changed:
- **Migration `0022_agent_orchestration.sql`** — `agents` (agents-as-data: slug/name/role/instructions/
  tools/version), `agent_runs` (targeted run + jsonb `transcript` thinking-chain + `parent_run_id`
  loop), `agent_actions` (type/risk/status/payload, the undo ramp). Server-only RLS. **Manual apply.**
- **Domain + seam:** `src/domain/agents.ts` (Agent, AgentRunView, AgentAction, TranscriptStep);
  `AgentRepository` (memory + supabase) wired into the bundle (ADR-0004) — read methods
  (`listAgents`/`listRuns`/`getRun`) + `setActionStatus` (one-click undo).
- **Server actions:** `src/lib/actions/agent-actions.ts` (`listAgentsAction`, `listAgentRunsAction`,
  `getAgentRunAction`, `undoAgentActionAction`).
- **Panel:** `/merchant/agents` (team cards + recent runs) + `/merchant/agents/runs/[id]` (thinking
  chain `reasoning ⇄ tool ⇄ action` + actions with undo). Path helpers `getMerchantAgentsPath` /
  `getMerchantAgentRunPath`. CSS added. (Nav entry-point deferred — reachable by URL for now.)
- **Seed:** `src/mock/agent-seed.ts` (8 agent definitions + a demo loop: 数分→决策→投广+团购→Monitor,
  tied to the intelligence-seed anchors 8265/8284/8281) used by the memory repo and by
  `scripts/seed-agents.ts` (`npm run seed:agents`, idempotent: upsert agents, replace `input.seed`
  runs).

- **Briefing endpoint** `GET /api/agent/briefing` — reuses `getMerchantInsightsAction` so the Python
  service reads grounded numbers (never re-derives metrics — ADR-0006 guardrail).
- **Python agent service** (`agent-service/`, full Python on the Anthropic Claude SDK): `config` (reuses
  repo-root `.env.local`, needs `ANTHROPIC_API_KEY`), `bus` (Supabase I/O + briefing fetch), `runner`
  (Claude call + JSON parse), `orchestrator` (the 数分→决策→投广 chain writing `agent_runs`/`agent_actions`,
  parented to close the loop). Run: `python -m nailed_agents`. Supabase is the only TS↔Python seam
  (plus the briefing read); `.venv`/`__pycache__` already gitignored.
- **Entry point:** an agent-team card on the merchant **Me** page, between 款式图册 and 美甲师状态
  (`getMerchantAgentsPath`).

Verification: agent repo test 5/5; profile page test 2/2; typecheck clean for all new files; Python
compiles (`py_compile`); bundle change safe (`memory-repositories.test` green). (Pre-existing suite
failures are the concurrent style/trending localization WIP — not this layer.)

Next (Phase 2): close the loop — Monitor (lift, re-dispatch 数分) + the 团购 chain + the in-context
surfaces (投广页面 below gallery / 价格config / 老板msg auto-send). See
`docs/plans/2026-06-27-merchant-agent-team.md`.

## 2026-06-08 — Fix editor preview drift (card $88 vs detail $93)

What changed:
- **`seedStateFromBreakdown`** no longer injects phantom `builder_gel` when re-opening a published style; structure chips come only from stored selections.
- **Art line quantities** (e.g. `hand_paint_simple` per-finger ×3) are preserved when seeding chip state and when rebuilding `catalogSelections`.
- **Art effect chips** show quantity controls like decorations.
- Regression test for 碎钻冰花法式 item mix (stored total **SGD 88** round-trips through chip state).
- **`scripts/audit-style-preview-drift.ts`** compares all **35** published styles: stored preview vs server re-quote vs client breakdown — **0 mismatches** in DB.

Root cause:
- Library card uses server snapshot (correct: hand paint ×3 fingers = SGD 15 inside SGD 88 total).
- Editor re-seed was adding **建构 +SGD 15** by default and collapsing hand paint **×3 → ×1 (−SGD 10)** → displayed **SGD 93**.

Aligned assumptions:
- Opening Edit must not mutate priced selections until the merchant changes chips.

## 2026-06-08 — Client breakdown injects base manicure (preview parity)

What changed:
- **`withBaseManicure()`** extracted to `src/domain/style-selections.ts` — shared by server publish, AI config, and client breakdown panel.
- **`ComponentBreakdownPanel`** rebuilds now prepend `basic_manicure_service` so 单价明细 + summary totals match `previewPriceCents` on the style library card.

Aligned assumptions:
- Every bookable style includes the base prep floor in both stored snapshots and live editor breakdowns.

## 2026-06-08 — Lock display currency to SGD (never translated)

What changed:
- **`formatCurrency()`** always renders `SGD 12.34` — removed locale-specific `¥` / `$` prefixes.
- **`currency-store`** fixed to `DISPLAY_CURRENCY = 'SGD'`; removed multi-currency selector from merchant manage page.
- **Booking / breakdown panels** route all price strings through `formatCurrency()` instead of hand-built `¥` / `$` strings.

Aligned assumptions:
- UI language switches copy and duration labels only; money is always Singapore dollars.

## 2026-06-08 — Wire client breakdown pricing to DB (merchant_pricing)

What changed:
- **`ComponentBreakdownPanel`** loads price/duration via `useMerchantPricingSettings()` (DB authoritative) instead of `localStorage` glossary settings; AI breakdown POST sends the same DB-backed settings.
- **`getDefaultSettings()`** now seeds catalog `defaultPriceCents` / `effectiveDurationMin` as offline fallbacks (was hardcoded `price: 0`).
- **Shared merge helper** `mergeMerchantPricingIntoDefaults()` — used by manage page and the hook.
- **`seed-supabase.ts`** upserts catalog-default rows into `merchant_pricing` for the demo merchant so defaults live in DB, not only in the resolver fallback.

Aligned assumptions:
- Manage page, server quotes, style library snapshots, and client breakdown/editor all read the same effective pricing chain: `merchant_pricing` → catalog defaults.
- `loadGlossarySettings()` / localStorage remain for legacy but are no longer used on pricing surfaces.

## 2026-06-08 — Customer chat reaches att3 parity (appointment card + staff)

What changed:
- **`ChatAppointment` is now presentation-ready** (`dateLabel`/`timeLabel`/`status`/optional
  `staffName`) and the header "View appointment" button + inline appointment card render for **both**
  roles (was merchant-only). The card link is role-aware: merchant → booking detail, customer →
  profile/booking history.
- **Customer thread fetches its booking** via `listCustomerBookingViewsAction` (matched by
  `conversationId`) to fill the att3 card — date · time · **Staff** (technician name + 美甲师/Beautician)
  · status badge. Merchant side keeps formatting `appointmentContext.startAt` → labels (no staff field
  there). Customer chat now matches att3 (header avatar/name/role, 今天 divider, ✓✓ receipts, pill
  composer, appointment card) instead of the bare legacy view.
- **Restored `export type MessageAuthorRole`** in `nail.ts` (a concurrent edit had dropped it, breaking
  the build).

Verification: typecheck clean; full suite green (370). Verified live on the customer thread
(`/customer/messages/conv-melissa`): appointment card with 员工 Mei Chen / 美甲师 + ✓✓ receipts.

## 2026-06-08 — Persist customer language on conversation threads

What changed:
- **`conversation_threads.customer_language`** — migration `0021_conversation_thread_customer_language.sql`; default `zh-CN` for existing rows; `create_booking_with_thread` RPC updated.
- **`BookingConversationThread.customerLanguage`** — domain type + memory/Supabase repos.
- **Booking create** — thread builders set `customerLanguage` from the customer's UI language at confirm time.
- **Completion thank-you** — reads `thread.customerLanguage` from the repo (removed in-memory `Map`).

Aligned assumptions:
- Seed threads carry explicit `customerLanguage` for demo consistency.
- Supabase deploys must apply migration `0021` before creates include the new column.

Verification: `booking-actions.test.ts` includes persisted-language regression.

## 2026-06-08 — Messages chat-pane polish + role-aware style-card link

What changed:
- **Role-aware style card.** The recommendation card in a thread now links by viewer: merchant →
  `/merchant/styles/${id}/review` (their own library view), customer → `/customer/style/${id}`. Was
  always linking to the customer page. Added `getMerchantStylePath` + a `viewerRole` prop on
  `ChatRoom`, passed `"merchant"`/`"customer"` from each thread client.
- **Chat-pane polish (phone, from the att3 mock):** header now has an avatar + name + role subtitle +
  a "View appointment" button; a "Today" day divider; ✓✓ read receipts on sent bubbles; a pill
  composer with a circular send button; and an inline appointment-details card (date · time · status
  badge + "View full appointment ›"). Header button + inline card are merchant-only (customers have
  no per-booking detail route) and omit staff (no staff field in the appointment data). The merchant
  thread client fetches the appointment via the same `getCustomerIntelligenceAction` read.
- **Localizer fix.** `formatStatusLabel` was missing `in_progress` (a valid `IntervalBooking` status)
  and had no fallback → it would crash the panel/cards on an in-progress booking. Added
  `in_progress`→进行中/In progress to `BookingStatusLabel` + the status map.

Verification: typecheck clean for all touched files; thread + message + i18n tests green (28/28).

## 2026-06-08 — Customer i18n pass: try-on, home feed, thread messages, insights language

What changed:
- **Try-on flow** — `try-on/page.tsx` + `TryOnPanel.tsx` wired to central `tryOn.*` UI keys; bilingual labels, errors, loading, CTAs, and back buttons.
- **Home feed** — `StyleWaterfallGridClient` tabs/empty states/filter clear aria; `style-facets.ts` section headers via `getFacetSections(language)`; `StyleCard` save/link aria + localized price.
- **Server thread messages** — `src/i18n/messages/server/booking-thread.ts` templates for pending-review system message and completion thank-you; `createBooking*` actions accept optional `language` (from confirm page). *(Completion language persistence added in the follow-up entry above.)*
- **Insights AI summary** — `summarizeInsights` / `summarizeInsightsAction` accept `language`; bilingual brief, fallback, and system prompts; insights page passes merchant UI language.

Aligned assumptions:
- Catalog tag labels (法式, 裸色, etc.) remain Chinese source data, not UI chrome.
- Landing page and `/dev` playground remain single-language by design.

Verification: `messages.test.ts`, `booking-thread.test.ts`, `insights-summary.test.ts`, `booking-actions.test.ts` green.

## 2026-06-08 — Messages: real recommend→thread send (rich style card) + clickable appointment

What changed:
- **`发送` on the customer-intel panel now posts a real message** into the thread (was log-only).
  `sendMerchantStyleRecommendationAction(conversationId, …)` appends a merchant message carrying a
  structured `attachment` (style card: id/title/image/reason) **and** logs `recommended_style_sent`.
  State is lifted into `conversation-client` (`onRecommendSent={setConversation}`) so the `ChatRoom`
  re-renders with the card immediately; the customer sees it in their thread too.
- **Chat messages can carry a style card.** Added `MessageAttachment` (`type:'style'`) to
  `BookingMessage`/`ChatMessage`; `toConversationForRole` passes it through; `ChatRoom` renders a
  thumbnail + title + 匹配 reason + 查看款式 link (→ `getCustomerStylePath`) when present, else plain text.
- **Appointment card in the intel panel is now a link** → `/merchant/booking/${bookingId}` (data was
  already in the payload; it was a static `<div>`).
- **Chat thread spacing** + style-card CSS; removed the now-orphaned `recordRecommendedStyleAction`
  (the real send supersedes it and logs the same event).
- **Migration `0019_message_style_attachment.sql`** adds nullable `messages.attachment jsonb`
  (**manual Supabase apply**, no CLI). `messageToRow` only writes the column when an attachment is
  present, so plain-text sends keep working pre-migration; only the card send needs `0019`.

Verification: typecheck clean; full suite green (355 tests). New regression in `messaging.test.ts`
(attachment passthrough). Recommendations are **profile-based** (the customer's behavioural taste
tags via `rankStyles`), not derived from their booked design.

## 2026-06-08 — Booking completion photo → style library + container item cleanup

What changed:
- **Mark completed → camera → AI breakdown.** On a confirmed booking, "Mark completed" now opens the device camera/file picker (`capture="environment"`), uploads the photo as a `completed_booking` style, marks the booking completed, and routes to `/merchant/styles/[id]/review` for the same client-side AI breakdown + merchant Save/Publish flow used by library uploads. Pre-fills the design title from the booked style when available.
- **`uploadMerchantStyleAction`** accepts optional `title` and `source` form fields; service upload honors `MediaAssetSource`.
- **Migration 0020** deletes non-quoteable service-module container rows from `merchant_style_item` (does not delete styles or media).

Why:
- Completing an appointment should capture the finished nail art into the merchant library in one motion, not as a separate manual upload.
- Old persisted container parent ids blocked publish; strip them in place rather than deleting whole style rows.

Aligned assumptions:
- Publish still requires merchant review/approval in the editor — completion does not auto-publish.
- Cancelling the camera picker leaves the booking confirmed.
- Marking a booking completed appends a merchant thank-you message to the linked conversation thread (if one exists).

Verified:
- `npm test -- src/lib/services/merchant-style-service.test.ts src/lib/actions/merchant-style-actions.test.ts src/lib/actions/booking-actions.test.ts`


What changed:
- Fresh merchant uploads now receive an optional `suggestedStyleName` from the client-side AI breakdown route. The editor fills the blank design-name field from that suggestion only if the merchant has not typed a title, and keeps the suggested description internally for save/publish.
- Merchant style configuration now filters service-module container ids (`color_effect_service`, `art_service`, `decoration_service`, etc.) out before quote/persist on AI-complete, Save, Publish, and Republish. Those ids can still appear as UI grouping/facet context, but only real quote rows (plus `basic_manicure_service`) enter deterministic pricing.
- Synced the downloaded `Dictionary - Sheet1 (1).csv` delta that exists in the file: `basic_manicure_service.default_duration_min` is now 50 in the generated catalog overlay. The CSV still leaves `color_effect_service`, `art_service`, and `decoration_service` default prices blank, so no invented defaults were added.

Why:
- The screenshot failure was not a missing price for a leaf service; stale container parent ids were leaking into the saved selections and `quoteService` correctly failed closed with `unresolved_pricing`.

Verified:
- `npm test -- src/lib/services/merchant-style-service.test.ts src/lib/actions/merchant-style-actions.test.ts src/app/merchant/styles/[id]/review/page.test.tsx`

## 2026-06-07 — Merchant upload fix + cloned style-result editor (instant draft, no processing detour)

What changed:
- **Upload bug fixed.** `uploadMerchantStyleAction` used `image instanceof File`, but this runtime is Node 18 where `File` is not a global → every upload threw "File is not defined". Now guards by excluding the string case. (Only one site; customer recognition uses base64 API routes.)
- **Merchant editor = the customer style-result panel.** `ComponentBreakdownPanel` gained `showRemoval` (default true) + a `footer` slot; a shared `buildBreakdownFromSelections` seeds it from stored selections. New `MerchantStyleEditor` renders the panel with `showRemoval={false}` (卸甲 hidden) + a title field + Save/Publish wired to the existing `saveMerchantStyleDraftAction` / `publishMerchantStyleAction`. New `getMerchantStyleImageAction` returns the draft image base64 so the panel runs the breakdown client-side.
- **Instant-draft flow.** Opening the editor flips a fresh `processing` upload to an editable draft (`needs_review`) via `configureMerchantStyleManuallyAction`; the panel auto-analyzes (fresh) or seeds from stored selections (re-edit). Library "Processing" tab → "Drafts"; card action → "Edit". The old `MerchantStyleReviewWorkspace` is retired (deleted).

Why:
- Merchants couldn't upload at all (Node-18 `File` crash). The review/publish flow also wanted to match the customer book-flow style-result UI and drop the separate processing/review detour ("商家拍照上传 → AI breakdown → 直接入库 → 直接修改"). Reusing the customer panel gives one consistent editor + the "breakdown fills in" behavior for free.

Tests: 281/281. Plan: docs/plans/2026-06-07-merchant-upload-instant-draft-and-cloned-editor.md.

## 2026-06-07 — Discovery facets re-bucketed by catalog category (grouped filter + multi-tag cards)

What changed:
- The AI stores discovery facets with an unreliable `kind` (almost everything lands in `style`, including colors, lengths, and even the container service-module names). New `src/features/customer/style-facets.ts` re-buckets each facet **by its catalog category** (the labels are catalog item names): service modules (颜色与效果服务 / 美术设计服务 …) and uncategorizable labels are dropped; the rest map to filter sections 甲形 / 颜色 / 效果 / 美术 / 装饰 / 建构 / 风格.
- Home feed filter is now **grouped by section** (one labelled, horizontally-scrollable row per category) instead of a single mixed row, and no longer offers service-module containers as filters.
- Feed cards show **several category tags** (shape + color + effect …, up to 3) as pills instead of just the shape; each still toggles the matching filter.

Why:
- The filter was surfacing 颜色与效果服务 / 美术设计服务 (containers) and mixing all tags into one row; the card only showed the shape. Re-bucketing by catalog category gives a clean, sorted filter and informative cards without trusting the AI's `kind`.

## 2026-06-07 — Customer quote $0 fix, container modules hidden, step-2 stream, status lifecycle

What changed:
- **$0 quote bug fixed.** The base manicure is `ai_detectable='no'`, so the breakdown model never returns it — the customer own-photo quote was missing the $28/51-min floor and read $0 (e.g. a single included color). `parseBreakdownModelOutput` now injects the base manicure (from merchant settings, prep-duration summed from glossary children) into both `items` and `catalogSelections`, mirroring the merchant-side `withBaseManicure`. Regression test added.
- Container service modules (颜色与效果服务 / 美术设计服务 / 卸甲服务 …) are hidden everywhere they were leaking as line items: customer `StyleDetailPanel` + `ComponentBreakdownPanel` now drop `service_module` rows except the base manicure (type-based, not the old 0/0 heuristic, since some containers carry a duration), and `listConfigurableCatalogAction` drops them from the merchant "Add services" list (base kept so the selected list can render it).
- Booking step 2 now opens immediately on "Analyze my photo": the photo shows at once and the description + breakdown stream in there (`LoadingState` for the description while recognition runs), instead of holding the user on step 1 behind a spinner.
- Feed cards show the nail **shape** as a single pill (杏仁形 …) instead of multiple hashtags; the pill still toggles the facet filter.
- Merchant booking status is now a **lifecycle**, not arbitrary: pending_review → Confirm / Cancel; confirmed → Mark completed / Cancel; completed & cancelled are terminal (no jumping straight to completed or back to pending).
- Merchant "Manage collection" pill made smaller; library main action (Review/View/Edit) unified to the secondary style so Processing matches Archived.

## 2026-06-07 — Feed hashtags + facet filter (discovery)

What changed:
- Customer feed cards drop the description line and instead show up to 3 hashtags built from the style's `discoveryFacets`, prioritized style → addon → shape → mood → lifestyle (`styleHashtags` in `StyleCard`). Same vocabulary as the detail page's 风格标签.
- Home feed gained a facet filter bar (`StyleWaterfallGridClient`): a horizontal chip row of the distinct facet labels present in the loaded styles, OR-matched (a style stays if it carries any selected tag), client-side only — no backend change. Tapping a card hashtag toggles the same filter, so the hashtags and the filter share one vocabulary. Empty-result and clear states included.
- `HASHTAG_KIND_ORDER` exported from `StyleCard` so the filter bar orders chips the same way the card hashtags do; `NailStyleCard.description` (added earlier for the card blurb) removed as now unused.

Note: the customer style detail route only compiles on first navigation in dev; on WSL2/Node18 a concurrent-compile choke could leave it spinning ("can't click into the picture"). A clean `.next` restart resolves it — not a code issue (route returns 200 once compiled, and prod is prebuilt).

## 2026-06-07 — Upload/try-on flow, trending cache, workload grouping, library + review polish

What changed:
- Customer upload step: no-image state shows [Upload or take photo] + [Try with example]; once an image exists it shows [Change photo] + [Try on this look] with a full-width [Analyze my photo] below. "Change photo" now resets to a clean upload state instead of opening the picker in place. The ＋ drop-zone is only a picker while empty (a static preview afterward). Page-heading spacing tightened (eyebrow→title→content).
- "Try on this look" is the standalone entry into `/customer/try-on`; the try-on panel gained a top "← Back" (router.back) so there is a way out.
- Trending (热门款式) is a live web search and now caches at module level: it runs once per session and reuses the result when the customer returns to home; Refresh still forces a new fetch (`resetTrendingCacheForTests` clears it in tests).
- Technician workload (`TechnicianRosterCard`) regrouped: each technician's active bookings collapse by day (native `<details>`, soonest day open), and each booking expands to status + customer + quote + a link to the full booking — mirrors the customer Me-tab pattern and stays readable across a long horizon.
- Merchant profile "Manage collection" is now a pink pill with an arrow on the Showcase line (was an unstyled link that wrapped under the title).
- Merchant review (published edit): "Save changes" is disabled until something actually changes (title/description/selection baseline diff), with a "← Back" beside it. Per-set items (incl. the base manicure) keep their quantity locked by design.
- Style library: back affordance restyled into a pill (no raw "←" glyph), upload tile enlarged, Delete added to the Archived tab (hard-delete any non-published style), subtitle now says designs are published "for customers to discover".

## 2026-06-07 — Customer upload UX + merchant catalog grouping + breakdown noise cleanup

What changed:
- Merchant review "Add services" list is now grouped by catalog category (基础护理 / 建构延长 / 颜色与效果 / 美术设计 / 装饰 / 卸甲 / 其他) instead of one flat list. `ConfigurableCatalogItem` carries `category`; the workspace renders non-empty sections with a small heading. Search still filters before grouping.
- Customer breakdown panels (`StyleDetailPanel` 款式构成, `ComponentBreakdownPanel`) now hide container service-module rows that carry neither price nor time (e.g. 颜色与效果服务 / 建构服务) so they stop showing "— —" noise. The priced base manicure and zero-price billable colors stay.
- Feed cards (`StyleCard`) show a 2-line merchant description under the title (`NailStyleCard.description` optional; published styles already carry it).
- Customer own-photo upload (`ImageUploader` + booking step 1) reworked: the drop-zone/＋ is itself a file picker; CTAs sit on one row; "Analyze my photo" only appears once a reference exists (paired on one row with "Change photo"); page title pinned to the design-system page-title scale (was UA 2em, oversized/wrapping).
- "Try with example" replaced by "Try on this look", which is the standalone entry into the existing `/customer/try-on` flow (your own photo is just as valid a look to preview). The now-unreachable sample-recognition path (`getSampleRecognition`) was removed; the upload step always uses the live recognizer.
- Booking step 3 (quote) now puts "← Back" and "Next: choose time" on one row (`.booking-step-actions` is a 2-col grid); previously the back action sat on its own row above and prefill had no back at all (prefill back now returns to the style detail).

Why:
- The flat catalog and the always-present disabled "Analyze" button were the two biggest mobile-fit/scannability complaints; grouping borrows the Manage tab's structure without porting the glossary chip UI (keeps the correct server-derived pricing untouched).
- The "— —" parent rows were grouping containers leaking into a customer-facing table.

Tradeoff:
- Category→section mapping is a curated allowlist in the workspace (unknown categories fall to 其他), mirroring the existing `durationAggregatingPackageIds` allowlist pattern until the Dictionary carries a section column.



What changed:
- `/merchant/styles` no longer asks for a title or embeds the full catalog editor inside collection
  cards. It exposes one image upload tile and routes to `/merchant/styles/[id]/review` immediately
  after the private original and `processing` row are stored.
- The dedicated phone-sized review workspace shows the stored image and exposes an explicit
  **AI breakdown** action. That action runs strict stored-image AI analysis to suggest the
  title/description and every billable price/time catalog selection, then the merchant edits and
  approves before publication. Quote preview, Save Draft, and Publish all use deterministic server
  actions.
- The storage seam can download private originals. Migration `0016` adds an atomic, stale-recoverable
  analysis claim so concurrent page loads do not spend duplicate model calls, plus server-only RPCs
  that atomically commit the normalized AI suggestion and `processing` → `needs_review` transition,
  or move a failed analysis into editable manual review.

Why:
- Inline AI made upload navigation slow, while the card-embedded editor cramped a large approval
  task into the collection page. Separating upload from review gives immediate feedback, and making
  AI an explicit button keeps the merchant in control before suggestions alter the draft.

Tradeoff and deployment:
- Apply `supabase/migrations/0016_merchant_style_analysis_workflow.sql` before using this workflow
  against live Supabase. There is still intentionally no batch-upload/review UI.

Aligned assumptions:
- Stored private media is the analysis input; browser-provided recognition, price, duration, and
  status are never authoritative.
- The relational `merchant_style_item` set and derived preview remain one atomic configuration.

## 2026-06-06 — Manual merchant review of the 35 backfilled styles (data correction)

The 35 demo styles were AI-configured before the per_set / JSON enforcement landed and there is no
merchant to approve them, so I acted as the reviewer: viewed every image against its breakdown and
corrected the data (no code change; rewrote rows via `set_merchant_style_config`, preserving each
style's AI title / description / discovery_facets).

Errors found and fixed (28 of 35 styles; 7 were already correct):
- **per_set qty > 1 (14 styles):** french_tip / glitter / cat_eye / chrome_powder / aurora_powder
  carried qty up to 10. Forced to 1. This also un-inflated price: the old `deriveSnapshot`
  multiplied price by qty for ALL units, so e.g. 8256 was `$178` (base + french×10) and is now `$43`,
  8259 `$508 -> $118`.
- **per_finger counted as pieces:** `rhinestone_small` is priced per finger but the model emitted
  raw stone counts (×22, ×30). Capped to the visible finger count (e.g. 8276 ×22 -> ×2, 8259 ×30 -> ×8).
  This was the main driver of the 6–8 hour durations.
- **absurd per_piece:** 8274 `metal_charm ×21 -> ×5`.
- **missing base manicure:** 8286 had no `basic_manicure_service` (the JSON-parse straggler);
  injected it (`$20/15min -> $48/66min`). Every set now has the manicure floor.
- **false positives dropped / under-config fixed:** removed elements absent from the photo
  (e.g. metal_charm on a flat-painted nail), and enriched two base-only-but-decorated styles
  (8257 bejeweled, 8278 cloud + stars).

Verified: 0 per_set>1, 0 missing base, 0 per_finger>10, 0 piece>15 across all 35.

Note: a few elaborate styles still derive long durations (8280 259min, 8279 196min). Those are the
catalog's per-finger paint times (hand_paint 30min, pattern_art 45min per finger), not quantity
errors — the counts are now image-accurate. Tightening the per-finger duration model is a separate
catalog-level decision.

Root-cause analysis + improvement plan: [style-config-recognition-error-analysis.md](style-config-recognition-error-analysis.md).

## 2026-06-06 — Customer style detail reads the published merchant config

What changed:
- `StyleDetailPanel` now renders the published merchant config instead of the legacy
  `recognition` shape (which is null for AI-configured styles, so the detail box showed nothing
  useful). It wires three things from `PublishedMerchantStyle`: the AI `description` as the style
  brief, `catalogBreakdown` as a 款式构成 layer list (catalog name + type badge + quantity, no
  price), and `discoveryFacets` as grouped 风格标签 tags.
- The "Your quote" pricing section is intentionally left untouched (owned by the in-flight quote
  UI work). The breakdown here is composition-only; price/duration stay in the quote section.
- Brief falls back `description -> recognition.otherNotes -> placeholder`, so the seeded mock
  fixtures (empty description) still render.

Why: the merchant upload pipeline already produces a relational catalog breakdown + AI name +
description, but the customer detail page ignored all of it. This makes the configured content
visible when a customer opens a merchant picture.

Tests: `src/app/customer/style/[id]/page.test.tsx` gains a case asserting 款式构成 + the base
layer + 风格标签 + facet tags render. Full suite 256 green, tsc clean.

## 2026-06-06 — Strict merchant-style AI config + per-set quantity enforcement

What changed:
- Single-upload breakdown and style-name calls now request strict OpenRouter JSON Schema output and
  validate the parsed result again at runtime. Missing sections, wrong section ids, malformed item
  fields, duplicate ids, and extra naming fields fail and retry instead of silently becoming an
  empty or partial configuration.
- Added one shared `per_set` quantity rule. AI parsing, `quoteService`, merchant-style snapshot
  persistence, the review UI, and migration `0015` now agree that a per-set line has quantity one.
- The merchant review editor now lists every billable price/time review item, including
  merchant-priced/no-default items. It displays effective price, duration, and unit; unavailable
  items remain visible but disabled. Single uploads still require explicit merchant publication.

Why:
- AI JSON is untrusted even when it parses syntactically. Wrong-shaped output must never enter
  deterministic pricing, and a per-set model quantity must not multiply a whole-set service.

Tradeoff:
- Applying `0015` stops future invalid relational writes but does not rewrite historical rows.
  Existing invalid per-set style items and their derived previews require a separate deterministic
  reconciliation so items and snapshots change together.
- Batch configuration stays an admin script; no batch-upload/review UI was added.

Aligned assumptions:
- AI proposes catalog ids; the merchant approves the single-upload draft; server services derive
  price/duration and persist the normalized selections.
- Runtime validation remains authoritative even when the provider claims schema compliance.

## 2026-06-06 — Live catalog-id recognizer (reuse the breakdown) + glossary unification

The merchant style "brain": instead of a parallel recognizer, the existing customer breakdown is
reused — it already turns an image into catalog selections.
- **Glossary unified onto the catalog.** `src/data/glossary.ts` no longer hand-lists entries; it
  derives them from `src/mock/catalog.ts` (109 ids). The breakdown prompt can now only ever name valid
  catalog ids — the 114-vs-109 drift (7 dead ids the model could emit, e.g. `extension_short`; 4
  missing new ids) is structurally gone. Only `breakdown.ts` consumes the glossary; behaviour
  unchanged, ids corrected.
- **`recognizeStyleConfig` (`src/nail-ai/style-config-recognition.ts`).** image → `runGlossaryBreakdown`
  (catalog-id detection) → `buildStyleConfig` (validated split: priced→selections, descriptive→facets)
  + one naming call → `{ catalogSelections, discoveryFacets, name, description }`. Same vision pipeline
  as the customer side; no second recognizer.
- **`npm run configure:styles --ai`.** Backfills the 35 live styles from their Storage images: real
  per-image breakdown, AI name, AI description, derived price. Validated live on one row →
  `奶油香槟金箔钻`, `gradient×5 + rhinestone_large + foil_piece×2 + chain_charm`, $45 / 125 min (vs the
  $28 default). `--limit=N` caps the run; without `--ai` it falls back to the curatable default.
- **AI-suggest is the default on merchant upload.** `uploadMerchantStyleAction` runs `recognizeStyleConfig`
  after the upload and applies it (best-effort: a missing key / model error / no priceable items leaves
  the draft in `needs_review` for manual config). The merchant review form already reads the style's
  `catalogBreakdown` / `description` / `title` into editable fields, so the merchant edits the AI
  suggestion before publishing. `set_merchant_style_config` now also sets the title (the AI name),
  added to migration `0014` (`p_title`, empty preserves the existing title); `service.applyConfig`
  derives the preview from the selections and persists items + facets + description + name.

Note: upload AI runs inline (two model calls, ~seconds) so the upload request blocks until config
returns; acceptable for the demo. Naming/description quality depends on the model run.

## 2026-06-06 — Merchant style integrity hardening (migration 0014, audit follow-up)

Pure-SQL follow-up to the second Phase 2 audit (0013 already applied, so fixes land in `0014`; RPC
signatures unchanged → no application code changes):
- `merchant_style_item` quantity gains an upper bound (`<= 100`) to match quoteService's accepted range.
- `set_merchant_style_config` now validates `p_items` / `p_discovery_facets` are JSONB arrays and refuses to edit an archived style (it previously checked only id + merchant). Items + derived preview are still written in one transaction so they can't diverge.
- `publish_merchant_style` now requires ≥ 1 relational item and **no longer writes the preview snapshot** — `set_merchant_style_config` is the sole atomic writer of items + preview, so a concurrent reconfigure can't leave items from B with a price from A (audit finding 3). Signature unchanged (preview params accepted but ignored); the publishable CHECK still guarantees a non-null preview at publish.
- Fixed `scripts/backfill-melissa-assets.ts`: stopped sending the dropped `catalog_breakdown` column (rerun would otherwise fail after uploading assets).
- ADR-0005 P6.5 row updated: migrations `0009`–`0014` are live; the relational breakdown is authoritative.

Apply: run `0014` in the Supabase SQL editor.

Still open from the audit (next): the live catalog-id recognizer (reuse `runGlossaryBreakdown`, which already emits `catalogSelections`) + glossary→catalog prompt unification (the breakdown prompt is built from `src/data/glossary.ts`, 114 ids vs the catalog's 109, so the model can name dead ids); auth (no authenticated identities; service-role bypasses RLS).

## 2026-06-06 — Phase 2.5 authoritative quote contract

What changed:
- Catalog selections now drive the entire configured booking path. Availability quotes each
  technician separately (including `staff_item_duration`), attaches that exact quote to the offered
  slot, and creation requotes the same selections + technician before the atomic write.
- Published styles open directly on their frozen merchant-reviewed quote and no longer rerun image
  recognition during booking.
- Custom-image breakdowns return catalog selections. The breakdown API loads effective merchant
  pricing server-side and requotes through `quoteService`; browser-supplied prices/durations were
  removed.
- Merchant Manage now reads/writes `merchant_pricing` through server actions and renders the
  generated catalog. The obsolete `glossary-settings-store.ts` localStorage path was deleted.
- `quoteService` rejects non-integer, non-finite, zero/negative, and excessive quantities.

Why:
- Displayed totals, offered duration, and persisted booking duration could previously come from
  three different contracts. This bridge makes one server-derived catalog quote authoritative
  before Phase 3 adds more AI/configuration behavior.

Tradeoff:
- The legacy flat snapshot action remains as a compatibility fallback for old or unconfigured
  drafts. It always enters `pending_review`.
- `src/data/glossary.ts` still duplicates prompt metadata from the generated catalog; it no longer
  controls pricing but should be unified during the remaining live recognizer work.

Aligned assumptions:
- Browser catalog ids/quantities are choices, not price/duration authority.
- Published styles use curated relational `merchant_style_item` selections and do not rerun AI.
- See `docs/plans/2026-06-06-phase-2-5-authoritative-quote-contract.md`.

Verification:
- `242` Vitest tests passed.
- `npx tsc --noEmit` passed.
- `npm run build` passed.

## 2026-06-06 — Style config pipeline, server-derived pricing, relational breakdown (Phase 2)

Resolves the second Phase 2 audit (server-derived publishing, config persistence, customer/booking
wiring, quantity-aware duration, relational breakdown). Earlier in the day this section overstated a
`description`-field-plus-orphaned-helper as "Phase 2"; the entry below is the real, wired state.

Pricing + duration are now DERIVED, never client-supplied:
- Duration-aggregation policy made explicit (`durationAggregatingPackageIds` allowlist in `catalog.ts`). The old "aggregate any parent with billable='no' children" heuristic silently changed `color_effect_service` (20→24) and `finish_service` (15→51); now only `basic_manicure_service` (30→51) aggregates. (Audit finding 2.)
- `quoteService` scales booking duration by quantity for `per_finger`/`per_piece` (5 painted nails = 5× one nail), counted once for `per_set`/`fixed`/`included`/`tag_only`. `QuoteLine.durationMin` is now the line total. (Finding 6.)
- Merchant `publish` no longer accepts price/duration. It takes catalog `selections`, runs them through `quoteService`, and persists the derived snapshots. The merchant form is now a catalog-item selection editor (price/time shown as auto-calculated). (Finding 1.)

Config pipeline + relational model:
- `buildStyleConfig(recognized: RecognizedCatalogItem[], catalog, confirmedUncertainIds?)` now flows through `bucketRecognition` + `toCatalogSelections` (validates ids, drops unknown/non-detectable, preserves quantity), then splits: priced billable → `catalogBreakdown`; descriptive/containers → `discoveryFacets`. (Finding 3.)
- New relational table `merchant_style_item` (FK → `catalog_item`, quantity) is the authoritative breakdown; `merchant_style.catalog_breakdown` jsonb is dropped. `recognition` stays jsonb. `MerchantStyle.catalogBreakdown` is now `CatalogSelection[]`, read by join. New `set_merchant_style_config` RPC writes items + facets + description + derived snapshots in place, preserving status/media (finding 7). (Migration `0013`.)
- `scripts/configure-merchant-styles.ts` (`npm run configure:styles`) backfills the 35 live styles in place: each gets a curatable breakdown (default `basic_manicure_service`; per-id `OVERRIDES`), derives price/duration, writes via the RPC. Replaces the fake flat $88/90 snapshot with a real derived $28/51. Idempotent.

Customer/booking consumption (finding 4):
- A published style booking now books its CURATED `catalogBreakdown` → `quoteService` → relational `booking_item` rows, via `createBookingWithThreadFromSelections` (booking-service) + `createBookingFromStyleAction`. The customer draft carries `styleId`; the confirm step branches to the style action (else the legacy recognition snapshot). Same server guards (forced `pending_review`, availability enforced for the derived duration).
- The booking quote + detail show the style's derived price + `description` for a prefilled style instead of the flat rule-based estimate.

Migrations to apply (manual SQL editor — no CLI/exec_sql here), in order:
- `0012_merchant_style_description.sql`: `merchant_style.description` + 9-param `publish_merchant_style`.
- `0013_merchant_style_item.sql`: `merchant_style_item` table, drop `catalog_breakdown`, `create_merchant_style` (now carries description, no breakdown), `set_merchant_style_config`.
Then `npm run configure:styles` to backfill the 35.

Known gaps: the live catalog-id vision recognizer is still not wired, so the 35 get a default breakdown pending per-image curation (`OVERRIDES` in the script). Auto-config on manual upload (recognizer → buildStyleConfig at upload) is deferred; merchants configure via the publish selection editor.

## 2026-06-06 — Catalog dictionary refresh + platform default price (Phase 1)

What changed:
- New generator `scripts/generate-catalog.mjs`: parses the Lark "Dictionary" CSV export → `src/mock/catalog.ts`, validating enums, parent refs, units, and `affects=yes`→duration. It refuses to emit data the integrity test / DB CHECKs would reject (caught real issues: `na` sentinels for non-timed tags, the dropped allowed-units column).
- Regenerated `catalog.ts`: 112 → 109 items (−7 `extension_*`/`magnetic_special_effect`/`removal_short_extension`/`texture_cat_eye_light`, +4 `removal_short_origin`/`dual_color`/`aurora_powder`/`pearl_powder`). The sheet dropped its allowed-units list, so `allowedPricingUnits` is now the single default unit.
- New `CatalogItem.defaultPriceCents` (null = no platform default). `pricing-resolver` precedence is now override → `defaultPriceCents` → (required ? unresolved : free). This closes the "$0 catalog quote" gap (`catalog_default` used to always return price 0).
- Migration `0011_catalog_default_price.sql`: adds `catalog_item.default_price_cents`, drops the 7 removed items (all leaves; no FK refs). `scripts/seed-supabase.ts` now writes `default_price_cents`; re-run it after applying `0011`.

Pricing/time model (confirmed with product):
- `basic_manicure_service` is the only priced *parent* (a $28/per_set package); its 5 children are `billable=no`, time-only. Other parents are unpriced containers; their priced leaf children are à la carte add-ons.
- Base-package booking time = **sum of its child steps**, not the parent's stored duration (decided 2026-06-06). The aggregation lives in the quote/breakdown layer (Phase 2); `catalog.ts` stays a faithful mirror.

Apply: run `0011` in Supabase, then `npx tsx scripts/seed-supabase.ts`.

Known follow-up: `src/data/glossary.ts` is a hand-maintained second copy of the dictionary (consumed only by the breakdown route, not yet wired into the config pipeline). It still lists the 7 removed ids and lacks the 4 new ones. Reconcile it in Phase 2 (ideally unify it with the generated catalog rather than maintain two copies).

## 2026-06-06 — Remove obsolete localStorage operations store

What changed:
- Deleted `src/mock/operations-store.ts` and its legacy localStorage behavior/tests.
- Moved the remaining demo customer identity into `src/mock/customers.ts`.
- Removed the obsolete operations-store reset from the confirm-page test.

Why:
- Booking, availability, conversation, and message runtime consumers are DB-backed. Keeping a
  second localStorage implementation suggested a valid fallback path and made the persistence
  architecture harder to understand.

Aligned assumptions:
- The booking draft remains intentionally browser-local in `sessionStorage`.
- Mock booking/conversation records remain as deterministic in-memory repository seeds for tests.

## 2026-06-06 — Melissa live style asset backfill

What changed:
- Added `scripts/backfill-melissa-assets.ts` and `npm run backfill:melissa-assets`.
- The script uploads `nail_assets/*.jpg` into `merchant-style-originals` and
  `merchant-style-published`, then upserts deterministic `media_asset` and published
  `merchant_style` rows for `merchant-nailed-it`.
- Live Supabase now has 35 Melissa media rows, 35 published style rows, 35 private originals,
  and 35 public published objects. The first public object returns HTTP 200.
- Fixed the merchant calendar's hardcoded May 2026 month. It now derives the displayed month from
  the selected/default booking date, so today's live cross-actor QA booking appears on the calendar.

Why:
- P6.5 had the database/storage/UI wiring, but the live project still had empty style buckets and
  empty `media_asset` / `merchant_style` tables. Customer discovery and Merchant Me need real
  merchant-owned resources, not only external mock URLs.

Tradeoff:
- The backfill uses reviewed collection-level preview values (`$88`, `90 min`) and leaves
  recognition/catalog JSON empty. This avoids fabricating AI/catalog review evidence before live
  P6 emits catalog ids.

Aligned assumptions:
- The script is idempotent for the Melissa set because ids and object paths are deterministic.
- Future merchant uploads still go through the server action review/publish lifecycle.

## 2026-06-06 — P4d: atomic booking + thread create (closes the deferred RPC gap)

What changed:
- New migration `0010_booking_thread_rpc.sql`: `create_booking_with_thread(p_booking, p_items, p_thread, p_messages)` calls `create_booking` (same transaction, reuses the GiST overlap handling) then inserts the conversation thread + its messages. Booking + items + thread + greeting now commit in **one transaction**. Server-only (revoked from public/anon/authenticated, granted service_role).
- `IntervalBookingRepository.createWithThread(booking, items, thread)` added. Supabase impl calls the RPC; the in-memory impl writes the booking then the thread (via an injected conversations repo) and rolls the booking back if the thread insert fails, so both sides honour the same atomic contract.
- `bookingService.createBookingWithThreadFromSnapshot(input, buildThread)` builds the snapshot booking + item (shared `buildSnapshot` helper) and does the single atomic write; `buildThread(booking)` lets the caller derive the thread from the server-generated booking id.
- `createBookingAction` now uses it and **deletes the two-step insert + compensating-cancel** block. No orphan booking and no empty thread are possible anymore.

Why:
- This was the last residual gap from the hardening audit (finding #5). The previous compensating cancel covered booking↔thread but not thread↔message (an empty thread could survive a message-insert failure). A single RPC removes the partial-state surface entirely instead of chaining more compensation.

Apply: run `0010` in Supabase (after `0009`).

## 2026-06-06 — P4d create-path hardening: untrusted recognition + availability at write time

What changed (`src/lib/actions/booking-actions.ts`):
- **Client recognition is untrusted, so the snapshot bridge never auto-confirms.** Status is no longer derived from the client-supplied confidence (`requiresMerchantReview` dropped from this path) — it is forced to `pending_review`. A booking only leaves review once the recognition/catalog selections are issued server-side (live P6). Price/duration are still recomputed server-side from the recognition.
- **Availability is enforced at write time, not just displayed.** Before the create, `createAvailabilityService(repos).findAvailable` re-derives the available technicians for the exact slot + server-recomputed duration; if the chosen technician is not among them the action throws `technician_unavailable`. The DB GiST exclusion constraint only blocks booking-vs-booking overlap — it does not stop bookings during breaks, blocked time, or outside working hours. This closes that gap.

Why:
- The two residual trust holes after the first hardening slice: (1) a tampered high-confidence recognition could auto-confirm, and (2) a hand-crafted request could book a technician during a break or off-hours (only the grid filtered those, and the grid is advisory).

Tests:
- The three seed tests (calendar / customer profile / merchant booking-detail) booked `tech-anna` at `10:00`, but Anna opens `11:00` — the old create path silently accepted it. Moved those seeds to `11:00` (valid). The confirm-page test now asserts a high-confidence booking still lands in `pending_review` (the regression guard for "do not trust client confidence"); the old low-confidence variant was removed because confidence no longer gates status.

Still deferred (unchanged): booking + thread + initial message is not one transaction. The booking↔thread orphan is handled by the compensating cancel; a single combined Postgres RPC remains the ideal final mechanism (needs a migration).

## 2026-06-06 — P6.5 merchant style library + media foundation

What changed:
- Added `media_asset` + `merchant_style` and private-original/public-published Supabase Storage
  buckets in migration `0009`. Transactional RPCs create the paired DB rows and publish the media
  path + style state.
- Added the merchant-style repository seam, in-memory/Supabase implementations, Storage adapter,
  upload/publish service, and scoped customer/merchant server actions.
- Customer home and style detail now read published merchant styles. Merchant Me shows the
  collection preview; `/merchant/styles` supports upload, reviewed price/duration, publish, and
  archive.

Why:
- Merchant-owned showcase images are a core customer acquisition surface and the foundation for
  P7 completed-work tracking. Image bytes belong in object storage; ownership, lifecycle, and
  reviewable metadata belong in Postgres.

Tradeoff:
- New uploads require the merchant to enter reviewed preview price/duration before publishing.
  Live recognition-to-catalog remains P6 work; P6.5 does not auto-publish or treat AI output as
  pricing authority.
- There is still no auth system. Actions are fixed to the demo merchant, and real tenant
  authorization must be added with authentication.

Aligned assumptions:
- Customer actions expose published styles and public image URLs only.
- Private originals and generated object paths never come from browser-controlled values.
- P7 completed-order photos create draft records through this same media/style foundation.

## 2026-06-06 — P4d security/correctness hardening (pre-cleanup audit)

What changed:
- Server-derive everything that matters: `createBookingAction` takes the recognition + slot, not price/status/customer. customerName is fixed to the demo customer server-side, price/duration are recomputed from the recognition via the DB pricing rules, and review status from the confidence policy. A browser can no longer book a $0/auto-confirmed appointment.
- Scoped reads: `listMerchantBookingViewsAction` (calendar, booking detail) vs `listCustomerBookingViewsAction` (profile, server-filtered to the demo customer). Conversation actions split into customer/merchant-scoped, set `authorRole` server-side, and authorize before appending.
- Merchant profile reads bookings/conversations from the DB (was localStorage); booking-detail status persists via `setBookingStatusAction`.
- `listAvailableSlotsAction` replaced the legacy fixed-date helper with `findAvailableTechnicians` over the next 7 days from today, honouring working_plan + blocked_time + DB bookings.
- Privacy copy + current-state corrected (data lives in the DB).

Why:
- The cutover server actions are the trust boundary now; the browser was supplying identity, money, status, and role. These move authority to the server as far as is possible without auth.

Tradeoff / known gaps:
- No auth system, so there is no real server-derived actor: a direct caller could still hit the merchant-scoped reads. True cross-account authorization needs auth (future ADR).
- Booking + thread + message creation is not one transaction. The booking↔thread case is handled by a compensating cancel; the residual gap (thread inserted, its first message insert fails → thread with no greeting) is benign and deferred. A single combined Postgres RPC is the ideal final mechanism.

## 2026-06-05 — P4c/P4d write cutover: confirm flow books to the DB (8bba335)

What changed:
- `src/lib/services/booking-service.ts` gained `createBookingFromSnapshot`: the current flat estimate → one synthetic `booking_item` (catalogItemId null) → the same transactional interval create + tenant guard + exclusion constraint.
- `src/lib/services/booking-adapter.ts` maps an interval booking + items back to the flat UI `Booking` shape (date/time via merchant tz, quote = Σ item prices, in_progress→confirmed, neutral placeholder recognition); `timezone.instantToZonedParts` is the reverse of `resolveSlot`.
- `IntervalBookingRepository.listByMerchant` added for the reader surfaces.
- `src/lib/actions/booking-actions.ts` (`createBookingAction`, server action): creates the interval booking + linked conversation thread, returns the flat UI Booking. If the thread insert fails it compensates by cancelling the booking (frees the slot; no orphan confirmed booking).
- The customer confirm page calls the action instead of the localStorage `createBookingFromDraft`.

Why:
- Begins the real DB cutover on the interval model (decision B), using the snapshot bridge so it does not block on live P6 catalog ids.

Verified live:
- Booking through the confirm page created the row in Postgres (tech-anna, 10:00 SGT → 02:00Z, 90 min, confirmed), a null-catalog snapshot `booking_item` ($120 → 12000 cents), and the linked `conversation_thread`.

Tradeoff / status:
- Write only so far. The reader surfaces (calendar/profile/detail/messages) still read localStorage; the branch is mid-cutover and must not merge until reads land (no shipped split-brain).

## 2026-06-05 — P6 (partial): recognition → catalog bridge

What changed:
- New pure domain layer `src/domain/recognition-catalog.ts`: `aiDetectableCatalogItems` (the constrained subset the model may emit — everything except `aiDetectable='no'`), `bucketRecognition` (validates ids, routes `weak`/`user_confirmed`/low/non-finite-confidence to an `uncertain` bucket, rest to `detected`), and `toCatalogSelections` (detected + user-confirmed uncertain → `CatalogSelection[]`, merging quantities).
- `CatalogSelection` is now defined once in `src/domain/catalog.ts`; `quoteService`'s `QuoteSelection` aliases it (removes a duplicate type, keeps the domain off `lib/`).
- Deterministic mock recognizer output `src/mock/catalog-recognition.ts` for tests and the no-key demo path.

Why:
- This is the bridge the DB cutover needs: it turns recognizer output into the catalog selections `quoteService`/`bookingService` consume, so a booking can be quoted from real catalog items instead of the flat estimate.
- It validates ids rather than mapping visual attributes, per ADR-0005 (no fuzzy attribute→billable table).

Tradeoff:
- Only the pure bridge + a mock recognizer ship. The live LLM in `src/nail-ai` still emits free-form attributes; wiring it to emit catalog ids is deferred (it is main's contested AI area and needs keys to validate).

Aligned assumptions:
- The DB cutover (rest of P4c + P4d) will feed `toCatalogSelections(...)` into `bookingService.createBooking`.
- The live recognizer change should reuse this contract rather than introduce a parallel mapping.

## 2026-06-05 — P4c safe slice: duration-aware local availability + sessionStorage draft

What changed:
- `findTechnicianSlots` now models existing bookings and requested slots as intervals and uses `intervalsOverlap`, so a long booking blocks every overlapping later start.
- The local availability wrapper falls back to 60 minutes when malformed draft or stored booking durations would otherwise create zero-length intervals.
- The confirm page threads the draft estimate duration into the localStorage-backed operations store availability query.
- `booking-draft.ts` now stores the customer draft in per-tab `sessionStorage` instead of module memory, with guarded snapshot consumption for the confirm page.

Why:
- This fixes the live PRD bug: technician time is locked for the style's full duration.
- This removes server/shared module state from the customer booking draft without cutting the UI over to the DB before all read surfaces are ready.

Tradeoff:
- The live path is still localStorage-backed. This is intentional to avoid DB/localStorage split-brain before the booking write and reader surfaces are switched together.

Aligned assumptions:
- P4a/P4b DB tables, RPC, and services remain the target architecture.
- P4d must move the related reader surfaces with the DB write path, or customer/merchant views can disagree.
- P6 catalog recognition is still needed for a clean quote-to-booking item mapping.

## 2026-06-07 — Intelligence Layer Phase A: event-sourced capture seam

What changed:
- Migration `0017_intelligence_layer.sql` adds two server-only tables: `customers` (seeded personas) and `analytics_events` (real behavioural log). All id/ref columns are `text` to match existing PKs; `analytics_events.id` is `uuid`. RLS on, no anon policies (service-role only, mirrors 0006). **Manual step:** run in the Supabase SQL editor before seeding (no CLI here).
- Domain contracts `src/domain/analytics.ts`: `AnalyticsEvent`, `NewAnalyticsEvent` (optional `createdAt` so the seed can backdate ~2 weeks), `Customer`, `AnalyticsEventType` + guard.
- New repositories `analytics` + `customers` (supabase + memory variants) wired into `RepositoryBundle`. `record/listByMerchant/listByCustomer` and `getByHandle/getById/listByMerchant`.
- `trackEventAction` server action (validates event_type at the public boundary; logs + swallows failures) and a fire-and-forget client `track()` helper (`src/features/analytics/track.ts`, per-tab session id) + `TrackOnMount` for view events.
- Real capture wired: `style_card_click` + `style_save` (StyleCard), `search_submitted` + `search_no_result` (feed tag-filter = catalog-label intents), `style_detail_view` (StyleDetailPanel), `try_on_completed` (TryOnPanel), and `booking_confirmed` server-side in the booking action (carries `style_id` for per-style conversion).
- Mock `customers.ts` now exports the Melissa persona (`cust-melissa` / handle `melissa` / name `Melissa Tan`) so the demo session attaches events to her and the appointment-context join lands.

Why:
- ADR-0006: only two real tables; everything else (profiles, trends, gaps, ranking) is computed on read from this log. Capture is real so the system keeps accumulating after the demo.

Tradeoff / scope:
- `style_impression` (IntersectionObserver) deliberately deferred for Phase A — the seed supplies the impression history; live impression capture adds observer noise for little demo value. Revisit if the dashboard needs a live CTR denominator.
- Live-capture verification is blocked on the manual 0017 apply; memory-repo unit tests cover the seam meanwhile (10 new tests; full suite 281 green).

Aligned assumptions:
- Phase B builds the read model over `analytics_events` via the catalog adapter; Phase C seeds the demo dataset (gap tag = 暗黑, anchors 8284 / 8265) bound to real published style_ids.
- `current-state.md` rewrite is deferred to Phase F (docs+dry-run) when the layer is complete, per the plan's phasing.

## 2026-06-07 — Intelligence Layer Phase B: read model (compute-on-read)

What changed:
- `src/domain/catalog-tags.ts` — shared catalog→tag adapter (`categoryOf`, `isServiceModule`, `tagsByCategory`, `tagLabelsOf`). The catalog IS the taxonomy; one source of truth for both the feed filter and the read model. `src/features/customer/style-facets.ts` refactored to consume it (behaviour unchanged — feed tests green).
- `src/domain/intelligence/` — pure, compute-on-read functions over `analytics_events` + published styles:
  - `getCustomerProfile` — weighted (save 3 / try-on 4 / booking 6 / click 1 / detail 2 / search 2), time-decayed (1.0/0.7/0.4/0.2 by age) tag affinity per category, plus averageBudget + recentInterest.
  - `getMerchantInsights` — snapshot + demand trends (this period vs previous) + design performance (incl. high-interest/low-conversion: tryOns≥8 & bookings≤1) + catalog gaps (search≥10 & matchingActiveStyles≤1, the ADR-0006 ≤1 rule).
  - `rankStyles` — tag affinity (normalized) + popularity + freshness, reason-coded; one function, two call sites.
  - `getCustomerIntelligence` — profile + ranked recommendations + appointment context (booking.customer_name == customer.name join).
  - shared helpers: `buildStyleTagIndex`, `buildPopularityIndex`, `EVENT_WEIGHTS`, decay. `now` is injectable everywhere for deterministic tests.
- Tests: catalog-tags + profile + insights (mirrors the demo narrative: 暗黑 gap surfaced, 甜美 ignored as saturated, 金属感 low-conversion flagged) + ranking + customer-intel. 16 new tests; typecheck clean.

Why:
- ADR-0006: no materialized profile/metric tables — every number derives on read from the event log through the catalog adapter, traceable to events.

Notes:
- `summarizeInsights` (AI narration) deferred to Phase D — it needs the model client; the read model feeds it pre-computed numbers.
- Pre-existing unrelated breakage observed: a separate uncommitted "merchant cloned-editor" WIP in this working tree (MerchantStyleEditor + ComponentBreakdownPanel changes + a leftover `console.error('DBG cancelEdit status=')`) has one failing test (`review/page.test.tsx > cancel …`, a disabled-button race). Proven independent of Phase A/B by stashing only the intelligence-layer edits — the failure persists. Not in scope; flagged for its owner.

## 2026-06-07 — Intelligence Layer Phase C: demo-truth seed

What changed:
- `src/mock/intelligence-seed.ts` — pure, deterministic generator bound to the real Phase-0 style_ids: `seedCustomers` (Melissa + 5 personas), `generateSeedEvents(now)` (~123 events over 2 weeks), and `seedStyleFixtures` (real facets, for the regression's supply side). Style anchors: top converter `8265` (裸色+法式风), low-conversion `8284` (金属感), gap style `8281` (暗黑).
- `src/mock/intelligence-seed.test.ts` — Phase C regression/eval (5 tests): runs the read model over the generated seed (fixed `now`) and asserts the locked narrative — 暗黑 gap (1 matching style), 金属感 trend up, 8284 high-interest/low-conversion, 8265 top converter, Melissa 裸色(color)+法式风(style) + SGD 80 budget.
- `scripts/seed-intelligence.ts` + `npm run seed:intelligence` — idempotent DB writer: upserts the 6 personas, replaces only seeded events (`session_id like 'seed-%'`, preserving live capture), inserts the backdated history. Standalone service-role client (app client is server-only).

Verification:
- Ran against live Supabase: 6 customers, 123 events (暗黑 21 / 金属感 35 / Melissa 8 / 8284 try-ons 34).
- Typecheck clean; full suite 302 passed (60 files).

Notes:
- Generator anchors events to wall-clock `now` at seed time, so re-run `seed:intelligence` shortly before the demo to keep the "this week vs last week" windows fresh.
- The flaky cloned-editor `review/page.test.tsx > cancel …` (separate uncommitted WIP, timing race) passed this run; still its owner's to stabilise.

## 2026-06-07 — Intelligence Layer Phases D–F: dashboard, panel, ranked feed, docs

What changed (D — Hero 1, merchant insights):
- `/merchant/insights` route + nav tab (📊). `getMerchantInsightsAction` loads the live event log + published styles → `getMerchantInsights` (compute-on-read). `summarizeInsightsAction` → `src/nail-ai/insights-summary.ts`: grounded AI narration that is given ONLY pre-computed metrics, told never to invent numbers and to say "数据不足" when weak; deterministic fallback when the model is unavailable. Cards: AI summary, snapshot, demand trends (this vs last week), catalog gap, design performance (high-interest/low-conversion + top converter). Empty-state when data is thin. 4 summary tests.

What changed (E — Hero 2, customer intel + ranked feed):
- `src/lib/actions/customer-intel-actions.ts`: `getCustomerIntelligenceAction(name)` (profile + recommendations + appointment context), `recordRecommendedStyleAction` (logs `recommended_style_sent`), `getRankedFeedAction` (Melissa's feed via `rankStyles` + localized reason chips).
- `CustomerIntelPanel` rendered below the merchant conversation chat (matched by `participantName`): preference chips, budget, appointment, recommended styles with "发送" (logs the event). Renders nothing for an unknown / no-history customer — never fakes a profile.
- Customer feed (`PublishedStyleFeed` → `StyleWaterfallGridClient` → `StyleCard`) re-ordered by `getRankedFeedAction` with a per-card reason chip; falls back to the plain published list if ranking is unavailable.

What changed (F — docs):
- `docs/architecture/current-state.md`: added `/merchant/insights`, the `customers`/`analytics_events` persistence bullet, migration `0017` + `seed:intelligence`, and a dedicated "Intelligence layer (ADR-0006)" section.

Verification:
- Typecheck clean. New intelligence tests all green (catalog-tags, profile, insights, ranking, customer-intel, seed regression, summary). The merchant `tabs.length` mock-data assertion was already updated to 5 by parallel WIP and matches the added Insights tab (passes in isolation).
- Known flaky-suite caveat: under the full `vitest run`, occasional single-test nondeterminism (the `mock-data` tab test and the unrelated cloned-editor cancel test) — both pass in isolation; this is pre-existing shared-state/timing flakiness in the suite, not a regression from these phases.

Demo dry-run (the flow that ties it together):
1. Re-seed: `npm run seed:intelligence` (fresh this-week/last-week windows).
2. Merchant → Insights: 金属感 rising, 暗黑 gap (1 style), 鎏金奢华 high-interest/low-conversion, 极光法式碎钻 top converter, grounded AI summary.
3. Customer (Melissa) → Home feed ordered to her taste with reason chips; click/save/try-on a 裸色/法式风 style → events land.
4. Merchant → Messages → Melissa's thread: customer-intelligence panel (her 裸色/法式风 profile, SGD 80, appointment, recommended styles) → 发送 logs `recommended_style_sent`.
5. Back to Insights: her live actions have moved the numbers.

## 2026-06-07 — Intelligence Layer: post-smoke polish

- **Reason chips** (`rankStyles`): added inverse-document-frequency weighting across the candidate set + a generic-filler suppression list, so a card's "why recommended" chip surfaces the customer's *distinctive* taste (法式风 · 裸色 · 杏仁形) instead of ubiquitous descriptors (亮面 · 日常通勤 · 果冻感). Ranking score also IDF-damped so rare matches rank higher. Confirmed live on Melissa's feed. New ranking test locks it.
- **AI summary** (`summarizeInsights`): wrapped the model call in a timeout race (`INSIGHTS_TIMEOUT_MS`, default 6s) → falls back to the deterministic grounded summary fast instead of hanging the dashboard's AI card. New unit test (hanging model → fallback).

## 2026-06-07 — Intelligence Layer Phase G (partial): Messages as the intelligence surface

Reframe (ADR-0006): demand intelligence moves from a dedicated tab into Messages (push, co-located
with the action). Decisions: responsive target, deterministic bot (no NLP), 3 named personas.

Shipped:
- **G6 — named personas.** `src/mock/intelligence-seed.ts` now seeds Melissa Tan (裸色/法式), Amy Lim
  (金属感/辣妹), Rachel Goh (甜美/可爱) — names match the real `conv-melissa`/`conv-amy`/`conv-rachel`
  threads — plus anonymous volume personas. Regression asserts each profile; merchant narrative
  invariants preserved. Re-seeded live (130 events).
- **G4 — report upgrades** (`/merchant/insights`): 今日/本周 toggle (`getMerchantInsightsAction(rangeDays)`);
  catalog-gap demand-vs-supply bars + evidence (not prose); full design-performance table, sortable
  (转化率/试戴量) + collapsible; conversion min-sample guard (`tryOns ≥ 3`) so a 1-try/1-book style is
  not a fake 100%.
- **G2 — Nailed AI 运营助手 bot.** New route `src/app/merchant/messages/ops/page.tsx` +
  `src/features/merchant/OpsBotThread.tsx`: a pinned, synthetic (non-DB) ops-assistant thread atop the
  merchant inbox. Posts deterministic digest bubbles (today snapshot, rising tag, gap alert, conversion
  winners) from `getMerchantInsights` (range 1 + 7) + grounded `summarizeInsights`; quick-reply chips
  deep-link to the full report. No free-text NLP.
- **G1 — Insights tab removed** (merchant tabs back to 4); the report is reached via the bot. `mock-data`
  tab assertion updated to 4.
- **Shared `isGenericTag`** promoted to `src/domain/catalog-tags.ts` (from ranking's local filler set);
  now also cleans demand-trend display + the bot's "需求上升" headline (surfaces 金属感, not 亮面).

Verification: typecheck clean; full suite green (exit 0). Bot + report + per-customer panel confirmed
rendering live (mobile viewport).

Pending (handed to the next agent):
- **G5 — responsive desktop two-pane** Messages shell (mobile is complete; desktop split-view per the mock).
- **G3 polish** — restyle the `CustomerIntelPanel` + an appointment-details card + chat bubbles to the
  mock's visual quality (the panel already works on all 3 threads).

## 2026-06-08 — Merchant style editor polish + archived republish

What changed:
- Merchant style review now has status-aware actions: draft = `发布` / `Publish`, published = `保存` /
  `Save`, archived = `重新发布` / `Republish`.
- Save, publish, and republish return to the style library after the server write completes and show a
  success toast there via a one-shot `sessionStorage` flash. Failures stay in the editor and show a
  failure toast.
- Archived republish is now a real lifecycle transition (`archived -> published`) with a fresh public image
  copy and refreshed config/items. Migration `0018_republish_archived_merchant_styles.sql` updates the
  Supabase RPCs to allow that explicit path and clear `archived_at`.
- The cloned breakdown editor renders the style image at the top from the saved preview URL, so re-edits no
  longer wait for original image bytes before showing the picture.
- Customer home still receives the ranked feed order, but the visible pink "匹配你的..." reason chip was
  removed from style cards.

Verification:
- `npm test -- src/app/merchant/styles/[id]/review/page.test.tsx src/app/merchant/styles/page.test.tsx src/domain/merchant-style.test.ts src/lib/services/merchant-style-service.test.ts`
- Lints clean for edited files.
- Local routes checked: `/`, `/merchant/styles`, `/merchant/styles/rose-cat-eye/review` return `200` and
  no Next fallback; customer home HTML no longer contains `匹配你的`.

## 2026-06-08 — Intelligence Layer: G3 done, G5 dropped (phone-only)

- **G3 — `CustomerIntelPanel` polished.** Customer name, distinctive preference chips (filtered via the
  shared `isGenericTag`, so 法式风/裸色/金属感 not 亮面/日常通勤/果冻感), 预算 + 互动 stat tiles, an
  appointment-details card (style · date · time · status badge), and recommended styles with localized
  「匹配 …」reasons + 发送 (logs `recommended_style_sent`). Verified live on all 3 named threads.
- **G5 (desktop two-pane) dropped** — demo is phone-only; mobile flow complete. Two-pane scaffolding
  reverted (`MerchantConversationList` removed, `ConversationListItem` active prop reverted).
- Typecheck clean; full suite green.

## 2026-06-08 — Merchant i18n batch 2 (insights, ops, intel, chat)

What changed:
- Added bilingual copy (`zh-CN` + `en`) to merchant insights, ops bot thread/page, style review subtitle,
  customer intel panel, chat style cards, and messages inbox ops entry.
- Replaced awkward calques (经营脉搏 → 门店概况/数据洞察; 经营快报 → 门店简报) with warmer, professional
  studio-facing Chinese.
- Locale-aware date/time formatting in `CustomerIntelPanel`.

Aligned assumptions:
- Default language remains `zh-CN`; every new zh string has a matching en pair.
- Tag labels from catalog/AI stay as-is (not translated).

Verification:
- `npm test -- src/app/merchant/styles/[id]/review/page.test.tsx` — 5 passed.
- Lints clean on edited files.

## 2026-06-08 — Merchant i18n batch 3 (breakdown panel + editor)

What changed:
- Extracted `breakdown-panel-copy.ts` with bilingual section labels, unit labels, art/deco groups, loading/error
  strings, and table headers for `ComponentBreakdownPanel` / `BreakdownTable`.
- Glossary chip labels now use `name_zh` / `name_en` based on active language (customer book flow + merchant editor).
- Consolidated `MerchantStyleEditor` strings into `editorCopy`; library archive/delete toasts and confirm dialog bilingual.
- `AnalyzeChip` quantity aria-labels and `ManageServiceRow` field labels bilingual.

Aligned assumptions:
- Catalog/glossary item names remain the source of truth for chip labels; only UI chrome is translated.
- Default language remains `zh-CN`.

Verification:
- `npm test -- src/app/merchant/styles/[id]/review/page.test.tsx` — 5 passed.

## 2026-06-08 — Merchant i18n batch 4 (central ui keys)

What changed:
- Added 43 shared keys to `src/i18n/messages/ui/` under `common.*`, `nav.*`, and
  `messages.merchant.ops*` / `messages.chat.viewStyle`.
- Wired shared actions and labels through `t()` in style editor/library, intel panel, chat style cards,
  ops bot inbox/page, bottom tab bar, manage rows, analyze chips, and breakdown retry.
- `GlossaryEntryCard` now uses bilingual catalog names, `formatDuration`, and central field labels.
- Customer/merchant profile privacy links use `common.privacyPolicy`.
- Added `src/i18n/messages/ui/messages.test.ts` to guard zh/en key parity.

Aligned assumptions:
- Page-specific copy objects remain for longer prose; repeated chrome uses central `t()` keys.
- `UiMessages` type enforces matching en/zh-CN dictionaries at compile time.

Verification:
- `npm test -- src/i18n/messages/ui/messages.test.ts src/app/merchant/messages/page.test.tsx src/app/merchant/styles/[id]/review/page.test.tsx src/app/customer/profile/page.test.tsx` — all passed.

## 2026-06-08 — Merchant i18n batch 4 (central ui keys)

What changed:
- Added 43 shared keys to `src/i18n/messages/ui/` under `common.*`, `nav.*`, and
  `messages.merchant.ops*` / `messages.chat.viewStyle`.
- Wired shared actions and labels through `t()` in style editor/library, intel panel, chat style cards,
  ops bot inbox/page, bottom tab bar, manage rows, analyze chips, and breakdown retry.
- `GlossaryEntryCard` now uses bilingual catalog names, `formatDuration`, and central field labels.
- Customer/merchant profile privacy links use `common.privacyPolicy`.
- Added `src/i18n/messages/ui/messages.test.ts` to guard zh/en key parity.

Aligned assumptions:
- Page-specific copy objects remain for longer prose; repeated chrome uses central `t()` keys.
- `UiMessages` type enforces matching en/zh-CN dictionaries at compile time.

Verification:
- `npm test -- src/i18n/messages/ui/messages.test.ts src/app/merchant/messages/page.test.tsx src/app/merchant/styles/[id]/review/page.test.tsx src/app/customer/profile/page.test.tsx` — all passed.

## 2026-06-30 — Pinterest live Trends verified + nail-scoped (选品)

What changed:
- Verified the user-OAuth path end-to-end: refresh token → fresh access token → live `/v5/trends/keywords/{region}/top/growing`.
- Found `PINTEREST_REGION=KR` is rejected — Pinterest Trends has **no Asia coverage**. Valid regions are
  Western only (US, GB+IE, CA, AU+NZ, DE, FR, IT, ES, BR, MX, …). Switched demo region to `US`.
- Found the unscoped endpoint returns generic pop-culture trends (TV shows, holidays). Added
  `PINTEREST_INTERESTS` (default `beauty`) → ~21/25 keywords are nail-domain (e.g. "4th of july nails
  french tip", +6500% MoM). Wired `interests` into `_fetch_pinterest`.
- Corrected the stale "~30 regions incl Asia" notes in `config.py` / `trends_source.py`.
- Updated `tests/test_tools.py` registry test (8 → 11 tools; the 3 选品 read tools were missing).

Aligned assumptions:
- Pinterest live = proof of real external-trend ingestion. English beauty keywords don't tag-match the
  CN catalog, so live mode surfaces "gap" opportunities; CN fixture remains the source for catalog-matching
  demo value. The `TREND_SOURCE` seam keeps both.
- Response carries `pct_growth_wow/mom/yoy` + weekly `time_series` — not yet consumed (kept `{label, tags}`).

Verification:
- `cd agent-service && .venv/bin/python -m pytest -q` — 10 passed.
- Live fetch via `trends_source.get_external_trends()` returns nail-domain US trends (TREND_SOURCE=pinterest).

## 2026-06-30 — 选品 momentum: Pinterest growth % → trend strength → ranking

What changed:
- `trends_source._fetch_pinterest` now keeps each row's `growth` (pct_growth_wow/mom/yoy) and folds MoM
  into a `strength` via `_strength_from_growth` (log-scaled [0.3,1.0]; growth spans 1%–6500%).
- `trend_logic.trend_opportunities`: external trends use their own momentum-derived strength (was a flat
  0.6); `growth` carried into each opportunity. `score = strength × fit × 0.5` now ranks by momentum.
  Fixture/internal trends have no growth → strength defaults 0.6 (prior behavior unchanged).
- Skill + `get_external_trends` docstring tell the agent to justify with growth %.

Verification:
- `.venv/bin/python -m pytest -q` — 10 passed.
- Live round (provider=openrouter, source=pinterest, US/beauty): 8 external gaps carried growth; ranked
  "4th of july nails french tip" (MoM +6500%, score 0.150) above the +2500% ones (0.140).

Open finding (NOT changed): internal demandTrends are per-tag → 21 internal price_test opportunities
flood the round and bury the external signal. Pre-existing trend_logic behavior; worth a follow-up
(cap/threshold internal trends) but out of scope for the Pinterest work.

## 2026-06-30 — 选品 agent picks the Pinterest trend window (trend_type tool param)

What changed:
- `get_external_trends(trend_type)` and `get_trend_opportunities(range_days, trend_type)` now take an
  optional `trend_type` — the agent selects the window at runtime: growing (default), monthly,
  seasonal (current-season/holiday spikes), yearly. Auto-derived OpenAI/beta schemas expose it as optional.
- `trends_source._fetch_pinterest(trend_type)` hits `/top/{trend_type}`; unknown → growing. Added
  `config.PINTEREST_TREND_TYPE` (default when the agent omits it). Skill tells the agent to prefer
  `seasonal` near holidays.

Verification:
- `.venv/bin/python -m pytest -q` — 10 passed; schema shows trend_type optional on both tools.
- Live: growing vs seasonal return different windows (US/beauty).

## 2026-06-30 — 选品 flood fix (internal trends de-flooded + price_test made style-level)

Problem: a 选品 round produced ~21 near-identical price_test rows that buried the real signal. Two causes:
(1) every "up" demand tag became its own trend — even 银色 at +1 count (+0.2%); (2) the classify rule
"any trend touching a high-interest-low-conversion style → price_test" let one over-tagged style (8284,
which carries almost every tag) stamp price_test onto nearly every trend.

Fix (trend_logic.py, the LIVE Python path):
- Internal demand → trend only if it rose ≥5% wk/wk (delta/previous), then cap to the top 6 by delta.
- Removed the per-trend price_test branch; trends now classify amplify (matched) / gap (no match).
- price_test is now STYLE-level: one opportunity per highInterestLowConversion style (score 0.30,
  ranks between amplify ~0.20 and gap ~0.145).

Result (live, US/beauty Pinterest): 29 → 15 opportunities — 1 price_test (8284), 6 amplify (meaningful
risers), 8 external gaps (momentum-ordered). Agent final answer reads as a clean priority list.

Divergence: src/domain/intelligence/trends.ts (a TESTED REFERENCE, not wired into any UI/route — only
re-exported + unit-tested) now lags this logic. Decide separately: mirror the change into TS + its test,
or retire the TS reference. Residual (for the vector-matching step): single-tag internal trends still
match every style carrying that tag (fit=1.0), so amplify rows list many style ids — semantic/composite
matching will refine this.

## 2026-07-01 — 选品 concept matching (VLM + Cohere hybrid retrieve/rerank) [ADR-0008]

Why: tag-overlap matching was broken on real inventory (missed 珠光法式银月钻 for "法式"; false-matched a
non-chrome style on its 金属感 tag). See spike + ADR-0008. Pinterest can't supply trend images, so the
trend side is text; represent nails as VLM concepts and match keyword→concept.

What changed (agent-service, all behind MATCH_MODE=tag|concept, default tag):
- Migration `0023_style_concept.sql`: pgvector + `style_concept` (concept_json, concept_text, embedding
  vector(1024), source_media_asset_id). MANUAL apply.
- `config.py`: MATCH_MODE, ENRICH_VLM_MODEL, COHERE_API_KEY/BASE_URL/EMBED_MODEL/RERANK_MODEL, EMBED_DIM,
  MATCH_TOP_K, MATCH_THRESHOLD; require_env checks COHERE_API_KEY when MATCH_MODE=concept.
- `cohere_client.py`: embed + rerank via httpx (no SDK dep).
- `enrich.py`: idempotent CLI — hero style photo → VLM concept (OpenRouter) → concept_text → Cohere embed
  → upsert style_concept. `python -m nailed_agents.enrich [--force]`.
- `matching.py`: `make_match_fn` → embed keyword → in-Python cosine top-k over cached vectors → Cohere
  rerank → threshold; returns None on error/empty → tag fallback. (In-Python cosine at hero scale ~32;
  hnsw index + an RPC is the scale path.)
- `trend_logic.trend_opportunities(..., match_fn=None)` — pure; concept score (rerank 0..1) becomes `fit`;
  tag-overlap when match_fn is None.
- `tools.get_trend_opportunities` builds the matcher when MATCH_MODE=concept.
- Tests: `tests/test_trend_logic.py` (flood fixes + matcher injection vs tag fallback). Suite: 16 passed.

Runbook to enable live: apply 0023 in Supabase → add COHERE_API_KEY to .env.local →
`cd agent-service && .venv/bin/python -m nailed_agents.enrich` → set MATCH_MODE=concept → run a 选品 round.

## 2026-07-01 — Model selection eval → Google embed + Cohere rerank (ADR-0008)

Chose the embed/rerank models by measured ability (not preference; cost excluded). Harness: 32 hero
concepts (VLM-captioned), 12-query bilingual gold set (visual/color/occasion, graded 0/1/2), ranking all
32 per query. Metrics: Recall@5/10, MRR, nDCG (embed); P@1, MRR, nDCG@5/10 (rerank).

Results:
- Embedding — **google/gemini-embedding-001** won decisively: R@5 0.76, R@10 0.91, MRR 0.92, nDCG@10 0.88
  vs cohere embed-multilingual-v3.0 (0.53/0.78/0.79/0.67), OpenAI-3-small (0.56/0.68/0.88/0.66),
  OpenAI-3-large (0.50/0.72/0.72/0.63). +0.18 weighted, beyond gold noise.
- Rerank — **cohere/rerank-multilingual-v3.5** (P@1 0.83, MRR 0.92, nDCG@5 0.77) chosen over LLM-judges:
  gpt-4o P@1 0.92 / MRR 0.96 (higher by ~1 query = within noise) but slow + token-cost + nondeterministic;
  gemini-2.5-flash 0.83/0.89/0.82. Cohere is one fast deterministic call/round → picked on operations.

Wiring:
- New `embeddings.py` (EMBED_PROVIDER=google|cohere|openrouter; google via generativeai embedContent,
  taskType RETRIEVAL_DOCUMENT/QUERY, outputDimensionality 1024). `enrich.py` + `matching.py` use it;
  rerank stays `cohere_client`. config: EMBED_PROVIDER (default google), GEMINI_API_KEY, EMBED_MODEL;
  require_env checks the embed provider's key + COHERE_API_KEY when MATCH_MODE=concept.
- `cohere_client._post`: bounded 429/5xx retry with backoff (honours Retry-After) — trial rerank is 10/min.

Free-tier note: Cohere trial = 1000 calls/mo, rerank 10/min (fine for demo, not production; commercial
banned → paid key later). Google embed free tier 100 RPM / 1000 RPD is ample. Tests: 16 passed.

## 2026-07-02 — ADR-0009 (synthetic demo data) + synthetic plan doc refreshed

- Promoted the synthetic-data approach to a reviewable decision record: `docs/decisions/ADR-0009-synthetic-demo-data.md`
  (two-determinisms: seeded data, live decisions; Beta/Poisson/Binomial funnel; planted ambiguous scenarios;
  band-verification; dataset doubles as the agent-eval test set).
- Refreshed the plan doc `docs/plans/2026-06-27-synthetic-demo-data.md` (Draft→IMPLEMENTED, §0.5 deltas):
  暗黑 = 0-stock gap (not "≈1"; no planted 8281), scripts shipped, ADR-0008 concept matching noted.
- OPEN DESIGN ITEM: **platform-hot (pop-style) signal is a placeholder** (`get_platform_hot` = cross-merchant
  tag-count). Real signal should be more sophisticated — neither raw booking/click nor tag-count — TBD.

## 2026-07-02 — ADR-0010 (evaluation methodology) + docs/eval/ consolidation

- Wrote `docs/decisions/ADR-0010-evaluation-methodology.md`: locks the eval approach as a decision (GB/T
  45288.2 loop; two separate suites — RAG=IR metrics vs multi-agent=capability matrix; benchmark shortlist+
  corroborate then own task eval decides; mixed test sources; 4/4-stability + grounding gates; noise-floor
  honesty; transcript closed-loop). Detailed reports stay standalone (not absorbed into the ADR).
- Consolidated the 3 eval docs from docs/plans/ → **docs/eval/** (trend-matching-design, trend-matching-eval-
  report, multiagent-eval-framework) + `docs/eval/README.md` index. Cross-refs in ADR-0008/0009 + memory updated.

## 2026-07-02 — Eval audit response (9 findings)

Addressed audit findings on the eval/matching work:
- #1 Persisted the RAG eval harness into the repo: `agent-service/eval/` (concepts.json, eval.py,
  caption_catalog.py, real_pinterest_check.py, README) so the report is replayable; fixed the report's
  reproducibility paths (scratchpad→agent-service/eval). pytest scoped to `tests/` (eval/ = scripts).
- #2 ADR-0010 + framework: **tool-call correctness is now a third BLOCKING gate** (=100% on core; agent
  auto-executes actions → wrong tool/target as dangerous as hallucination). Framework thresholds made
  concrete (工具100% / 幻觉0 / 4-4≥90%), replacing X/Y/Z placeholders.
- #3 Concept cache versioning: `style_concept.pipeline_version` (migration 0023 + idempotent ALTER);
  enrich staleness now keys on (media asset, model, PIPELINE_VERSION) — model/prompt/schema changes force re-enrich.
- #4 Match transparency: `get_trend_opportunities` output + transcript now carry `matchMeta`
  (matchModeRequested, conceptScored/tagFallback counts, conceptsLoaded, fallbackReason[s]) — a demo can't
  silently look concept-powered while running on tags. Per-opportunity `matchSource` (concept|tag).
- #5 Auditable "why": matcher returns concept_text with each match; surfaced as `matchWhy` per opportunity.
- #6 ADR-0006 addendum: reseed semantics (prod accumulates; `npm run seed:intelligence` resets by default,
  `--preserve-live-events` keeps live).
- #7 ADR-0007 status Proposed→Accepted (Phases 1–3b built; deployment trigger + real side-effect entities open).
- #9 Fixed stale doc pointers in code (config/enrich/cohere_client/embeddings/matching → docs/eval/).
- Regression tests added (matchSource/matchWhy). Suite: 18 passed.
Not done (honest): #8 the agent eval HARNESS is still unbuilt — the framework is the spec; building it is follow-on.

## 2026-07-02 — Pre-landing review fixes (3 informational)

- eval.py: llm_judge now constructs the OpenRouter client lazily inside rank() (no-key smoke test no longer crashes at build).
- embeddings._openrouter: requests `dimensions=EMBED_DIM` (1024) + fails loud if the model returns another dim
  → EMBED_PROVIDER=openrouter can't violate the vector(1024) contract.
- Docs synced to implemented contract: ADR-0008 (staleness key = media+model+pipeline_version), current-state
  (Google embed default + Cohere rerank + matchSource/why), design-doc status+§Provider/model marked SUPERSEDED
  → Google embed. Suite: 18 passed.

## 2026-07-02 — Agent eval Phase A (harness) built

- Tool-attempt recorder: `RunContext.tool_attempts` + `runner._run_openrouter` records every attempted
  tool call (name/args/ok|error) around execution — so invalid-arg attempts are visible to the eval, not
  inferred from "a tool body ran" (audit refinement #2).
- `agent-service/eval/agents_eval.py`: per-agent scenarios (trend/8284, customer_ops/lapsed, catalog/dead)
  over stubbed bus fixtures; scores tool-call correctness + per-agent expectation (read→opportunity,
  action→captured agent_action); structured decision signatures for the Phase-B 4/4 compare. Deterministic
  (TREND_SOURCE=fixture, MATCH_MODE=tag). All 3 pass; 18 unit tests green.
- Finding: catalog agent over-delisted (killed low-conversion 8284 alongside dead 8277) → Phase B needs
  negative assertions + decision-validity. Phase B = N-run stability + narrow grounding; Phase C = LLM-judge.

## 2026-07-02 — Agent eval Phase B (stability + negative assertions + grounding)

agents_eval.py now scores 5 blocking gates over N runs (default 4): tool-call correctness (attempt
recorder), scenario expectation (all N), negative assertion (forbidden action/target must not occur),
narrow grounding (cited style-ids must trace to fixture/tool output), 4/4 stability (structured decision
signature identical across runs — prose/free-text excluded, kind-aware so an empty action run is `()`).

Findings on the current agents (base model google/gemini-2.5-flash), n=3 smoke:
- trend/8284: all gates pass (deterministic tool output).
- customer_ops/lapsed: core decision stable + correct + forbidden-send avoided; MINOR instability — the
  agent inconsistently attaches a recommended style (styleId varies).
- catalog/dead-8277: sharper prompt FIXED the over-delist (negative assertion passes), but the agent is
  UNRELIABLE — delists 8277 only ~1/3, often no-ops → fails expectation + stability. Candidate fixes:
  prompt tuning or a stronger tool-calling base model (BFCL: Claude family tops function calling; the
  MODEL_PROVIDER seam supports the swap). The harness "FAILURES" verdict is correct — the gate reveals
  the agent isn't demo-ready, which is the point.
Phase C (next): LLM-judge for open-ended quality (briefing/message) with blind + human spot-check.

## 2026-07-02 — Agent-eval pre-landing review (1 critical + 6)

- CRITICAL runner allow-list enforcement: `_run_openrouter` now executes only `{n: IMPL[n] for n in
  tool_names}` — an off-allow-list tool name resolves to None → recorded as `off_allowlist` error, NEVER
  executed (previously any IMPL tool ran, side effect before the gate). Test added (test_runner).
- Harness: signature signs the EXPECTED opportunity (not opps[0]); tool-call gate adds target-exists
  (style_id ∈ fixture styles, customer_name ∈ roster) — caught a hallucinated styleId=456; expectation/
  forbid compare the explicit target FIELD per action_type (no payload-substring false positives); forced
  MODEL_PROVIDER=openrouter (recorder only covers that loop); local OPENROUTER_API_KEY check instead of
  require_env (bus is stubbed → no Supabase). npm `eval:agents` + `eval:matching` added.
- Tests: recorder asserted for success / invalid-arg / off-allow-list. Suite: 19 passed.
- Findings (unchanged direction): catalog over-conservative now → never delists (prompt over-corrected);
  customer_ops attaches a bogus style id → agent-quality work, not harness.

## 2026-07-02 — Agent eval pre-landing #3 (2 critical) → ALL GATES GREEN

- CRITICAL send_customer_message: optional style_id now validated against the merchant's PUBLISHED styles
  (bus.fetch_styles) before write — raises style_id_not_in_catalog on a hallucinated id (caught the eval's 456).
- CRITICAL catalog grounded (option A): new read tool `get_catalog_actions` returns the deterministic prune
  (delist) + gap (propose) candidates (same trend_logic used by 选品). Catalog agent + skill + orchestrator
  now EXECUTE that list instead of re-judging raw metrics. 8284 (high-interest-low-conv, on the 金属感 trend)
  is excluded from prune → never delisted; 8277 (dead) is the delist candidate. Registry now 12 tools.
- Harness: exact target equality (canonical full names/ids — "Rachel" no longer passes for "Rachel Goh");
  grounding scan now includes reasoning-transcript text; catalog scenario uses get_catalog_actions; README
  updated to Phase A+B / 5 gates / npm run eval:agents.
- RESULT: `npm run eval:agents -- --n 4` → **ALL BLOCKING GATES PASS** (trend, customer_ops, catalog all
  4/4 stable, correct, grounded, no forbidden action). Unit suite: 19 passed.

## 2026-07-02 — Agent eval pre-landing #4 (1 critical) → reproducibly green

Correction: the prior "ALL GATES GREEN" was FLAKY — customer_ops intermittently hallucinated a style_id
(9001/456); the tool rejected it (prod-safe) but the tool-call gate then failed. Fixes:
- CRITICAL: removed `style_id` from `send_customer_message` entirely (no grounded per-customer recommendation
  source exists → don't let the model invent a card). Skill + orchestrator task + schema test updated.
  customer_ops is now reproducibly stable (signature = (send_customer_message, customerName)).
- Shared report builder `_trend_report(range_days, trend_type)` — get_trend_opportunities AND
  get_catalog_actions both call it, applying MATCH_MODE (concept matcher) + matchMeta, so catalog prune/gap
  can't diverge from the trend agent in concept mode.
- Docs synced to the actual, reproduced status (this log + multiagent-eval-framework).
- Verified: `pytest` 19 passed; `eval:agents --n 4` → ALL BLOCKING GATES PASS (trend, customer_ops, catalog
  each 4/4). Reproduced twice.

## 2026-07-02 — Agent eval Phase C (LLM-judge quality + 问题闭环)

- `agents_eval.py --judge` (non-blocking): blind multi-judge MOS (1-5; gemini-2.5-flash + gpt-4o) on the
  open-ended output over 准确性/完整性/实用性/安全性; avg <3.5 or judge spread ≥1.5 → ⚑ human-review. Judges
  see only task+output (blind). Kept OFF the blocking verdict (quality ≠ gate).
- 问题闭环: blocking-gate failures (or low MOS) appended to `eval/regressions.jsonl` (gitignored) as
  regression seeds to grow the scenario set. Live `agent_runs.transcript` mining is the remaining extension.
- npm `eval:agents -- --n 4 --judge`. Smoke (--n 1 --judge): all gates pass; MOS trend/customer_ops ~4.5,
  catalog 5.0; 19 unit tests pass.
Agent eval now Phase A+B+C: 5 blocking gates + non-blocking quality + failure-seeded closed loop.

## 2026-07-02 — seed sync to fixed tool contract (agent-seed.ts)

`npm run seed:agents` wrote stale definitions/runs. Synced src/mock/agent-seed.ts to the live Python surface:
- catalog def tools: ['list_style','delist_style','draft_upload'] → ['get_catalog_actions','list_style',
  'delist_style','propose_listing'] (draft_upload is an ACTION type, not a tool); instruction now describes
  the grounded get_catalog_actions flow; seeded catalog transcript prepends a get_catalog_actions call.
- customer_ops: removed the "推荐款式小卡片" from the instruction; seeded run drops styleId from the
  send_customer_message tool_call + action payload (now customerName+body only) + card mentions.
Typecheck (tsc --noEmit) clean.

## 2026-07-02 — Phase C audit cleanup (judge robustness + closed-loop)

- Judge parse/infra failure no longer mixes with real scores: strict validation (overall ∈ 1..5), errors
  stored per-judge separately, MOS averages ONLY valid scores (was: fabricated 0 → false 2.5 avg + false
  regression). Added `response_format=json_object` → gemini-2.5-flash now returns valid JSON reliably.
- 问题闭环 persists ANY human-review flag (disagreement-only / judge-error), not just blocking failures.
- Regression records are now replayable seeds: task, fixture snapshot, final output, captured actions,
  tool_attempts, tool_bad/forbid_hit/ungrounded, raw judge outputs+errors, and a suggested failure category
  (tool_call/expectation/negative_assertion/grounding/stability/quality/judge_infra).
- ADR-0010 updated: RAG eval + agent eval A+B+C are BUILT; open items = live transcript mining, scenario
  growth, numeric grounding, judge calibration.
- Note: the earlier seed-staleness finding was already fixed (verified) before this audit.
- Verified: 19 tests; `eval:agents --n 1 --judge` → all gates pass, both judges valid (4/5/5), no false flags.

## 2026-07-02 — Phase C audit #2 (rep-run + tests + doc drift)

- Regression seeds now capture the REPRESENTATIVE (first-failing) run, not always run 0: `evaluate` picks
  `rep` = first run failing a per-run gate (else run 0) + records `rep_index` and all `run_signatures`;
  the judge scores `rep`'s output; `_log_regression` writes `rep`'s final/actions/tool_attempts. Fixes the
  case where run 3/4 hallucinated but the seed showed a clean run.
- Phase C unit coverage: `tests/test_agents_eval.py` (network-free, fake OpenAI + tmp regression file) —
  quality_judge parses valid scores + isolates judge errors (not averaged as 0) + rejects out-of-range
  overall; _log_regression writes a rich replayable record with the right category + rep_index. Suite: 22 passed.
- Doc drift fixed: harness docstring + README → "Phase A + B + C"; README regression line → "any human-review
  flag (incl. disagreement/judge-error) → replayable seed". Also fixed a datetime.utcnow() deprecation.

## 2026-07-05 — Merchant 今日 home, Phase 1 (shell)

- New agent-first merchant home per DESIGN.md → "Merchant Agent Home". Phase 1 = static shell only:
  `src/app/merchant/today/page.tsx` + `today.module.css` (CSS module, tokens from globals.css `:root`).
  5 zones: structured stat strip (营收/今日单/新客), 需要关注 hero (pending pin + horizontal done-roll),
  per-technician roll (the single calendar entry), 常驻 2×2. Current look = color left-stripe + emoji +
  44px controls (chip-only + line-icon migration parked in DESIGN.md backlog).
- Two isolated new files — no existing code touched, reachable at `/merchant/today`, verified rendering
  in-app with no console errors. Tab flip (日历→今日) + live data (Phases 2–5) still to come.

## 2026-07-06 — 今日 home: audit corrections + route reuse

- Backend-contract audit verified against code: action controls were ahead of backend
  (`setActionStatus` only does `approved`/`undone` — no stop/unlist API), group-buy is browser
  localStorage (coupon actions are records, not live deals), the calendar uses `mockTechnicians` + a
  UTC `todayIso()`, and the plan doc conflicted with DESIGN.md. Fixed: DESIGN.md's Reversibility-Honest
  rule rewritten to real capability (draft → 批准/拒绝; every applied → 查看). stop/unlist + DB group-buy +
  tz-safe today + the Python reversibility-flag fix → backlog. Plan doc got a "DESIGN.md is canonical" banner.
- Routing (reuse `/merchant/calendar`, no home-path/entry-hint churn): home extracted into
  `src/features/merchant/TodayHome.tsx` (+ `.module.css`); `/merchant/calendar` renders it (entry-hint
  kept); the full calendar split to `/merchant/calendar/schedule` (reached via the tech roll's 完整日历 →);
  tab 1 relabeled 日历→今日 (i18n zh/en) + home icon; scratch `/merchant/today` removed. Both routes 200,
  no console errors.
- Adopted for Phase 2: one read model `getMerchantTodayHomeAction()` (per-field try/catch → deterministic
  + independent-failure) driving `TodayHome`; per-tech from `technician-repository` + interval bookings +
  merchant timezone (not the mock/UTC calendar path).

## 2026-07-06 — 今日 home, Phase 2 (read model + live data)

- ADR-0011: one read model `getMerchantTodayHomeAction()` drives the home. Pure, deterministic compute in
  `src/domain/merchant-home.ts` (compute-on-read, merchant tz): `computeHomeStats` (rolling-7d revenue +
  delta, new-salon → null/"暂无对比", today orders, new customers), `computeTechnicianDay` (busy/free +
  load + next appt, inactive excluded), `controlCapabilities` (backend-honest: draft → 批准/拒绝, else 查看),
  `splitActions` (proposed → pin, applied <48h → roll). 12 unit tests pass (`merchant-home.test.ts`).
- `src/lib/actions/merchant-home-actions.ts`: fetches bookings once (feeds stats + techs) + agent actions
  by status + technicians + agents, each in its own try/catch so a broken zone can't blank the page.
- `TodayHome` consumes the read model: real stat strip / pending pin (批准/拒绝 wired to the existing
  approve/reject server actions, optimistic) / done roll / technician roll, per-zone loading/empty/error +
  an 8s timeout so a hung source degrades to the error state (no infinite spinner).
- Verified: `/merchant/calendar` 200, no console errors, tsc clean for the new source (only a stale `.next`
  cache entry for the removed /today route, cleared). Local Supabase is unreachable, so the running demo
  shows the timeout→error/empty states; the wiring is proven by the passing compute tests.

## 2026-07-06 — 今日 home, Phase 2 audit remediation

Second audit pass on the read model, each finding verified against source before fixing:
- **Route split left tests red (High):** the old `/merchant/calendar` calendar-behavior tests still
  asserted the calendar UI, which now renders on `/merchant/calendar/schedule`. Moved those 6 cases to
  `schedule/page.test.tsx` (repointed import + pathname); slimmed `calendar/page.test.tsx` to the home
  shell + the onboarding hint (compute is covered by `merchant-home.test.ts`). 26/26 green.
- **Draft-upload title broken for the real payload (High):** `propose_listing` writes `{ gapTag, reason }`,
  but the title read `styleTitle`/`styleId` → "上架建议 ·" with an empty suffix. Title now uses `gapTag`
  (styleTitle/styleId kept as defensive fallbacks); added a payload-shape regression test.
- **Inert controls (High):** the 4 常驻 tiles now link to their real routes (styles / insights / agents /
  manage) — no dead tiles. The drill-down affordances (pin 查看, 查看全部, recent-card 查看推理) are removed
  (not shown inert) until Phase 3 builds the reasoning sheet; recent cards are static info cards for now.
- **Optimistic approve/reject could hide a failed action (Medium):** `act()` now reloads on a `null`
  return (stale/invalid transition), not only on a thrown error.
- **Fake reversibility at the source (Medium):** `send_customer_message` was tagged `reversible` and its
  docstring claimed "the merchant can retract it" — a sent message cannot be un-sent. Fixed at the Python
  source (`risk="irreversible"`), which makes the existing `AgentActionInline` / `AgentRunDetailClient`
  undo controls (gated on `risk === 'reversible'`) correctly hide. Open decision (not silently changed):
  `place_ad` / `set_group_buy_coupon` are "stoppable in concept" but have no stop/unlist API yet — their
  reversibility labels + the panel's undo UX stay as-is pending that call.
- **UI quality (Low):** dropped negative letter-spacing (`.titlebar h1`, `.statN`) and the pointer/hover
  affordance on the now-static pin + recent cards; labelled the two horizontal rolls (`role="list"` +
  aria-label). Roving-tabindex / keyboard scroll remain a Phase-6 a11y item.
- Pre-existing suite failures (24, in customer-booking / styles-review / landing / insights) are unrelated:
  none import `merchant-home`/`TodayHome`, and their causes are domain copy/seed drift from the branch's
  mid-development state — not this change.

## 2026-07-06 — 今日 home, Phase 3 (reasoning drill-down sheet)

DESIGN.md "Two-Depth Disclosure" made real: a card's face → a bottom sheet with WHY + lineage.
- `deriveRunDetail(runId, allRuns)` (pure, in `domain/agents.ts`): resolves a run + its parent (who
  triggered it, via `parentRunId`) + its children (who it spawned). Deterministic → 4 unit tests
  (`agents.test.ts`). New types `RunRef` / `AgentRunDetail`.
- `getAgentRunDetailAction(runId)`: thin I/O shell — one `listRuns(demoMerchantId)` (full views) fed to
  `deriveRunDetail`. Lineage logic stays out of the client.
- `AgentRunSheet.tsx` (+ `.module.css`): reuses the shared `BottomSheet` and the global `agent-chain*`
  classes (matches the `/merchant/agents` run detail). Shows agent + status, output headline, 上下游
  lineage (parent ↑ / children ↓ as links to the full run page), the 推理链路 transcript, and a
  "查看完整记录 →" link. Read-only by design — approve/reject stay on the pin (single source of that
  optimistic state); the sheet is the "view" depth. Own loading / not-found states.
- `HomeActionView` gained `runId` (from `toActionView`) so a card knows which run to open.
- `TodayHome`: the de-clicked affordances from the Phase-2 remediation are now backed — the pin's 查看
  and the recent (done) cards open the sheet; recent cards are buttons again with the 查看推理 → cue and
  their hover/focus affordance restored.
- Verified: `/merchant/calendar` 200, home renders, tsc clean, 26/26 domain+route tests pass, no runtime
  errors (only RSC error-boundary scaffolding in the SSR HTML). Local Supabase unreachable → the sheet
  shows its not-found state until runs are seeded; lineage correctness is proven by the compute tests.

## 2026-07-06 — 今日 home, Phase 5 (real technician `off`) + Phase 6 (a11y polish)

Phase 5 — technician roll `off` is now real, not inferred from `active=false`:
- `computeTechnicianDay` takes the scheduling kernel's `workingPlans` (`domain/scheduling.ts`, the same
  source the booking availability grid uses). A technician with no plan covering today's weekday →
  `off` / 今日未排班. Weekday is derived from the merchant-tz `todayKey`. Busy/free unchanged.
  `merchant-home-actions` now fetches `repos.workingPlans.list()` alongside technicians (one `Promise.all`).
  Seed check: `mockWorkingPlans` has anna on TUE–SUN only, so she reads `off` on Mondays — a real 3-state
  roll. New unit test covers the off case; existing tech tests updated to the new signature (27 pass).
- Blocked-time (partial-window training/leave) stays in the full calendar — it doesn't map to a single
  coarse card state (ADR-0011 update).

Phase 6 — a11y:
- Fixed a `role="list"` / `role="listitem"` anti-pattern from the Phase-2 remediation: `listitem` on a
  `<button>`/`<Link>` strips its native role. The two rolls are now `role="group"` + aria-label, and the
  cards keep their native button/link semantics. Technician links got a structured aria-label
  (`name · state · nextLabel`).
- `:focus-visible` rings on every interactive card (`.acard` already had one; added `.tcard`, `.lcard`,
  `.btn`). A `prefers-reduced-motion` block drops the hover-lift transforms/transitions.
- Verified: `/merchant/calendar` 200, tsc clean, 27/27 domain+route tests pass.

## 2026-07-06 — chip contrast fix (WCAG AA) via ink tokens

Followed up the deferred Phase-6 contrast item as a global design-token addition (not a home-local fork):
- The colored state chips were sub-AA at 10px bold — success `#2e8b6c`/`#e4f3ec` = 3.65:1, busy
  `#c73963`/`#ffe4eb` = 4.18:1, amber `#d97706`/`#fdecd2` = **2.75:1**; accent link text `#ec5d7b` on white
  = 3.27:1 (AA-normal needs 4.5:1).
- Added three AA-safe **ink tokens** to `globals.css`: `--color-success-ink #217a5c`,
  `--color-warning-ink #9a5b00`, `--color-accent-ink #b32e57` — the darker text shade for a hue sitting as
  small text on its own soft tint. Base success/warning/accent are unchanged (still used for fills/icons),
  so no existing screen changed appearance; the inks are a primitive others can adopt.
- Home (`TodayHome.module.css`) + sheet (`AgentRunSheet.module.css`) chips now use the ink tokens; accent
  link text (`.cardGo`, `.more`, sheet `.full`) uses the existing `--color-accent-strong` (5.01:1). New
  ratios: success ink on tint 4.58:1 / on white 5.25:1; warning ink on tint 4.68:1; accent ink on tint
  5.09:1 — all ≥ AA.
- Verified on a clean dev server (the long-running :3100 was wedged, 500ing every route incl. untouched
  `/`): `/merchant/calendar` 200, home renders, all three ink hexes live in the served `layout.css`, tsc
  clean, 27/27 tests pass. All ratios re-checked programmatically (WCAG relative-luminance).
- Self-audit (verifying the pass, not just asserting it) caught **two element-level fails the first pass
  missed**, now fixed: the primary **批准** button was white on `--color-accent #ec5d7b` = 3.27:1 →
  switched its fill to `--color-accent-strong #c73963` (white on it = 5.01:1); the technician **avatar
  initial** was accent-strong on accent-soft = 4.18:1 → `--color-accent-ink` (5.09:1). Also removed a dead
  `t.all` copy key orphaned when 查看全部 was dropped in the Phase-2 remediation.
- **App-wide finding (not fixed — flagged):** the global `.button-primary` (used on other screens, e.g.
  the agent run detail) has the same white-on-`#ec5d7b` = 3.27:1 issue. Left to the shared-token follow-up
  rather than scope-creeping this change into other screens.

## 2026-07-06 — audit round 2 remediation (6 findings, all verified against source)

- **[Critical] Reversibility regression I introduced.** Making `send_customer_message` irreversible exposed
  a latent bug in `AgentRunDetailClient.tsx:154`: `isProposed` fired on any `risk==='irreversible'`, so an
  *applied* sent message showed Approve/Reject. Fixed — the gate is now `status==='proposed'` only; risk
  decides undo eligibility separately.
- **[Critical] Fix hadn't reached the demo.** The Python tool wrote `irreversible`, but the in-memory seed
  (`agent-seed.ts:267`) + its test still said `reversible`, so the running demo still offered Undo for a
  sent message. Seed → `irreversible`; test updated; added a regression test that `setActionStatus(...,
  'undone')` returns null for the message. Live `agent_actions` rows with `type='send_customer_message'`
  still need a one-time backfill to `risk='irreversible'` when Supabase is reachable (manual migration).
- **[Issue] Merchant scoping.** `merchant-home-actions` now filters technicians by `demoMerchantId`
  (`list()` is not merchant-scoped yet — repo backlog); plans match by tech id, so none leak across merchants.
- **[Issue] Busy semantics.** `computeTechnicianDay` marked a tech busy for *any* later appointment. Now
  `busy` = *currently inside* an appointment interval `[start, start+duration)` (uses `quote.duration`, 60m
  fallback); a later appointment is `free` with a `next` label — matches DESIGN.md "空闲 = free now / between".
- **[Issue] i18n.** The 常驻 tiles, the "今日 N 单" load text, **and** the technician status label (which
  the domain used to emit as hardcoded Chinese) rendered Chinese in English mode. Fixed at the root:
  `TechnicianDayCard` now carries a **structured** `label` (`serving`/`next`/`done`/`idle`/`off`) and the
  component formats it from the per-language copy; tiles + load moved into the copy object too.
- **[Issue] Sheet payloads.** `AgentRunSheet` now truncates long tool-payload JSON (140 chars) with the full
  record one tap away; run detail is unchanged.
- Verified: tsc clean; 38/38 on the touched suites; full suite 24 failed / 472 passed — **failure count
  unchanged from baseline (no regression)**, +7 passing from new/updated tests; `/merchant/calendar` 200 on
  a clean dev server.

## 2026-07-06 — merged origin/main + ADR-0012 accepted + Phase 0a (action↔entity contract)

- Reconciled `feat/persistence-p0` with `origin/main` (was 4 behind / 16 ahead): pulled in the **StyleAd
  ad-campaign subsystem** (center `/merchant/ads` + per-style editor, migrations 0022–0025). One conflict
  (`repositories/index.ts`); renumbered the colliding `0023_style_concept → 0026`. tsc clean, no test
  regression. Consequence: the 投广 UI + ad entity already exist — remaining work is linkage + brain + 团购.
- ADR-0012 accepted: **brain = per-style advisory tool, agent = multi-tool loop + cross-signal synthesis,
  no single tool returns "the answer."** Ads: auto-launch within the merchant cap (withdrawable daily-drip),
  gate above. Entity linkage + relational groupbuy items + state machine + eval + currency snapshot folded in.
- **Phase 0a (schema/repos/state-machine, no UI behavior change):**
  - Migration `0027_action_entity_contract.sql`: `agent_actions` gains `entity_type`+`entity_id` (polymorphic
    forward link); `style_ad_campaign` gains `source_run_id` (guarded — the ad tables aren't on every DB);
    new `groupbuy_deal` (cents + currency snapshot, JSONB policy fields, `source_run_id`) + relational
    `groupbuy_deal_item` (FK catalog_item, quantity, position — mirrors `merchant_style_item`). Idempotent.
  - `domain/action-entity-contract.ts`: legal entity transitions + the coarse entity→action-status mirror.
  - `GroupbuyRepository` seam: interface + memory impl (seeded from the demo deals, merchant-scoped,
    transitions validated) + supabase impl (record ↔ deal+items, cents conversion) + both bundles wired.
    Domain gains a `GroupbuyDealRecord` wrapper (merchantId/currency/sourceRunId) — the UI-facing
    `GroupbuyDeal` is unchanged, so the localStorage path + panels still work (rewire is Phase 0b).
  - Tests: action-entity-contract (4) + memory groupbuy repo (3). Migration is applied manually (the demo DB
    lacked the ad tables → `style_ad_campaign` ALTER guarded).

## 2026-07-06 — Phase 1 decision brain (pure, `src/domain/decision/`)

The PM spec (`美甲款式运营决策分析`) made real as pure, testable modules. Per ADR-0012 §5 the brain is
**advisory**: it returns scores + a candidate lever + machine signal tags — no prose, no final verdict; the
agent synthesizes across styles + briefing + capacity + the cap.
- `economics.ts` (T1): contribution / revenue-per-hour / **profit-per-hour** / break-even coupon. Cost model
  fix — variable cost is an ABSOLUTE amount fixed from the normal price (so break-even is a real floor, not
  the degenerate 0 a %-of-price cost would give); platform fee is % of the transaction. Cents throughout.
- `funnel.ts` (T2): CTR/detail/save/try-on/booking/completion rates → PM-weighted **Demand** & **Conversion**
  scores (each rate normalized against a tunable target). Divide-by-zero safe.
- `capacity.ts` (T3): next-week utilization band + **fragment-fit** (largest free gap ≥ style duration) via
  pure interval math over working plans (breaks removed) minus resolved busy intervals — a 150-min style is
  not recommended into 45-min gaps. The action layer resolves tz/bookings/blocks to minutes (keeps it pure).
- `decision.ts` (T4): the 4 scores (Business-Value is batch-relative per PM) + the quadrant rule engine →
  `ad | coupon | display_only | skip` with signal tags + a suggested coupon price. Gates: ad needs
  profitable+converting+underexposed+util≤85%+fits; coupon needs interested-but-stuck+util≤70%+fits+above
  the profit-per-hour floor; else display_only (real interest, can't justify spend) or skip.
- Tests: economics (6) + funnel (4) + capacity (4) + decision-quadrants (5) = 19. tsc clean.
- Not yet wired: the read-model action that fetches real data → these functions, and the agent/tools that
  consume the output — that is Phase 2 (which also sets the action↔entity linkage from 0a).

## 2026-07-06 — Phase 2 slice A (TS contract + read model)

- **A1 (contract):** `AgentAction` gains `entityType`/`entityId` (mirrors migration 0027); supabase agent
  repo maps the new columns. Memory seed leaves them null. Type-only import avoids a domain cycle.
- **A2 (read model):** `src/domain/decision/aggregate.ts` (pure) — `funnelCountsByStyle` (event log →
  per-style counts; completions joined from the completed-booking set, so completionRate is real) +
  `bookingsToBusyIntervals` (bookings are already merchant-local → capacity intervals). +2 tests.
  `src/lib/actions/decision-actions.ts` — `getStyleBusinessDecisionsAction`: fetch published/priced styles +
  analytics + bookings + working plans + techs → aggregate → capacity once (shared band + largest gap,
  per-style fit = gap ≥ duration) → `decideStyles` → `{ decisions, capacity, errors }`. Per-field try/catch
  like the 今日 read model; merchant tz + coupon floor are demo constants (envelope wiring later).
- Verified: tsc clean; decision suite 21 tests. Remaining Phase 2: Python tools (`propose_ad`/`propose_groupbuy`
  write entities + set linkage) + un-force orchestrator/decision.md (allow skip) + `get_style_business_decisions`
  tool + entity-aware undo (TS) + eval skip/propose scenarios + the `source_run_id` follow-up migration.

## 2026-07-06 — Phase 2 slice B (TS): group-buy terms parser + propose path

- `domain/groupbuy-validation.ts` (pure, audit #4): one `validateGroupbuyDeal` parser (end>start, discount ≤
  original, sale window, low-peak availability HH:mm ranges, positive quantity; `requirePublishable` adds
  title + ≥1 service). Shared by the propose path (draft-level) + the wizard (publishable) so an
  agent-created deal can't persist nonsense. +5 tests.
- `actions/groupbuy-actions.ts` — `proposeGroupbuyDealAction(deal, sourceRunId)`: validate → persist a real
  DRAFT via the repo seam with `sourceRunId` → return it. The Python tool calls this then writes the
  agent_action with `entityId = deal.id` (the forward link); the merchant reviews/publishes in 团购管理.
  +2 tests (memory bundle).
- Verified: tsc clean, 7 new tests.
- **Plumbing landed (additive, verified):** `bus.write_action` now takes optional `entity_type`/`entity_id`
  (kwargs — existing calls unaffected, pytest 22 still green); API routes `/api/agent/decisions` (GET the
  decision read model) + `/api/agent/propose-groupbuy` (POST → `proposeGroupbuyDealAction`) expose the brain
  + propose path to the Python agent.
- **Remaining Phase 2 (coupled behavior chunk — needs a model/pytest/eval run to verify, done together):**
  `tools.py` wiring (call the routes; `set_group_buy_coupon`→propose semantics; new `get_style_business_decisions`;
  StyleAd draft propose) + un-force `orchestrator.py`/`decision.md` to allow `skip` + eval skip/propose
  scenarios (Slice D) + TS entity-aware undo & the `source_run_id` follow-up migration (Slice C).

## 2026-07-06 — synthetic capacity data (rolling next-week bookings)

The decision brain's capacity gate needs real interval bookings in the next 7 days; the funnel seed only
emits booking *events*, and `mockIntervalBookings` are historical → a live test read the salon as 100% idle.
- `src/mock/capacity-booking-seed.ts` — pure `generateRollingBookings` (seeded PRNG): fills `today..+6` with
  a realistic partial load (per-tech fill varies → utilization + fragment gaps differ), inside working hours,
  never across the break, no per-tech overlap (respects the `booking_no_overlap` constraint), reproducible ids.
- Folded into `npm run seed:intelligence` — one command now seeds funnel + capacity together (cleared/reinserted
  by the `capseed-%` id prefix). Documented in the synthetic-data doc (§9b). 4 generator tests; tsc clean.

## 2026-07-06 — Phase 2 B2/C/D: the agent consumes the brain and may do nothing

The behavioural half of ADR-0012 — the 决策 agent stops being a two-action quota machine.
- **B2 (the agent reads the brain).** `bus.fetch_decisions()` → `GET /api/agent/decisions`; new read tool
  `get_style_business_decisions` (auto-registered into IMPL/BETA_TOOLS/OPENAI_TOOLS via `_FUNCTIONS`).
  `skills/decision.md` rewritten: the brain is **advisory**, the agent **synthesises** across it + briefing +
  选品 + capacity and picks **0..N** actions; capacity-first (don't discount a full week, don't amplify what
  the week can't absorb); "本轮不采取投广/团购" is an explicit, valid conclusion.
- **Un-forced the orchestrator.** The 决策 step gets the brain tool and no longer demands "两个精确动作";
  the 投广/团购 executor steps are told to call **no tool at all** when the decision didn't choose them.
- **D (eval).** `Scenario` gains `decisions` (+ `bus.fetch_decisions` stub) and a `no_action` expectation:
  a correct skip makes **zero tool calls**, so `tool_ok` now treats that as success (previously "no tool
  calls" was always a failure — which would have marked every correct skip as broken). New regression
  `ad/full-capacity-skip`: given a decision to skip (91% utilization, weak profit/hour), the 投广 agent must
  not call `place_ad`. `forbid` still guards against acting anyway.
- **C (migration).** `0028_style_ad_source_run.sql` — idempotently adds `style_ad_campaign.source_run_id`
  for databases that apply the ad tables *after* `0027` (whose ALTER is guarded and won't re-run).
- Verified: pytest 22 green (registry-parity test updated), all service modules + the eval compile, tsc clean.
- **Tail (needs a model + seeded DB to verify end-to-end):** the entity rewire — `set_group_buy_coupon` should
  call `/api/agent/propose-groupbuy` and write the action with `entity_type='groupbuy_deal'`/`entity_id`
  (status `proposed`) instead of an applied log row; `place_ad` likewise → a `StyleAd` draft (needs a
  `proposeStyleAdAction` + route, and the ad tables applied); plus TS entity-aware undo.

## 2026-07-06 — Phase 2 entity rewire: the executors create REAL commercial objects

First live agent round proved the brain+agent half works (决策 called `get_style_business_decisions`, cited
grounded numbers, and **overrode the brain** — it declined coupons on 8275/8273 because the 数分 briefing
flagged them as delist candidates). But the executors still wrote applied log rows with `entity=-/-`.
Rewired both:
- **`set_group_buy_coupon` → a real reviewable draft.** `proposeGroupbuyForStyleAction` builds the deal from
  the published style (title, current price as original, and its **authoritative catalog breakdown** as the
  bundled services), validates the terms, persists via the repo seam with `source_run_id`. The tool then
  writes the action with `status='proposed'`, `entity_type='groupbuy_deal'`, `entity_id=<deal id>`.
  **Verified live:** `gb-style-melissa-img-8284`, ¥88 → ¥70.40, 7 relational `groupbuy_deal_item` rows.
- **`place_ad` → a real StyleAd campaign.** `proposeStyleAdAction` upserts `style_ad_campaign` with
  `source_run_id`. Envelope (ADR-0012 §2): daily budget ≤ `AGENT_AUTO_LAUNCH_MAX_DAILY_BUDGET_CENTS` (¥50)
  → `active` (auto-launch; spend is a withdrawable daily drip) → action `applied`; above the cap → `draft`
  → action `proposed`, for the merchant to launch in 投广中心.
- HTTP hops live in `bus.post_propose_ad` / `bus.post_propose_groupbuy` so the tools stay stubbable; routes
  `/api/agent/propose-ad` + `/api/agent/propose-groupbuy` take agent-native input (styleId + cents).
- Gotcha found: a `'use server'` module may only export async functions — the budget cap + types moved to
  `domain/style-ad.ts`.
- Tests now enforce the contract: `place_ad` links `entity_type='style_ad'` + status mirrors the campaign;
  new `set_group_buy_coupon` test asserts `status='proposed'` + `entity_type='groupbuy_deal'`. pytest 23, tsc clean.
- **Blocked for ads only:** the demo DB has no `style_ad_campaign` — the route returns a clear
  "apply migrations 0022_style_ad_campaign + 0023-0025 + 0028" error. Coupons work end-to-end today.
- **Still open:** `GroupbuyPanel` reads `localStorage`, so the merchant cannot yet *see* the DB-created draft
  in 团购管理; supabase group-buy `save` is not transactional; entity-aware undo (stop the campaign / unlist
  the deal) is not wired; ad ROAS + measured underexposure unmodelled.

## 2026-07-06 — 团购管理 on the repository seam: the merchant can review what the agent proposed

The loop was open: the agent created a real `groupbuy_deal`, but the panel read browser `localStorage`, so
the proposal was invisible. Closed it.
- **Server actions** (`groupbuy-actions.ts`): `listGroupbuyDealsAction`, `getGroupbuyDealAction`,
  `saveGroupbuyDraftAction` (draft-level validation, preserves `sourceRunId`), `publishGroupbuyDealAction`
  (publishable validation → `draft→published` via the contract's transition guard), `setGroupbuyStatusAction`
  (unlist/relist), `copyGroupbuyDealAction` (a copy is merchant-authored → `sourceRunId` cleared).
- **`GroupbuyPanel`** now loads from the seam (async, with loading/empty/error states). The hardcoded
  `aiSuggestions` mockup is gone: the **AI助手 card lists the agent's real proposals** — deals with a
  `sourceRunId` still in `draft` — each opening the detail view; list rows carry an `AI 建议` badge.
- **Orphan removed:** `repositories/local/groupbuy-repository.ts` (+ its test) had no consumers left after
  the rewire; deleted rather than left as dead code.
- **Error-message bug fixed:** `isMissingStyleAdTableError` matches any message containing `style_ad_campaign`
  + `schema cache`, so a missing *column* was reported as a missing *table*. `proposeStyleAdAction` now checks
  `source_run_id` first and names migration `0028`. (Probing the live DB showed the ad tables were applied all
  along — only `0028` was missing.)
- Tests: manage suite 22 (helpers await the async list; new regression asserts the AI card surfaces an
  agent-proposed draft). Full suite 24 failed / 512 passed — failure count unchanged from baseline. pytest 23,
  tsc clean.
- **Still open:** supabase group-buy `save` is not transactional (needs an RPC); entity-aware undo; ad
  ROAS + measured underexposure.

## 2026-07-10 — Phase 2 tail: entity-aware undo, atomic group-buy save, ad ROAS + measured exposure

Closes the three items left open by the 团购管理 rewire. All three were places where the code *reported*
something it had not actually done.

**1. Entity-aware undo.** `undoAgentActionAction` flipped `agent_actions.status` and stopped there — the
campaign kept spending and the deal stayed published. Now: read the action → pre-check `canUndoAction`
(new, in `domain/agents.ts`; the memory repo's duplicated guard now delegates to it) → withdraw the
**entity** → mirror the coarse status.
- **The order is the design.** Entity first: if the mirror then fails, money is already stopped and the
  stale pill self-corrects, because the entity's status is authoritative. Mirror-first would report "undone"
  while the ad kept spending.
- New: `AgentRepository.getAction` (both impls), `withdrawStyleAdCampaignAction` (also the 投广中心 pause
  button later), `styleAdWithdrawTarget` / `groupbuyWithdrawTarget` in `action-entity-contract.ts`.
- `GROUPBUY_TRANSITIONS.draft` gains `unlisted`: rejecting an agent proposal **shelves** it (keeps
  `source_run_id` for audit) rather than deleting it. An applied irreversible action is refused *before* its
  entity is touched. Withdrawing an already-not-live entity is a no-op, not an error.
- The seeded coupon action now carries `entityType: 'groupbuy_deal'` / `entityId: 'deal-001'` so memory mode
  behaves like Supabase — otherwise the demo's undo lies.

**2. Atomic group-buy save (migration `0029_save_groupbuy_deal_rpc.sql`).** `save` was upsert + item-delete +
item-insert as three PostgREST calls; a failure between the delete and the insert left a **published deal
with zero services**. One plpgsql RPC now commits deal + items together, restates the table defaults (an
explicit INSERT overrides them), and refuses to reassign a deal across merchants.

**3. Ad ROAS + measured underexposure (`src/domain/decision/ads.ts`).** The ad gate fired on scores and
capacity, never on money, and `underexposed` was emitted *by* the ad branch — it meant "we decided to ad".
- `expectedRoas = contribution / costPerBooking`, `costPerBooking = AD_COST_PER_CLICK_CENTS ÷ (bookings/clicks)`
  measured from the style's own funnel. **ROAS is scale-free** (the budget cancels), so *whether* to advertise
  is a property of the style; the cap only decides *how much* of a good buy to buy.
- `exposureRatio = impressionShare / demandShare` — attention received vs attention earned. `< 0.8` = the
  shop's own surface under-serves it.
- **Asymmetric defaults:** unknown ROAS is a **NO** (wrongly spending is a real loss); unknown exposure is
  reported as `exposure_unknown`, never fabricated, because the agent narrates these signals. Exposure needs
  ≥2 impression-carrying styles — one style is 100% of its own batch.
- Honest limit recorded in-code and in the ADR: bookings are treated as fully incremental, so ROAS is an
  **upper bound**; `AD_COST_PER_CLICK_CENTS = 120` is a named assumption, not a measurement.
- The 决策 skill + tool docstring now require the agent to quote `expectedRoas` and `exposureRatio` in its
  reason, and state that a null ROAS is a NO, not a maybe.

**Verified live** (demo merchant, 5 styles with traffic): exactly 2 clear both gates — `8274` (ratio 0.61,
ROAS 4.1) and `8249` (ratio 0.66, ROAS 6.8). Blocked: `8284` (26% of all impressions, 61 clicks, **zero**
bookings → ROAS unmeasurable) and `8282` (ROAS 1.8 < target 2.0). The gate removes exactly the two buys that
would have burned cash, and `8284` — the style the old brain wanted to amplify — is the clearest example.

- Tests: full suite **24 failed / 529 passed** (failure count unchanged from baseline; +17 passing). pytest 23.
  tsc clean. New: 6 withdrawal-target cases, 4 undo-orchestration cases (memory bundle, end-to-end),
  6 ad-gate cases incl. over-exposed peer, unmeasurable ROAS, and scale-freeness.
- **Requires migration `0029`.** Until it is applied, group-buy `save` throws a message naming the file
  (deliberately no silent fallback to the non-atomic path).

## 2026-07-10 — Merchant UI alignment: readable transcripts, traceable proposals, token-scale cleanup

Audit-driven pass over the new merchant surfaces (今日 home, 团购管理, agent team, run detail, AI inline
cards), which had drifted from the app's design system and rendered developer exhaust to merchants.

**Transcripts became human (the big one).** The run page's 思考链 rendered the entire brain output as one
raw-JSON wall (`JSON.stringify(input) → JSON.stringify(output)` at 12px). Now every thinking-chain surface
renders through `src/domain/agent-transcript.ts` (pure, 15 tests): per-tool summarizers turn I/O into one
sentence with the numbers that matter (决策大脑 → "42 款分析：投广候选 3 · 团购候选 4 · … · 下周产能 33%"),
`describeAction` replaces `JSON.stringify(payload)` in action rows, and raw payloads live only inside a
capped mono `查看数据` expander. One shared `TranscriptChain` renderer (Multica-inspired tone pills:
thinking=violet / tool=blue / action=emerald) is used by BOTH the 今日 bottom sheet and the run page — the
same run no longer reads differently per entry point. Unknown tools fall back honestly (name + expander).

**Proposals are traceable end-to-end (ADR-0012 audit gap).** The backward link existed in the DB but no UI
exposed it: 团购 detail now shows "AI 提案 · 查看推理 →" (via the deal's `sourceRunId`), 投广中心 rows carry
an "AI 建议" badge + "为什么?" link (snapshot now selects `source_run_id`), inline AI cards link 为什么? to
the run, and run-page action rows deep-link "查看 →" to the entity (ads editor / `?panel=groupbuy`, a new
manage-tab deep link). The ads center also gains the missing kill switch: a 暂停 button on live campaigns
wired to `withdrawStyleAdCampaignAction`.

**Duplicate AI rows gone.** The manage-page AI card listed one row per historical action for the same
entity ("已为 …8284 设置团购券" ×4, truncated ids). `dedupeActionsByEntity` keeps the latest per entity;
`styleLabel` renders 款式 8284 instead of `…a-img-8284`.

**Type-scale alignment.** New surfaces had invented sizes (0.6–0.84rem sprinkled everywhere). All lane/
section labels now use the manage page's established quiet-uppercase micro-label pattern; every sub-12px
font in TodayHome/AgentRunSheet/groupbuy CSS moved onto the `--text-xs/sm` tokens (12px floor); groupbuy
wizard topbar's hardcoded peach → `--color-bg` token; groupbuy back buttons match the app-wide
`← 返回` `.detail-back-link` pattern and are i18n'd (were hardcoded Chinese pills); run page gains the
standard top back link.

**Backend-honest fixes (ADR-0011).** 团购 purchase/redemption counts showed a fake 0 with no data source —
now '—' (unknown); the manage currency picker says "未能连接后台，显示的是本地缓存数据" instead of silently
presenting stale cache as loaded; agent team cards gain presence dots (green pulse = live run) + last-run
line tying 团队成员 to 最近运行.

- Design doc: `docs/plans/2026-07-10-merchant-ui-alignment.md` (local). Audits: design-system map, surface
  misalignment, Multica pattern catalogue (`/home/tough/multica`), wiring gaps.
- Tests: full suite 24 failed / 544 passed (baseline failure count unchanged, +15 passing); new
  `agent-transcript.test.ts` (15); manage suite 22/22 (back-button selectors updated to the new
  accessible name). tsc clean.
- Deferred (documented in the design doc): GroupbuyPanel URL-backed navigation, TodayHome stat-strip
  cascade isolation, real groupbuy sales counts, full GroupbuyWizard i18n.

## 2026-07-10 — Merchant-PM journey walk: task context, real style names, architecture-true team page

Second alignment pass, driven by a screenshot walk of every merchant journey (production build, 390×844)
acting as merchant + PM. Findings table lives in the local design doc; the fixes:

- **Run detail got its missing context.** The chain started mid-air — no hint of WHY the agent acted. The
  hero now shows 任务来源 ("由「决策 Agent」的结论触发本次任务") with ↑upstream/↓downstream lineage chips
  (via the existing `deriveRunDetail`), so the sheet is no longer the only place lineage exists.
- **The chain stopped repeating itself.** The Python runner records a tool_call AND an action step for the
  same act; rendered together the chain said one thing three times. `condenseTranscript` drops action steps
  that restate the preceding tool_call (the action's status still shows in 执行动作).
- **Real style names everywhere.** Styles have titles ("Melissa Design 8284") but transcripts, action rows
  and 今日 feed cards showed machine ids ("下架 · sty…", "…a-img-8284"). New `getStyleTitleMapAction`
  threads a titles map through the describers, TranscriptChain, run page, sheet, inline AI cards, and the
  今日 read model (`toActionView`/`splitActions` take styleTitles; enrichment failure degrades to ids,
  never blanks the feed).
- **Team page now renders the PM architecture** (商家运营 Multi-Agent 画板), replacing both the flat
  9-card grid and the wrong "闭环：数分→决策→执行→监测" caption: three colored business lanes —
  款式运营 (数据收集 → 商业决策 → 动作 → 监测), 用户运营 (匹配 → 召回私信), 预约运营 (规划中, honest
  placeholder) — with the orchestrator above. 最近运行 capped at 9 with a 显示全部 N 条 toggle (was an
  undifferentiated 42-run dump).
- **Cramp/format fixes:** "← 返回" no longer wraps (nowrap + flex-shrink); 广告中心 "$328.00" and 今日
  "$0" → SGD convention; campaign titles wrap 2 lines instead of ellipsizing the AI 建议 badge away;
  为什么? links nowrap; 团购 AI 建议 clamp 2→3 lines so the coupon price survives; bare-text loaders on
  团队/run detail → standard LoadingState; Python action summaries `:.0f`→`:g` (券后 70.4 was logged
  as "70").
- Open (documented): 26-deep pending-approval pileup from repeated demo rounds needs an expiry/batch
  policy; the trailing LLM 推理 text still carries raw ids/markdown (skill-prompt fix, not a UI rewrite);
  demo runbook should use `next build && next start` (dev-mode compiles read as broken pages).
- Tests: full suite 24 failed / 544 passed (baseline unchanged). pytest 23. tsc clean. Verified by
  re-screenshot: team lanes, coupon-run context + condensed chain with real names, SGD ads center.

## 2026-07-10 — ADR-0013 proposed: dynamic orchestration, cross-round memory, feedback loop

Owner audit called the orchestration layer what it is: a fixed Python pipeline wearing a team costume.
ADR-0013 (Proposed) scopes the rebuild to that layer only — orchestrator-as-agent with bounded dispatch
tools (skip/parallel with citable reasons), a round blackboard (`agent_rounds`), cross-round memory
(`agent_memory` — monitor writes MEASURED campaign outcomes, 决策 reads them, retiring the estimated-ROAS
caveat with data), one bounded revision edge (监测 may reject an action and re-dispatch the executor once),
and proposal hygiene (dedupe by gapTag + round supersede + merchant cap — the 25-条待确认 fix). Substrate
(bus, runs/actions, entity contract, tools, brain, all UI) is explicitly kept. Phases P0–P3 defined;
implementation not started in this entry.

## 2026-07-10 — ADR-0013 P0+P1: proposal hygiene + orchestrator-as-agent

The orchestration layer stopped being a for-loop. Implemented and live-verified:

**P0 — proposal hygiene.** `propose_listing` now (1) supersedes the agent's older pending proposals on
its first call of the run (`bus.expire_stale_proposals`, audit trail kept), (2) dedupes by gapTag within
the round, (3) hard-caps at `config.MAX_PENDING_PROPOSALS` (5). Live: the 25+ pending 上架建议 pileup
collapsed to exactly 5 after one round.

**P1 — dynamic orchestration.** `orchestrator.py` rewritten: 运营助手 runs its own tool loop with
`dispatch_agent` / `dispatch_many` (parallel fan-out), reading the briefing + decision brain itself and
deciding which lanes to wake. Deterministic guardrails in `RoundState`: lane whitelist, one dispatch per
agent per round, `MAX_DISPATCHES_PER_ROUND` budget, atomic batch validation; dispatch tools refuse to run
on any context without a RoundState (lane agents can't dispatch). Upstream conclusions are appended to
child tasks verbatim by Python (no LLM copying); children parent to their semantic upstream so the
lineage tree renders the round as decided. New `skills/orchestrator.md`: default plan (the old chain),
citable skip rules, non-skippable 数分/决策, no-interim-prose reply protocol.

**Model tier decision:** flash reliably abandoned the dispatch chain after one tool call; prompt hardening
failed, gemini-2.5-pro fixed it — `ORCHESTRATOR_MODEL` (orchestrator only) added to config.

- Eval: 2 new orchestrator scenarios driving the REAL RoundState (full-capacity must-not-dispatch
  ad/coupon; chosen-lanes ad-yes/coupon-no) — both 2/2 stable. `customer_ops/lapsed-rachel` flaked once
  at n=2 (pre-existing flash nondeterminism, passes on re-run). pytest 23 → 30 (P0 supersede/dedupe/cap;
  dispatch guardrails incl. orchestrator-only refusal and atomic batch validation).
- Live round: orchestrator dispatched 8 lanes with cited numbers (ROAS >3.8, exposureRatio <0.76,
  产能 33%), ad/coupon/catalog/customer_ops all started the same second (parallel), monitor last.
- Removed: the fixed `_CHAIN` and the decorative 数分' rebaseline run (P2's memory write replaces it).

## 2026-07-10 — Audit-the-audit on ADR-0013 P0/P1 + contract tightening

An external audit reviewed ADR-0013 against a MID-IMPLEMENTATION snapshot: its headline claims (fixed
_CHAIN still present, no RoundState, no orchestrator skill, pytest 2-failed) were already false at HEAD —
verified: _CHAIN gone, RoundState live, skill present, pytest 30/30. Four fragments were right and landed:

- **Seed honesty**: the orchestrator agent row still described the old fixed chain with `tools: []` —
  updated to the dynamic-orchestration instructions + real tool list (v2), re-seeded.
- **ADR §1**: `read_run` removed from the decision text — dispatch is synchronous and returns the child's
  conclusion, so the tool was never needed.
- **ADR §3 (P2 spec)**: memory must never duplicate/override live facts — raw metrics stay in
  `style_ad_campaign`/event tables; `agent_memory` stores windowed, entity-keyed, evidence-linked
  VERDICTS with expiry + unique (merchant, kind, key) upsert. Live tables always win conflicts.
- **ADR §4 (P3 spec)**: revision entity-transition table added — a revision never forks a parallel
  entity (stable ids make executor re-runs in-place upserts); published deals and irreversible actions
  are not revisable.
- **ADR §5**: hygiene wording aligned to the implemented contract (supersede → in-run dedupe → cap) with
  the no-RPC single-writer justification recorded.

## 2026-07-11 — ADR-0013 P2+P3: round blackboard, cross-round memory, bounded revision edge

**P2.** Migration `0030_agent_rounds_memory.sql` (MANUAL APPLY PENDING): `agent_rounds` (blackboard jsonb)
+ `agent_memory` (windowed, entity-keyed verdicts, unique (merchant,kind,key), evidence run, expiry) +
`agent_runs.round_id`. Python: `bus.start_round` degrades loudly to None when 0030 is unapplied; the
orchestrator writes `blackboard[lane] = conclusion` deterministically as lanes finish; `read_blackboard`
(read-only) for lanes. Monitor gains `get_campaign_outcomes` (live style_ad_campaign metrics — the truth)
+ `record_memory` (verdicts only, never raw metric tables); 决策 gains `get_agent_memory` and its skill
now reads memory FIRST — measured verdicts outrank estimates.

**P3.** `RevisionPort` — injected ONLY into the monitor's RunContext (mirrors the orchestrator-only
RoundState pattern): `request_revision(action_id, feedback)` supersedes the action (undone) and re-runs
the owning executor once, parented to the monitor run, same entity upserted in place (never forked).
Bounds in code: one revision per action, 2 per round, only reversible entity-backed place_ad /
set_group_buy_coupon in applied/proposed state; published deals and sent messages refuse.

**Skill discipline finding:** the monitor on flash flaked in both directions until the skill got
bright-line thresholds with a worked division example (revise iff clicks≥50∧bookings=0, or budget>¥100
∧ spend/booking>¥200). After: `monitor/overspending-ad-revised-once` and `monitor/healthy-ad-no-revision`
both 2/2 stable.

- pytest 30 → 36 (memory row shape, kind whitelist, revision refusal outside monitor, once-per-action,
  budget cap, irreversible/entityless refusal). Registry 20 tools.
- BLOCKED for final verification: OpenRouter credits ran out mid-eval (402) — full-suite rerun + the
  live P2/P3 round need a top-up + migration 0030 applied.

## 2026-07-11 — Judge-facing technical documentation set

New `docs/technical-documentation/`: seven documents synthesizing the ADRs, eval evidence, and live-round
data into a defensible engineering account — system overview, multi-agent architecture (with the
what-we-rejected table), decision brain & economics (incl. honest limits), action contract & safety
model (envelope / undo ordering / capability objects), memory & the revision edge, evaluation
methodology (three layers + the findings it produced), and a 20-question anticipated judge Q&A covering
the hard tradeoffs (why no framework, fake-ROAS critique, blast radius, synthetic data, scale limits).
Every claim cites a code path, an ADR, or a measured run.

## 2026-07-11 — Tool allow-lists single-sourced (external audit P0/P1)

An external code audit found the `agents.tools` DB column had drifted from the runtime truth
(`LANE_TOOLS` in Python): the panel showed 1 tool for 决策/用户运营/监测 while the runner enforced
3/2/4 — the UI lied about three agents' capabilities.

- **Single source**: `src/mock/agent-tools.json` — orchestrator.py loads it as
  `ORCHESTRATOR_TOOLS`/`LANE_TOOLS`; `agent-seed.ts` imports the same file into `agents.tools`.
  Parity tests both sides (pytest: names must exist in the registry, no lane may hold dispatch tools;
  vitest: every seed definition matches the JSON). Re-seeded — drift class dead.
- **Typed contract**: `bus.agents_by_slug` returns `dict[str, AgentRow]` (TypedDict) with an explicit
  column select — key typos now fail static checks.
- **Doc precision** (doc 02): the agents row is registry + audit identity + UI metadata; prompts are
  `skills/*.md` (PR-reviewed, eval-pinned), allow-lists are the shared JSON. Deliberate, now stated.
- Deferred (recorded in doc 02): DB-configured lists validated against a code ceiling
  (`configured ⊆ ceiling`) — only worth building when agent configs become merchant/ops-editable.
- Stale fallback instructions for 决策/监测 refreshed to match current skills; those rows bumped to v2.
- pytest 37/37, tsc clean, seed parity 2/2. Known pre-existing: 24 vitest failures in
  booking/landing/style-review pages, present on the parent commit too — unrelated, needs its own pass.

## 2026-07-11 — ADR-0014: context routing, structured executions, prompt identity

External audit round 2 — three context gaps verified at HEAD and fixed:

- **Write-only blackboard**: `read_blackboard` existed but no lane held it (a comment even claimed
  otherwise). Now: required context is INJECTED by Python (`CONTEXT_POLICY` — decision always gets
  insight+trend conclusions; monitor always gets decision + the execution list); the tool is granted
  to 决策/监测 only for optional mid-run reads.
- **Monitor had no path to action ids**: `request_revision(action_id)` needs `agent_actions.id`, but
  live rounds never surfaced it — the eval passed only because scenario prose hand-fed the id. Now:
  `bus.fetch_round_actions` (round-scoped join) → `_execution_context` injects the structured list
  `{id, type, status, risk, entity_id, payload}` into the monitor's task AND `blackboard["executions"]`
  (refreshed after each executor lane); the eval injects through the SAME formatter — no more
  hand-written approximations. Eval scenario tool lists now import LANE_TOOLS/ORCHESTRATOR_TOOLS
  (cannot drift).
- **Prompt identity** (migration `0031`, user-applied): `agent_runs.prompt_sha` (sha256[:16] of the
  resolved system prompt) + `agent_runs.agent_version`. skills/*.md is the prompt truth — editing it
  never touched any recorded version. Enables prompt A/B grouped by sha. Degrades loudly pre-0031.
- skills: monitor.md documents the injected execution list; decision.md documents injected upstream
  conclusions + optional read_blackboard. Seed rows bumped to v3, re-seeded.
- pytest 39/39 (new: `_upstream_context` routing/dedupe, `_execution_context` shape), tsc clean,
  seed parity 2/2. Deferred in ADR-0014: context-pack abstraction, fully-structured blackboard,
  memory-kind expansion. Live P2/P3 round still pending migration 0030 + OpenRouter top-up.

## 2026-07-11 — Gemini-direct provider fallback; FIRST full all-green eval suite

OpenRouter credits ran dry mid-eval (402). Added `MODEL_PROVIDER=gemini`: the same Gemini models via
Google's OpenAI-compatible endpoint, reusing the existing OpenAI-format loop + tool_attempts recorder
(`GEMINI_API_KEY` was already in .env.local for embeddings). Three provider-quirk fixes it surfaced:

- **Integral floats from function-calling**: Gemini emits `7.0` for 7 → `_bounded_int` now coerces
  integral floats (JSON has no int type; rejecting 7.0 was pedantry that broke real calls).
- **Unbounded thinking ate max_tokens**: 2.5 models think by default on the direct endpoint; measured
  as one-tool-call → empty-response chain abandonment. `GEMINI_REASONING_EFFORT=low` bounds it; the
  loop also retries ONCE on a dead response (no content, no tool calls) before ending honestly.
- **Temperature**: default 1.0 flip-flopped the monitor on identical inputs. `AGENT_TEMPERATURE=0.2`
  — operations agents judging bright-line thresholds want reproducibility, not creativity.

Eval hardening: `--only <substring>` scenario filter; provider-aware key check; scenario tool lists
already import LANE_TOOLS (previous entry). **Result: `--n 2` full suite ALL BLOCKING GATES PASS on
gemini-direct** — first complete all-green run (previous evidence was per-scenario across runs), and
it re-validates the ADR-0014 monitor path post-skill-edit: the revision signature `('act-ad-8284',)`
now comes from the INJECTED structured execution list, not hand-fed prose. pytest 39/39.

## 2026-07-11 — ADR-0015 memory architecture + ADR-0014 invariants (audit round 3, full adoption)

User chose full adoption of the third external review. Two commits:

**Pile 1 (verified bugs)**: monitor snapshot barrier (reserve() rejects monitor batched with other
lanes — partial execution-list risk); blackboard lost-update fixed with a per-round lock; execution
list ordered (created_at, id) with code-computed `revisionable`; injected conclusions carry provenance
(source slug + run id + evidence-not-instructions delimiter) and absent sources are annotated;
prompt_sha now full sha256; agent_runs.input persists the FINAL rendered task + model id.

**Memory v2 (ADR-0015)**: migration `0032` (kinds action_outcome/calibration/round_verdict/
merchant_preference, scope, comparison, confidence, source_action_id). place_ad/set_group_buy_coupon
snapshot the decision brain's hypothesis into the action payload at execution time (code-derived).
record_memory/get_agent_memory replaced by: `record_action_outcome` (agent gives assessment +
confidence; code derives identity, comparison — e.g. measured 28000分/单 vs predicted 8000 → ratio
3.5 underestimated_cost — window, TTL by confidence; refuses immature windows), `record_round_verdict`
(requires action-id evidence), `search_memory` (structured relevance scoring, per-agent domain access
via MEMORY_ACCESS; executors get none). Deterministic memory hints injected into 决策 + orchestrator
tasks (two-stage retrieval). All skills gained a scoped memory contract; monitor.md rewritten for the
audit/outcome split. Allow-lists updated in agent-tools.json; seed rows bumped and re-seeded.

Verification: pytest 44/44 (new: identity derivation, immature-window refusal, evidence requirement,
monitor-only writes, relevance ranking + access filter, snapshot barrier); **full eval suite n=2 ALL
BLOCKING GATES PASS on gemini-direct** — monitor scenarios green through the new writer tools.
USER must apply migrations 0030 → 0031 → 0032, then the live round.

## 2026-07-11 — Demo history seed + due-outcomes injection (closing the loop on stage)

Problem: a live agent-created campaign starts at 0 impressions, and `record_action_outcome` correctly
refuses immature windows — so a fresh demo run could never show memory being written or cited. Seeding
memory rows directly would be indefensible ("where did this come from?" — "we typed it").

- **`scripts/seed-agent-history.ts`** (`npm run seed:agent-history`, idempotent): a backdated round
  from 7 days ago — decision run → two ad runs → two ACTIVE campaigns with a week of metrics → their
  `agent_actions` rows carrying hypothesis snapshots, exactly as `place_ad` writes them live. The two
  campaigns straddle the monitor's bright lines: 8284 over-spender (¥280/booking measured vs ¥80
  predicted → memory + revision) and 8265 healthy (¥17 vs ¥18 → memory only; revising it is the
  trigger-happy failure). Memory itself is NEVER seeded — the live monitor writes it on stage. The one
  exception: a `merchant_preference` row (it represents merchant settings, not agent experience) —
  skipped loudly until 0030+0032 are applied.
- **`bus.fetch_due_actions` + `_due_context`**: the monitor now receives TWO injected lists — this
  round's executions (usually pending) and past actions whose campaigns have data (its real
  measurement targets). This is the auditor's `get_due_outcomes` in minimal form: data presence is the
  due signal, the immature-window gate stays the enforcement. monitor.md updated for the split.
- Verified live: seed ran against the real DB; `fetch_due_actions` returns both seeded actions with
  their hypotheses. pytest 44/44, tsc clean.
- Demo script: round 1 → monitor measures seeded history live (outcome memory + one revision on
  8284); round 2 → 决策's injected 记忆提示 cites the mem id and tightens budgets.

## 2026-07-11 — Live P2/P3 rounds verified end-to-end; two real failures caught and fixed

Migrations 0030/0031/0032 applied; history seed rerun (preference row landed). Five live rounds on
gemini-direct. Verified in the DB, not the console:

**The loop works.** Round 1: monitor received the injected due list, wrote both outcomes with
code-computed comparisons (8284: measured 28000分/单 vs predicted 8000 → ratio 3.5
`underestimated_cost`; 8265: ratio 0.93 healthy), and fired EXACTLY ONE revision — 投广′ re-landed
ad-…8284 at ¥80/day; the envelope parked it as a draft; campaign metrics survived the upsert.
Blackboard: all lane sections + 10 structured executions. prompt_sha + final rendered task persisted.
Later rounds converged: revised budget under the bright line → no further revisions; monitor wrote a
generalized round_verdict（高意向低转化款直接投广会放大获客成本——先用团购解决转化）with evidence ids.

**Failure 1 — hint selector too coarse.** Round 2's 决策 hints carried the healthy 8265 outcome but
DROPPED the 3.5× miss (newest-one-per-kind picked the wrong row). Fix: `_HINTS_PER_KIND` caps
(outcomes/calibrations ×3, verdict ×1, preferences ×3). Round 3 hints carried all three memories.

**Failure 2 — the monitor NARRATED unperformed writes on flash.** Rounds 2–3: one real tool call,
then prose claiming memory writes + a revision that never happened (all memory still carried round-1
evidence ids). Same class as the orchestrator's measured chain-abandonment, now with fabrication.
Fixes: `MONITOR_MODEL` (defaults to the orchestrator tier; the monitor's live task — dual lists + N
writes + verdict — is a long chain), max_iters 12 for it, eval runs the monitor on the same tier
(eval-live parity), and `output.toolAttempts` is now persisted on every lane run so a narrated-but-
not-executed call is visible in the row itself, not just a live debugger.

Also: pytest no longer network-dependent (fetch_decisions stubbed in fixtures — the running dev
server had silently added hypothesis payloads to test assertions). pytest 44/44; monitor eval 2/2×2
green on the live tier.

## 2026-07-11 — 团队记忆 surfaced in the merchant UI

The learning loop was DB-only — a judge (or merchant) had no way to SEE it. Two additions:

- **团队记忆 card** on /merchant/agents (between 团队成员 and 最近运行): live non-expired memory rows
  with kind chips (实测结论/校准/本轮结论/商家偏好), the claim, confidence, and the code-computed
  prediction deviation (预测偏差 ×3.5). Backed by `listTeamMemoryAction` (service-role read, empty on
  pre-0032 DBs); refreshes during round polling so memory appears live as the monitor writes it.
- **Transcript describers** for the memory v2 + orchestration tools (record_action_outcome,
  record_round_verdict, search_memory, read_blackboard, get_campaign_outcomes, request_revision,
  dispatch_agent) — monitor/orchestrator runs now render as merchant sentences instead of raw tool
  names (写入记忆 / 要求修订 / 分派…), same pure-describer pattern, +4 tests.

Verified in the browser (production build): card shows the live 3.5× verdict and the merchant
preference. Ops note for the runbook: an orphaned `next-server` process was holding :3000 and serving
a stale in-memory build (fresh starts died on EADDRINUSE, page rendered unstyled with 404 chunks) —
`kill <pid from ss -ltnp>` then `next start`, and only rebuild after the port is actually free.

## 2026-07-11 — ADR-0016 Stage 1 complete: sandbox, briefs, executor autonomy — eval green

Five code commits (5ff3e73 → 760b7e8) + this verification pass:

- Eval rewritten for the v3 contract: `ad/no-brief-skip` (no brief → no spend), `ad/brief-infeasible-report`
  (target unreachable inside the budget ceiling → agent reports infeasible with forecast evidence,
  places nothing), `ad/retargeting-beats-broad` (broad fails the CAC ceiling in forecast; the agent
  finds try_on_no_booking itself — signature pins audience+style, budget stays its own choice),
  `decision/briefs-underexposed-ad` (facts+signals → ad brief for the underexposed earner, NO brief
  for the below-floor style). Briefs flow through the LIVE `_brief_context` formatter and ctx.briefs
  in eval, exactly as production.
- Grounding gate: prose abbreviations of grounded ids (style-8265 ⊂ style-melissa-img-8265) no longer
  count as hallucinations.
- record_action_outcome understands forecast-range hypotheses (midpoint of expectedCostPerBookingCents).
- TS: place_ad/forecast/update/pause/brief describers, new action types in merchant-home meta,
  business-facts summarizer counts signals. Seed fallbacks refreshed (decision v5, ad v2), re-seeded.
- **All 11 eval scenarios green at n=2 on gemini** (run in batches — one process now exceeds the
  10-minute shell cap with four strong-tier lanes). pytest 51/51, tsc clean, vitest 198/198.

BLOCKED on live verification: USER must apply 0033_ad_sandbox.sql, then rounds + advance-clock.

## 2026-07-11 — ADR-0016 Stage 2: decision environment, portfolio simulation, Risk Reviewer

- **Decision context injection** (`_decision_context`): mission + merchant policy snapshot (budget
  remaining vs committed, auto-execute limit, protected weekend, approval matrix) + capacity summary
  + top-5 candidate style index (signals only) injected deterministically — the agent chooses which
  candidates to inspect in depth via get_style_business_facts (two-stage, ADR-0014 rule).
- **simulate_action_portfolio** (decision-only, capability-gated like the brief sink): deterministic
  combined-plan checks — attribution conflicts (ad+coupon on one style: the live 8275 conflict class),
  budget competition vs the remaining envelope, capacity pressure. Warnings are evidence for the
  agent revising its own plan. pytest-pinned.
- **Risk Reviewer agent** (风控, strong tier): judges the brief PORTFOLIO for soft risk only (hard
  rules stay in code) — verdict tokens [APPROVED]/[APPROVED_WITH_CONDITIONS]/[REVISION_REQUIRED]/
  [MERCHANT_APPROVAL_REQUIRED]. Wired: CONTEXT_POLICY (reviewer sees decision; executors + monitor
  see reviewer), orchestrator default plan step 4 (skip executors on REVISION_REQUIRED; skip reviewer
  entirely when no briefs), dispatch budget 8→9, seed row + Decide→Review UI stage.
- Eval: `final_regex` gate (verdict token, zero side effects; zero tool calls legitimate — the
  reviewer judges injected briefs); grounding abbreviation check fixed to digit-tail matching
  (style-8265 → style-melissa-img-8265 is shorthand, not hallucination). Scenarios:
  `reviewer/conflicting-briefs-flagged` → REVISION_REQUIRED 2/2, `reviewer/clean-plan-approved` →
  APPROVED 2/2 (no invented objections). 13 scenarios total, all green on gemini.
- pytest 53/53; re-seeded (10 agents).

## 2026-07-12 — ADR-0016 Stage 3: coupon templates, message classes, merchandising verbs

- **团购 templates**: discounts come only from merchant-pre-approved templates
  (`COUPON_TEMPLATES` — 10%/15%/new-customer-12%); code computes the price and REFUSES it below the
  style's profit floor (`price_below_profit_floor`, floor=null → the style must not be discounted at
  all). The agent's judgment is the RESTRICTIONS: template, redemption window (weekends protected),
  coupon count, expiry. `get_coupon_constraints` shows per-template computed prices + floor clearance.
  No demand promises pre-publish — the monitor measures after. Coupon joined the strong tier
  (measured flash narration flake on the judge-then-call chain).
- **Message classes**: `send_customer_message` is dead as a tool. Transactional/product notices go
  through `send_automated_notification` (kind whitelist; code prefixes 【Nailed-it 商家助手】— the
  customer is never misled about authorship); relationship marketing goes through
  `create_merchant_message_draft` (status=proposed, awaiting the merchant's own edit+send). The
  boss-impersonation pattern is gone.
- **Merchandising verbs**: `delist_style`/`list_style` replaced by `deprioritize_style` /
  `feature_style` — exposure allocation changes, assets never removed by an agent (future trends
  return, old customers still ask; true stop-sale is merchant-only). `get_catalog_actions` returns
  `deprioritize[]` now.
- Eval: `coupon/template-restrictions` (weekday_10_off + weekday_afternoon, 2/2 — brief disambiguated
  so exactly one template fits: try-on prospects ≠ new-customer acquisition),
  `customer_ops/lapsed-rachel-draft` (win-back → DRAFT for Rachel, forbid auto-send, 2/2),
  `catalog/dead-8277-deprioritized` (2/2). 14 scenarios total.
- pytest 55/55 (template price computed by code, invented-discount + below-floor refusals, labeled
  notification + draft gate), vitest 238/238, tsc clean, re-seeded (coupon v2 / catalog v3 /
  customer_ops v4).

## 2026-07-12 — Live v3 proof on finals-a + the hard rules the live rounds forced

Migration 0033 applied → first live sandbox rounds. Three rounds on `finals-a` produced the doc-08
trace (rewritten from these runs; per-lane dumps in `docs/eval/live-v3/`, local). Every live failure
became a code rule the same day:

- **Wallet semantics** (`sandbox.committed_budget_cents`): committed = draft full ask + active
  unspent remainder; spent money is history; paused/ended commit nothing. The old sum-of-totals let
  finished history campaigns eat the whole ¥180 wallet (决策 rationally briefed "no ads" — round dead).
  Shared by `get_ad_account_state`, `simulate_action_portfolio`, `_decision_context`.
- **place_ad hard rules** (all refuse pre-side-effect): `budget_exceeds_wallet` (brief ceilings
  compete for ONE budget — measured: agent placed ¥160 against a ¥130 wallet, each placement
  in-brief), `campaign_exists_for_style` (a live campaign must be revised, never silently
  reconfigured), ended→fresh-run (version++, measured history archived to zero — the upsert used to
  resurrect ended campaigns with their old metrics), `no_ad_brief_filed`/`no_coupon_brief_filed`
  (executor dispatched with an EMPTY brief set must not spend — see narration entry below).
  `RunContext.briefs` became `list | None`: a list (even empty) means "dispatched under the briefs
  contract"; None = outside it (decision itself, revision re-runs, tests).
- **Strong-tier narration is real**: 决策 (gemini-2.5-pro) once produced a full prose plan claiming
  "已提交" ×3 with ZERO `submit_action_brief` calls; the ad lane then executed the prose as if it
  were law (only the wallet held). The no-brief refusals make that failure inert — the round degrades
  to named skips instead of prose-driven spend. Two more gemini modes measured: dead response
  mid-loop (runner's retry was keyed on accumulated text and never fired after any narration — now
  keyed on the CURRENT response) and a raw thinking leak as final text (monitor, one round; visible
  by construction via `toolAttempts`).
- **dispatch_many resilience**: per-lane isolation (one lane's crash no longer erases its siblings'
  completed results — pool.map used to throw everything away and send the orchestrator into blind
  retries that exhausted its iterations) + one retry on connection-class errors (a whole 4-lane batch
  died on `RemoteProtocolError` when the shared httpx pool handed stale sockets to parallel threads).
  Orchestrator max_iters 14→18.
- **Mission channel**: `pref-weekly-focus` merchant preference is lifted into
  `mission.merchant_weekly_focus` in 决策's injected environment — as a rankable memory hint the
  merchant's 拉新 goal lost to CAC anchoring in 2 of 3 rounds; as mission state it shaped the next
  round's brief (CAC ceiling 2000 → 4500, cited).
- **Seed coherence** (`seed:agent-history`): history campaigns are `ended` (finished runs hold no
  wallet commitments; keeping the healthy one active collided with fresh briefs — lifetime spend
  swallowed the new run's budget through update_ad_campaign); stale/legacy open campaigns are ended
  by the seed; 2 merchant preferences (团购底线 + 拉新重点).
- **The trace itself** (doc 08 §2): briefs→[APPROVED]→forecast loop→placement + an infeasible report
  (8274: all three audiences under the target floor, refused with numbers) → 72h delivery diverges
  (35 clicks on-forecast, CAC 1800 vs hypothesis 808–1211) → ad lane revises the SAME campaign to v8
  (audience switch, evidence-cited) → monitor writes 3 outcome memories incl. the 2× calibration miss
  and REFUSES a revision citing its bright lines → next 决策 cites the monitor's memory (mem id) in
  fresh briefs.
- Verification: pytest 61/61; affected eval scenarios re-run post-hardening (ad ×3, coupon, decision,
  reviewer ×2) — all gates green at n=2 (`docs/eval/live-v3/regression-post-hardrules.log`, local).

## 2026-07-12 — mission theater removed; weekly cron entry (the honest "Autopilot")

- **决策 injected environment simplified**: the hardcoded `mission.goal` string and
  `planning_horizon` are gone — the standing objective is the skill's job description, weekend
  protection already lives in `protected_periods`, and the planning window is in the task text.
  A synthetic goal string was structure theater; the one load-bearing field survives as top-level
  `merchant_weekly_focus` (read fresh each round from the merchant-owned `pref-weekly-focus`
  preference row; absent when the merchant set nothing). pytest 65/65; env live-verified.
- **Weekly cron implemented** (`agent-service/scripts/run-weekly-round.sh` + one crontab line,
  documented in the script header): a round reads all input from the DB at start, so a dumb cron
  is the whole scheduler. Monitor follow-up needs no second entry — matured actions (≥72h window)
  are pulled into the next round's due-review list; the weekly round naturally opens by measuring
  last week. Doc 08 gains the demo "rhythm line" saying exactly this on stage.

## 2026-07-13 — Model selection: gpt-5.6-terra chosen (screen + partial finalist); budget-out recorded

- **Selection**: `gpt-5.6-terra` as the strong-tier base; backup `gemini-3.1-pro`. Full judge-facing
  report in `docs/technical-documentation/09-模型选型报告.md` (Chinese).
- **Screen** (6 families × 7 judgment scenarios × n=3, ~$3.10): only terra and gemini-3.1 cleared the
  all-gates floor. terra 7/7 · 0 flake · $0.24 · 7.0s/run · 10.8k completion tokens (acts, doesn't
  narrate); gemini-3.1 7/7 · 0 flake · $0.74 · 21.1s. qwen 6/7 (stability), incumbent gemini-2.5-pro
  6/7 / 9.5% flake (reproduced its live rate), claude-sonnet-5 4/7 / 19% (BFCL-top ≠ our CN scenarios),
  deepseek 4/7 / 14%. Cost cross-checked per-call vs OpenRouter ledger within 8%.
- **Judge pass** (cross-family panel, non-blocking): terra process 4.44, gemini-3.1 3.86; both 合规率
  1.0. Family bias MEASURED and reported (gemini judge +0.39 on the gemini candidate). 幻觉率 column
  flagged as a trace-truncation artifact (deterministic grounding passed 42/42) — the eval criticizing
  itself, on record.
- **Finalist round** (full 14 × n=5 + judges on the two finalists): **budget ran out mid-run**.
  OpenRouter $20 credit exhausted (20.19 used, −0.19) after terra's 13/14 scenarios → terra's 14th +
  all of gemini-3.1 returned 402. Graceful (errors recorded, no crash, no overcharge). terra partial:
  12/14 gates green, ~3% flake, $0.82, 9.3s/run, process 3.95 — reinforces the pick; gemini-3.1's
  screen data stands on its own. No top-up: the screen already decided it.
- **Two honest engineering notes**: (1) a failed process-kill left two finalist jobs briefly
  double-spending, accelerating the credit drain — fixed via a single `scripts/run-finalist.sh` job;
  (2) I reassured the user "bounded ~$3-4" from lifetime usage without checking the $20 credit LIMIT,
  which had only ~$0.40 headroom — the loop was finite but the account wasn't. Both recorded in the
  report's honest-boundary section.
- Decision applied via the provider seam (env vars); live re-verification on terra pending (eval-live
  parity). Doc: 09-模型选型报告.md; methodology frozen pre-run in doc 06.

## 2026-07-14 — Eval batch-2: anchored judges, insight scenarios, architecture ablation (audit response)

External audit of the eval framework verified against code — 9/10 findings confirmed, all fixed or
measured today. `agent-service/eval/agents_eval.py`, `model_screen.py`, tests 76 passing.

- **Anchored 0/1/2 scale everywhere a judge scores** (was 1–5): 0 = unmet with citable
  counter-example, 1 = partial, 2 = met. Per-dimension MEDIANS kept in reports (dims were requested
  then dropped — only `overall` survived); panel total = sum of dim medians (process 0–10, safety/UX
  0–8). Ordinal data never averaged. Pre-change 1–5 numbers superseded; old JSONs kept for audit.
- **quality_judge → ux_judge**: output-only judge now scores UX only (清晰结构/中文自然/可执行性/
  术语控制) and is forbidden from judging accuracy — an output-only referee calling grounded numbers
  臆造 was the measured 幻觉率 instrument artifact. Accuracy = grounding gate + trace-aware process judge.
- **Near-full judge traces**: tool outputs up to 2500 chars with explicit […截断] markers (was silent
  [:300]); rubric rule: a claim whose source may sit behind a marker is not hallucinated. 幻觉率
  re-measured post-fix.
- **Judge findings enter 问题闭环**: majority-voted hallucination/safety violation or low process
  total now seeds regressions.jsonl (categories process/safety) — previously computed after the
  regression write and lost.
- **Insight (数分) scenarios ×3** (lane had zero): repeat-anomaly-checks-memory (canned memory rows
  via new Scenario.memory + stubbed bus.fetch_memory), first-anomaly-no-history-claim, small-sample-
  hedged. New expectation extensions: must_call, final_forbid_regex; signatures sign judged booleans.
  First live run caught a scenario bug — forbid regex hit the hedge "是首次还是重复出现" (negation-
  blind); fixed with lookbehind exemptions, pinned in regressions.jsonl. Suite now 17 scenarios.
- **Architecture ablation** (`--ablation`): 3 mono-agent scenarios mirror measured multi-agent
  endpoints (full-capacity no-spend / underexposed-ad targeting / conflict double-spend). Mono gets
  union tools + condensed SAME business rules — failures measure architecture, not starved prompts.
- **model_screen --only/--tag**: screen extensions (insight, monitor×2+orchestrator×2 on both
  finalists × n=3) write matrix-<tag>.md without overwriting frozen screen rows; --only without --tag
  refuses to run.
- Docs: doc 06 corrected (frozen subset composition decision×1/ad×3/reviewer×2/coupon×1 — monitor was
  NOT in the screen subset, now stated plainly + extension results), new insight/ablation sections,
  scale-change record. New `docs/presentation/eval-slide-spec.md` defines the single eval slide (4
  blocks + do-NOT-show list) vs technical-doc landing points.

## 2026-07-14 (cont.) — Light-tier read-lane screen + discriminating scenarios + eval slide

- **3 discriminating read-lane scenarios** (`agent-service/eval/agents_eval.py`): customer_ops/
  optout-respected (negative constraint from a visible roster field), customer_ops/aftercare-is-
  transactional (message-class routing: aftercare auto-sends, never a draft), trend/history-conflict-
  downgrades (read memory → downgrade amplify→price_test). Suite now 20 scenarios. Sanity-checked on
  terra (all fair — strong model passes).
- **search_memory clamp fix** (`nailed_agents/tools.py`): a `limit>10` raised `limit_too_large` while
  the code's own `min(...,10)` intended to clamp — a read-count over-ask now clamps to 10 instead of
  erroring (surfaced by terra passing limit=20 in the new trend scenario). 76 tests still green.
- **Light-tier screen** (`model_screen.py` gained gemini-2.5-flash / qwen3.6-flash candidates):
  gemini-2.5-flash on 9 read lanes × n3 = **7/9 green, 7.4% flake, $0.04, 3.6s** — passes all 3 new
  discriminating scenarios, fails on small-sample hedging (over-claims) + win-back routing (unstable).
  Measured tiering: cheap tier adequate for straightforward reads, risky on nuanced merchant-facing
  calls. `docs/eval/model-matrix/matrix-light.md`.
- **Eval slide** (`docs/presentation/projects/nailedit-eval-slide_20260714/`): single dark-template
  slide rebuilt to two hero tables (six-family selection + judge layer) per merchant-clear feedback —
  columns renamed to plain Chinese (通过门/抖动率/成本/耗时, 推理质量/裁判偏差), 判语 column dropped,
  hallucination/compliance demoted to a footnote (identical across models → no selection value),
  architecture-ablation cut from the slide (weakest data, kept in doc/verbal), scenario inventory (20)
  shown. Exported via ppt-master svg_to_pptx (native-SVG pptx). Preview verified, no overflow.

## 2026-07-14 (cont.) — Demo run-lineage symmetry + round labels + unified approval gate

- **Executor → Monitor downstream** (`src/domain/agents.ts` `deriveRunDetail`): an operator run now
  resolves `reviewedBy` = its round's Monitor (the inverse of the monitor's 监测对象), so the graph is
  symmetric — 商分 ↓ 投广 ↓ Monitor ↺ 商分(next round). Rendered as 下游监测 → Monitor Agent on both the
  run sheet and the full run page. Fixes "投广/团购 has no 下游".
- **经营轮次 label** (`deriveRunDetail.round`): each run in a FULL round (≥ `FULL_ROUND_MIN_RUNS`) carries
  its ordinal (newest = highest), the round's trigger source, and opener time — shown as
  「第 N 轮 · 手动/事件/定时 · 时间」 in the run eyebrow. Partial/alarm rounds carry no tag (correct: a
  5-run threshold_alarm round with 0 operators shows neither 监测对象 nor a round tag). +6 domain tests.
- **今日经营 stat strip**: removed the ambiguous bare `+3%` delta on 本周营收 (no baseline shown); dropped
  the now-dead `.statUp` render branch + CSS.
- **门店资料 title** back to black (kept 28px + left-align); 美甲师状态 stays brand pink.
- **`awaiting_approval` is now derived, not a per-tool flag** (`nailed_agents/tools.py`): the run-level
  merchant gate (ADR-0007 §4) is computed from the transcript — true iff the run wrote any
  status='proposed' action. Previously only `propose_listing` + `create_merchant_message_draft` set the
  flag, so 团购 drafts and over-budget ad drafts (both status='proposed') silently finalized as
  `completed` instead of `awaiting_approval`. Removed the two manual sets; +3 regressions (94 green).

## 2026-07-14 (cont.) — Reviewer removed, read_blackboard removed, customer_ops auto-sends

- **Reviewer lane deleted; deterministic portfolio gate replaces it** (`orchestrator.py`): the LLM
  风控 verdict is gone. Spend lanes (ad/coupon) now block only on the one portfolio-level risk a single
  executor can't see — the same style briefed for BOTH ad and coupon (`blocked_by_portfolio:
  attribution_conflict`). Wallet over-commit, one-campaign-per-style, and brief-law already enforce the
  rest at the tool layer, so removing the fail-closed reviewer gate opened no spend hole. Removed from
  lanes / CONTEXT_POLICY / dispatch / config (`REVIEWER_MODEL`, budget 9→8) / skills / eval scenarios;
  the 3 reviewer runs + the agent row deleted from the DB, blackboards stripped. Gate regressions
  rewritten to the new contract.
- **`read_blackboard` tool removed** (`tools.py`): 1 call across 77 stored runs — redundant with the
  deterministic `CONTEXT_POLICY` injection (决策 sees insight+trend; monitor sees decision). Dropped the
  tool + registration + decision/monitor allowlists. The blackboard STATE (persisted to agent_rounds,
  carries briefs/executions for the UI lineage) stays.
- **customer_ops auto-sends relationship messages** (ADR-0016 Stage 3 reversed): `create_merchant_
  message_draft` → `send_relationship_message`, which sends directly (applied `send_customer_message`),
  always labeled 【Nailed-it 商家助手】 (never impersonating the boss). Opt-out kept as the hard red line
  — an opted-out customer is never messaged. Skill/seed/eval/transcript-describer updated; the merchant
  gate for this path is gone (autonomous send, no `awaiting_approval`). Demo drafts converted to genuine
  sent messages so 最近完成 shows 用户运营 activity with the reasoning chain + full message body.
- **`返回消息列表`** button → full-width pink (`button-primary button-block`), matching 返回团队.

## 2026-07-14 (cont.) — 数分 Analysis Brief → 决策 candidate facts (search-space narrowing)

- **数分 emits a structured Analysis Brief** (`submit_analysis_brief`, insight-only via `analysis_sink`):
  `{focus_style_ids, alerts:[{type,style_id,evidence}], evidence_gaps, memory_check_recommended}`. Screens
  the full store (38 styles) DOWN to the handful worth 决策's reasoning — replaces free-text handoff.
- **决策 fetches candidate facts, not all** (`get_candidate_business_facts(style_ids)`): the preferred
  first read returns facts for only the analyst's focus styles; `get_style_business_facts` (all) stays as
  the escape hatch when the brief has `evidence_gaps` or the candidates come up short. So 决策 no longer
  reads all 38 styles every round, and doesn't blindly trust the analyst's prose — it pulls deterministic
  facts for the candidates.
- Orchestrator wires `analysis_sink` for insight + injects the brief into 决策 via `_analysis_context`
  (same formatter the eval uses). Skills updated (insight files the brief as its final step; decision
  reads candidates first). Eval: decision scenario now carries a real Analysis Brief; harness wires the
  sink so insight scenarios can file it. +4 unit tests (101 green). Frontend describers added.

## 2026-07-14 (cont.) — customer_ops lineage + roster describer fix

- **customer_ops now parents to the orchestrator, not insight**: it reads its OWN customer roster
  (get_customer_intelligence) to pick who to re-engage — it does NOT consume 数分's style analysis, so
  showing 数分 as its 上游 was a misleading lineage. It's an independent 老客召回 lane dispatched by the
  lead. Default plan updated (parent=""); the 3 demo runs re-parented to their round's orchestrator run.
- **Roster describer reworded**: "读取 48 位重点客户画像" → "浏览客户名册（48 位，最久未到店优先），从中
  挑本轮值得联系的人" — the agent scans the full roster and contacts ONE (skill: ≤1 relationship msg/round),
  so the old wording made 48 look like targets.

## 2026-07-14 (cont.) — 数分 screens users too → 用户运营 messages each candidate

- **数分 becomes the candidate-screening hub for BOTH sides**: `submit_analysis_brief` gains a
  `focus_customers_json` section `[{name, reason}]` — the top re-engagement candidates screened from the
  48-customer roster (most-lapsed / best preference-match), opt-out excluded. 数分 now also holds
  `get_customer_intelligence`. So 决策 gets candidate styles, 用户运营 gets candidate customers — symmetric.
- **用户运营 consumes the customer shortlist** and sends ONE personalized message per non-opted-out
  candidate (no arbitrary ≤1/round cap — the analyst's screening is the bound). Injected via
  `_customer_brief_context` (same formatter the eval uses). customer_ops re-parented to insight (the link
  is now a REAL dependency, resolving the earlier "数分 as 上游 is misaligned" complaint by making it
  aligned rather than cutting it). Runtime + orchestrator.md both dispatch it under insight.
- Opt-out stays the hard red line — customer_ops re-checks the roster and skips opted-out candidates even
  if the analyst's list names them. Eval: lapsed-rachel-sent + optout-respected now carry a focus_customers
  brief; harness injects it. +tests (python 105 green, tsc clean).

## 2026-07-14 (cont.) — AI customer messages mirror into the chat thread + monitor de-English

- **`bus.deliver_customer_message`**: after an AI send (send_relationship_message / send_automated_
  notification) writes its agent_action, it now also drops the message into the customer's chat thread
  (conversation_threads → messages, author_role='merchant', body carries the 商家助手 label). Best-effort:
  the agent_action stays authoritative; a missing thread or write error logs and never fails the send. So
  the merchant actually sees the AI-sent message in the conversation window, not only the action log.
- **Message describer**: '以老板身份给 X 发送' → '向 X 发送（AI 署名）' (messages are AI-labeled, never
  impersonate the boss); action describer returns the FULL body, and the run sheet clamps it to 2 lines
  with a 查看更多/收起 toggle. Sheet lineage header 上下游 → 上下游 Agent.
- **Demo data**: 9 monitor runs' leaked English chain-of-thought rewritten to Chinese; the showcase
  round's Amy + Rachel win-backs seeded into their chat threads.

## 2026-07-14 (cont.) — 团购 hard constraints injected, not a tool call

- **`get_coupon_constraints` tool → injected `[团购硬约束]`**: the coupon guardrails (pre-approved
  templates + computed prices + profit floor + redemption windows) are a deterministic per-style read the
  lane always needs, and the style is already fixed by the Action Brief — so the runtime computes them
  (`tools.coupon_constraints`) and injects them alongside the brief (`_coupon_constraints_context`),
  instead of the agent spending a tool call. Same principle as the Action/Analysis Briefs. The HARD guard
  is unchanged: `set_group_buy_coupon` still refuses unknown templates + below-floor prices. Dropped the
  tool from the coupon lane + registry + mono-ablation union; eval harness injects the constraints; skill
  updated. python 105 green.

## 2026-07-14 (cont.) — P0 cross-round idempotency (no duplicate follow-up rounds / event storm)

Audit found: `fetch_due_actions` kept returning already-measured actions, so evidence_matured could
re-fire a monitor round for the same action every cron tick; a threshold_alarm that stayed red could
re-fire indefinitely; and nothing stopped cron + the manual button from running overlapping rounds.
Three P0 defenses, none needing a migration:

- **Idempotency key (evidence)**: `fetch_due_actions` now excludes actions the monitor already recorded
  an `action_outcome` for (`bus.evaluated_action_ids` — agent_memory kind='action_outcome', key=action_id).
  A revision creates a NEW action id, so a genuinely re-run action is correctly still due. Verified live:
  evaluated=14, due=5, overlap=0.
- **Trigger fingerprint + cooldown**: fingerprint = `kind:entity` (`bus.trigger_fingerprint`). Each
  triggered round stamps it into `agent_rounds.blackboard.triggerFingerprint`, so **the round row IS the
  cooldown record** — no new table. `check_triggers` drops any signal whose fingerprint fired a round
  within `config.TRIGGER_COOLDOWN_MINUTES` (default 180). Fail-open on read error (never swallow a real alarm).
- **One round per merchant**: `bus.has_active_round` (unfinished round started within 15 min — older =
  crash-zombie, so the guard can't wedge), checked at the single `run_round` entry AND in `check_triggers`.
  **Best-effort, not a DB lock** — a small check-then-insert race remains; a partial unique index /
  advisory lock is the production hardening.

Honest claim for the defense: *the single-round execution graph is bounded and non-recursive; cross-round
triggers are de-duplicated by an idempotency key + cooldown; concurrent rounds are guarded best-effort.*
+5 regressions (python 110 green).
