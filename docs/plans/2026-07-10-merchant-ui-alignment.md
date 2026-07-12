# Merchant UI alignment + agent-team visualization (design doc)

Date: 2026-07-10 · Status: approved for implementation · LOCAL (docs/plans is never committed)

## Problem

The new merchant surfaces (今日 home, 团购管理, agent team page, run detail, AI inline cards) were built
feature-first and diverged from the app's established design system. Live-screenshot + code audit evidence:

1. **Raw JSON to merchants.** The run detail 思考链 renders the entire brain output as one JSON wall
   (`AgentRunDetailClient.tsx:223`, `AgentRunSheet.tsx:139` — `JSON.stringify(input) → JSON.stringify(output)`
   at 12px). Screenshot: `scratchpad/ui/run-detail.png`. A merchant cannot read
   `{"errors":[],"capacity":{"band":"very_idle"...` — this is developer exhaust, not a thinking path.
2. **Type-scale anarchy.** New surfaces invented their own sizes instead of using the tokens
   (`--text-xs/sm/base/md/lg`): TodayHome lane headers 0.8125rem/800; pin & card titles 0.84rem;
   meta at 0.6875/0.65/0.625/0.6rem; AgentRunSheet lanes 0.6875rem; groupbuy tags 0.68rem,
   accordion chevrons 0.6rem (9.6px). Sub-12px text everywhere. Meanwhile the polished pages sit on the
   token scale exactly.
3. **Three navigation dialects for one concept.** Same agent run: bottom sheet from 今日, full route from
   团队, nothing from 团购管理 (an AI proposal shows no path to its reasoning). Back affordances differ
   per surface: `.detail-back-link` "← ..." (standard) vs groupbuy's pill "返回" button (hardcoded Chinese,
   ignores the language prop) vs run detail's bottom-only "返回团队" button.
4. **Duplicate/stale AI rows.** Manage page AI card lists one row per historical action for the *same*
   entity ("已为 …a-img-8284 设置团购券" ×4, truncated ids). `listAgentActionsAction` has no dedupe;
   `AgentActionInline` renders all.
5. **Wiring gaps.** Stat strip "—", stuck 加载中 loaders (今日 lanes, 管理 货币单位, 投广中心), fake
   purchase/redemption counts (ZERO_META), `withdrawStyleAdCampaignAction` not reachable from the ads UI.
   (Full list in the wiring audit — folded into Part C as findings arrive.)

## Canonical system (what "aligned" means — from the polished pages)

- **Type**: `--text-xs` 12px (micro labels, chips) · `--text-sm` 14px (body, card titles in dense lists)
  · `--text-base` 16px · `--text-md` 18px (card/section titles) · `--text-lg` 22px (page subtitle)
  · `.page-heading h1` 1.5rem. **Nothing below 12px.**
- **Section label (dense ops screens)**: `.manage-section-heading` — 12px / 600 / uppercase / muted /
  border-bottom. Already the pattern on the manage page; 今日 lanes and sheet lanes adopt it. This also
  answers the "需要关注 visual weight" complaint: the label goes quiet, the cards carry the weight.
- **Cards**: `--radius-md`, `1px solid --color-border`, `--color-surface-strong`, `--shadow-soft`.
- **Pills**: `--radius-pill`, soft bg + ink-token text (`--color-accent-soft`+`--color-accent-ink` etc).
- **Back**: `.detail-back-link` at the TOP of the page/panel, `← {label}`, i18n'd.
- **States**: `.loading-state`/`.empty-state`/`.toast` components; errors in `--color-danger`.

## Part A — Align the new surfaces (fonts / shapes / nav)

- **TodayHome.module.css**: lane headers → manage-section-heading treatment; pin/card titles →
  `--text-sm`; all 0.6xxx rem meta → `--text-xs`; chips stay pills but at 12px; stat labels 12px.
- **AgentRunSheet.module.css**: `.lane` → same section-label treatment; statusChip → 12px.
- **Groupbuy (globals.css + components)**: replace hardcoded 0.82/0.68/0.6rem with `--text-sm`/`--text-xs`;
  wizard topbar `rgba(255,248,247,.94)` → `var(--color-bg)`; back buttons → `.detail-back-link` "←" +
  i18n via existing `language` prop; status pills on token colors; chevrons ≥ 12px.
- **Run detail page**: back link moves to top (`.detail-back-link`), keeps page pattern; hero stays.
- **AgentActionInline**: dedupe to the latest action per entity (`entityId` else `payload.styleId`);
  row text uses the shared describer (below); each row links to its run's reasoning.

## Part B — Agent-team & transcript rendering (Multica patterns, adapted)

Multica reference (local `/home/tough/multica`): colored type badges per step (thinking=violet,
tool=blue, output=emerald, error=red), collapsible event rows with human summary + expandable raw
detail (`agent-transcript-dialog.tsx`), presence dots (green working / gray idle), avatar stack + pulse
dot for ambient status, status tones (running=info, completed=success, failed=danger).

Adaptation for a non-technical merchant on mobile:

1. **`src/domain/agent-transcript.ts`** (pure, tested):
   - `describeToolCall(tool, input, output, lang)` → `{ label, summary, detail }`. Per-tool
     summarizers turn I/O into one Chinese sentence with the numbers that matter:
     - `get_style_business_decisions` → "决策大脑 · 18 款分析：投广候选 3 · 团购 1 · 产能 33%"
     - `place_ad` → "创建广告 · 款式 8274 · 日预算 SGD 200（草稿，待启动）"
     - `set_group_buy_coupon` → "创建团购草稿 · 券后 SGD 70.4"
     - `get_merchant_insights` → briefing headline; trend/customer tools → counts.
     - Unknown tool → label = tool name, summary = compact key facts, raw JSON only in `detail`.
   - `describeAction(type, payload, lang)` → human sentence (kills `JSON.stringify(payload)` rows).
   - `actionEntityHref(action)` → deep link to 团购管理 / 投广中心 for entity-bearing actions.
   - `stepTone(kind)` → `thinking | tool | action` tone mapping.
2. **`TranscriptChain.tsx`** (shared component): one renderer for BOTH the 今日 bottom sheet and the
   full run page — kills the two-dialects problem. Row = tone-colored type pill + human summary;
   `<details>` "查看数据" reveals the raw payload (mono, 12px, max-height, scroll) for the curious.
   No raw JSON outside `<details>`.
3. **Team page**: agent cards gain a presence dot (green pulse = has a `running` run, gray = idle) and a
   "last run" line (status tone + relative time), tying 团队成员 to 最近运行. Run rows keep the
   existing status pill classes (already tone-mapped in globals).

## Part C — Wiring (from the wiring audit; fix the demo-blocking tier now)

- AI card dedupe + reasoning links (A above).
- Fold in the wiring agent's findings: stuck loaders with a real error/empty state instead of forever-
  加载中; dead controls either wired or removed (backend-honest rule, ADR-0011).
- Known open (next PR if big): 投广中心 pause/stop button on `withdrawStyleAdCampaignAction`; groupbuy
  purchase/redemption real counts; GroupbuyPanel URL-backed navigation (mode-switch today — browser
  back/refresh lose context; acceptable for demo, documented as debt).

## Non-goals (this pass)

- No rebuild of GroupbuyPanel onto URL routes (debt, noted).
- No Multica timeline scrubber bar (overkill at ~6 steps/run).
- No avatar image system — agents keep text identity + role chip + dot.

## Verification

- Unit: describer table tests (per tool, per action type, fallback, EN+ZH).
- tsc + full suite baseline (24 failed pre-existing / 529 passed).
- Re-screenshot 今日 / 管理 / 团队 / run detail at 390×844; run detail must show zero raw JSON
  outside <details>.

## Journey-walk findings (2026-07-10, merchant-PM pass, 390×844 screenshots)

Method: production build on :3005, walked 今日 → 团队 → run detail → 团购管理 → 广告中心 with screenshots
per step. Golden criteria: match the polished pages' UIUX.

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Run detail chain had NO task context — starts mid-air, no upstream/downstream on the page (only in the sheet) | high | FIXED — hero shows 任务来源 (由「决策 Agent」的结论触发) + ↑/↓ lineage chips via deriveRunDetail |
| 2 | Chain said the same act 3× (tool_call + action step + trailing reasoning) | high | FIXED — condenseTranscript drops action steps that restate the preceding tool_call |
| 3 | Machine ids everywhere ("款式 8284", "下架 · sty…", "…a-img-8284") though styles have real names | high | FIXED — getStyleTitleMapAction + titles threaded through describers, 今日 feed, sheet, run page, inline cards |
| 4 | "← 返回" back button wraps into two lines (团购 topbar) | high | FIXED — white-space nowrap + flex-shrink 0 |
| 5 | Currency renders "$328.00"/"$0" in 广告中心/今日 but "SGD" everywhere else | med | FIXED — SGD convention in both money helpers |
| 6 | 广告中心 row titles nowrap-ellipsis swallowed the AI 建议 badge; 为什么? broke mid-word | med | FIXED — 2-line clamp titles; nowrap on the why-link |
| 7 | 团购 AI 建议 line clamped at 2 lines cut the coupon price ("券后 SG…") | med | FIXED — 3-line clamp |
| 8 | 最近运行 = endless undifferentiated dump (42 runs, no grouping) | med | FIXED — capped at 9 + 显示全部 N 条 toggle |
| 9 | Team page = flat 9-card grid, no hierarchy, loop caption didn't match the PM architecture | high | FIXED — three-lane layout (款式/用户/预约运营) with 数据收集→商业决策→动作→监测 stages, orchestrator on top, 预约运营 marked 规划中 |
| 10 | Bare-text loading lines (团队 page, run detail) instead of the standard LoadingState | low | FIXED |
| 11 | Python action summaries truncated prices (`:.0f`: 券后 70.4 → "70") | med | FIXED (`:g`) |
| 12 | 需要关注 shows 26 pending approvals (data pileup from repeated demo rounds) | low | OPEN — data hygiene: old proposed actions should expire or be batch-rejected; needs a policy decision |
| 13 | Trailing LLM 推理 step still contains raw ids/markdown (** and backticks) — it is the model's own text | low | OPEN — fixable by telling the skill to write merchant-facing summaries; do not rewrite model output in UI |
| 14 | Dev-mode route compiles made every first navigation feel broken (8s+ spinners); production build is instant | note | Demo runbook: use `next build && next start` |

## Multica adoption decision (recorded)

Taken from Multica frontend (patterns re-implemented, no code copied): tone-pill transcript rows with
collapsible raw detail, presence dots (green pulse = live), status color conventions, capped run list.
Kept ours: upstream/downstream lineage (Multica has no run-to-run dispatch links), three-lane business
structure (PM architecture), bottom-sheet drill-down. NOT copying Multica backend: ADR-0007 already
rejected porting its daemon/runtime — it runs coding-agent subprocesses over local repos; our Python
service already implements the same pattern (agents-as-data, targeted runs, transcript→dashboard) on the
Supabase bus. New agent behavior continues to land in Python (agent-service/), per the working convention.
