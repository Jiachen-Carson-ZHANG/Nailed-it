---
name: Nailed-it
description: Soft-tech nail booking system with social browsing energy and operational clarity.
colors:
  accent-pink: "#ec5d7b"
  accent-pink-strong: "#c73963"
  accent-pink-soft: "#ffe4eb"
  landing-purple: "#696fc7"
  landing-lavender: "#d8c7fa"
  landing-light-purple: "#a7aae1"
  landing-blue: "#a8d8ea"
  landing-cream: "#fff8de"
  surface-base: "#fff8f7"
  surface-strong: "#ffffff"
  text-ink: "#24181f"
  text-muted: "#6c5a65"
  border-soft: "#2e1f2b14"
  success: "#2e8b6c"
  warning: "#d97706"
  danger: "#b91c1c"
typography:
  display:
    fontFamily: "\"Source Han Serif SC\", \"Songti SC\", \"STSong\", serif"
    fontSize: "clamp(2.4rem, 4.1vw, 4.4rem)"
    fontWeight: 800
    lineHeight: 1.08
  headline:
    fontFamily: "\"Source Han Serif SC\", \"Songti SC\", \"STSong\", serif"
    fontSize: "clamp(2rem, 3vw, 3rem)"
    fontWeight: 800
    lineHeight: 1.05
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "normal"
rounded:
  sm: "4px"
  md: "8px"
  lg: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  hero: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent-pink}"
    textColor: "{colors.surface-strong}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.text-ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-ghost:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.accent-pink-strong}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  chip-default:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "36px"
  chip-selected:
    backgroundColor: "{colors.accent-pink-soft}"
    textColor: "{colors.accent-pink-strong}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "36px"
  card-default:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.text-ink}"
    rounded: "{rounded.md}"
    padding: "16px"
  landing-cta-pill:
    backgroundColor: "{colors.landing-cream}"
    textColor: "{colors.landing-purple}"
    rounded: "{rounded.pill}"
    padding: "0 32px"
    height: "56px"
  solution-tab-cart:
    backgroundColor: "{colors.accent-pink}"
    textColor: "{colors.landing-cream}"
    rounded: "{rounded.pill}"
    padding: "12px 22px"
    height: "62px"
  agent-card:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.text-ink}"
    rounded: "{rounded.md}"
    padding: "13px"
    state: "color left-stripe + labelled chip (current); chip-only migration in backlog"
  kpi-tile-accent:
    backgroundColor: "{colors.accent-pink}"
    textColor: "{colors.surface-strong}"
    rounded: "{rounded.md}"
    padding: "12px"
  kpi-tile:
    backgroundColor: "{colors.surface-base}"
    textColor: "{colors.text-ink}"
    rounded: "{rounded.md}"
    padding: "12px"
  chip-state-proposed:
    backgroundColor: "#fdecd2"
    textColor: "{colors.warning}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  chip-state-applied:
    backgroundColor: "#e4f3ec"
    textColor: "{colors.success}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  stat-strip:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.text-ink}"
    rounded: "{rounded.md}"
    divider: "1px solid {colors.border-soft}"
    padding: "9px 12px per cell"
  technician-card:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.text-ink}"
    rounded: "{rounded.md}"
    padding: "11px"
    avatar: "26px circle · accent-pink-soft bg / accent-pink-strong text"
  tab-active:
    backgroundColor: "{colors.accent-pink-soft}"
    textColor: "{colors.accent-pink-strong}"
    rounded: "{rounded.md}"
---

# Design System: Nailed-it

## Overview

**Creative North Star: "The Soft-Tech Beauty Console"**

Nailed-it should feel like a beauty-native product that understands both browsing desire and booking logistics. The visual system pairs airy, pastel social-discovery cues with enough structure to support pricing, scheduling, and merchant operations. It should feel young, feminine, and confident, but not sugary, toy-like, or vague.

The system works in two related modes. The product shell uses soft pink surfaces, warm white cards, and crisp dark ink to keep flows readable and trustworthy. The landing and storytelling surfaces are allowed to go further with lavender, cream, sky blue, and serif display typography so the brand can feel more expressive without losing clarity.

This system explicitly rejects generic enterprise dashboard stiffness, dark cyberpunk AI theatrics, and blunt beauty-commerce templates. It also rejects loud neon gradients, glass-heavy AI gloss, and overly cute decoration that would undercut trust in quotes, availability, or merchant workflow.

**Key Characteristics:**
- Pastel color is used as product voice, not as decoration alone.
- Operational screens stay calm and legible, even when the brand gets softer and more expressive.
- Display moments use serif drama, while utility moments return to a modern sans rhythm.
- Social-browsing energy should lead users toward action, not trap them in inspiration-only loops.

## Colors

The palette combines operational blush neutrals with a brighter landing palette of lavender, cream, and sky blue, so the brand can move between product trust and inspiration-led storytelling without feeling like two separate products.

### Primary
- **Signal Pink** (`#ec5d7b`): The main product accent for CTAs, active states, badges, and emphasis moments where the interface needs a clear answer or next step.
- **Velvet Lavender** (`#696fc7`): The strongest brand field color on landing sections, display headlines, and narrative surfaces that need more emotional presence than the app shell.

### Secondary
- **Powder Sky** (`#a8d8ea`): Used in landing buttons, visual panels, and cool-side storytelling blocks where the system needs relief from pink-heavy surfaces.
- **Blush Wash** (`#ffe4eb`): Used for selected chips, supportive highlights, and soft feedback surfaces that should feel warm rather than alert-like.

### Tertiary
- **Butter Cream** (`#fff8de`): Used as a soft hero button fill, warm contrast against lavender, and a gentle high-key surface on the landing page.
- **Mist Lavender** (`#d8c7fa`): A supporting brand note for decorative sections and tertiary surface variation.

### Neutral
- **Petal White** (`#fff8f7`): The default app background. It keeps the product from feeling sterile while staying quiet enough for dense workflows.
- **Pure Surface** (`#ffffff`): Used for cards, dialogs, sheets, and readable form containers.
- **Ink Plum** (`#24181f`): Primary text and tooltip background. It anchors the palette and prevents the pastel system from drifting into low-trust softness.
- **Muted Mauve** (`#6c5a65`): Secondary text, helper copy, and lower-emphasis metadata.
- **Soft Border** (`rgba(46, 31, 43, 0.08)`): Hairline separation for cards, bars, and chips. Borders stay subtle and should not dominate the layout.

### Named Rules
**The Dual-Surface Rule.** Product surfaces default to blush neutrals plus pink emphasis. Landing surfaces may introduce lavender, cream, and sky blue when storytelling needs more identity, but app workflows should not become a rainbow patchwork.

**The Trust-Through-Ink Rule.** Whenever pastel backgrounds get lighter or more decorative, text must move toward Ink Plum or a similarly dark hue. Readability wins over softness.

## Typography

**Display Font:** Source Han Serif SC (with Songti SC / STSong fallback)  
**Body Font:** Inter (with Apple system sans fallbacks)  
**Label/Mono Font:** Inter

**Character:** Typography splits clearly by task. Display moments use a confident Chinese serif to create elegance and feminine authority on landing pages. Product flows return to Inter for faster scanning, cleaner controls, and predictable operational rhythm.

### Hierarchy
- **Display** (800, `clamp(2.4rem, 4.1vw, 4.4rem)`, 1.08): Reserved for landing hero statements and major section headlines that carry the brand voice.
- **Headline** (800, `clamp(2rem, 3vw, 3rem)`, 1.05): Used for feature blocks, problem cards, and large section titles where the brand still needs strong presence.
- **Title** (700, `1.75rem`, 1.2): Used for page titles, major cards, and dialog titles in the product shell.
- **Body** (400, `1rem`, 1.6): Default reading size for descriptions, metadata, helper copy, and multi-line product content. Keep long-form body copy near a 65-75ch reading width when the layout allows.
- **Label** (700, `0.75rem`, 1, normal): Used for chip labels, section eyebrows, compact CTA text, and utility markers. Labels can go uppercase sparingly, but not as a repeated scaffold on every section.

### Named Rules
**The Two-Mode Type Rule.** Serif is for persuasion and brand expression. Sans is for decisions and workflow. Do not let serif typography spill across dense booking, messaging, or management flows unless a very specific moment earns it.

## Elevation

This system uses a hybrid depth model: most product surfaces are flat in structure but softly lifted through blur, translucent fills, and diffuse shadows. Elevation should feel ambient rather than dramatic. Shadows are there to separate layers and signal tactility, not to simulate hard material depth.

### Shadow Vocabulary
- **Soft Surface** (`0 16px 40px rgba(74, 39, 55, 0.08)`): Default lift for cards, discovery heroes, and contained panels that need warmth without feeling heavy.
- **Raised Surface** (`0 8px 20px rgba(74, 39, 55, 0.12)`): Used for tighter elevated elements or hovered cards that need a little more separation.
- **Overlay Surface** (`0 24px 60px rgba(74, 39, 55, 0.18)`): Reserved for dialogs, large overlays, and floating surfaces that sit clearly above the page.
- **Landing Object Shadow** (`0 12px 30px rgba(236, 93, 123, 0.28)`): Used on accent objects like the brand mark where colored lift is part of the visual storytelling.

### Named Rules
**The Ambient Lift Rule.** Surfaces should appear cushioned and light, not sharply stacked. Prefer wide, soft shadows and translucent fills over dense black drop shadows.

## Components

### Buttons
- **Character:** Buttons are rounded, compact, and decisive. They should feel friendly enough for a beauty product, but firm enough for booking confirmation and merchant workflow.
- **Shape:** Default buttons use a medium radius (`8px`). Landing CTA buttons and tab pills can expand to full pill radius (`999px`) for a more expressive profile.
- **Primary:** Pink fill with white text, minimum height `44px`, standard horizontal padding `16px`. This is the default action button in product flows.
- **Hover / Focus:** Motion stays short and subtle. Product buttons shift through color/transform transitions around `120ms`; landing pills may lift by `1px`. Focus rings use a translucent plum outline rather than a browser-default blue.
- **Secondary / Ghost / Tertiary:** Secondary buttons use white fill with soft border and dark text. Ghost buttons stay transparent or near-transparent and inherit stronger accent text for dismissive or lightweight actions.

### Chips
- **Style:** Chips are pill-shaped (`999px`), white by default, softly bordered, and sized for fingertip use at `36px` minimum height.
- **State:** Selected chips switch to blush background with strong pink text. Disabled chips should keep their structure but drop energy through contrast and interaction state, not through total disappearance.

### Cards / Containers
- **Character:** Cards are soft containers, not dashboard bricks. They create trust and structure while keeping the system visually breathable.
- **Corner Style:** Standard cards use `8px` radius in product flows and may expand to `20px` or `34px`-ish radii in landing storytelling panels.
- **Background:** Cards default to pure white or slightly translucent warm white over the blush page background.
- **Shadow Strategy:** Most cards use the Soft Surface shadow. Narrative landing cards may use larger radii and quieter or no borders when section color already provides separation.
- **Border:** Borders are low-contrast and thin. Avoid high-contrast outlines unless communicating an active or selected state.
- **Internal Padding:** Most cards sit on the `16px` to `24px` spacing steps, with larger editorial landing panels extending beyond that.

### Inputs / Fields
- **Style:** Inputs should live on white or near-white surfaces with clear stroke definition and the same medium-radius geometry as buttons and cards.
- **Focus:** Focus feedback should rely on accent-tinted outlines, border shifts, or glow treatments that are visible without becoming loud.
- **Error / Disabled:** Error states should use the system danger red intentionally, while disabled states should lower contrast and interactivity without making the field illegible.

### Navigation
- **Top Bar:** The top bar is a sticky, translucent shell with a blurred blush background, low-contrast divider, and strong brand title weight.
- **Bottom Tab Bar:** Mobile navigation uses a four-column soft grid with active items highlighted through pale pink fill and stronger accent text rather than hard underlines.
- **Typography:** Navigation labels stay in the sans system, compact, and semibold for fast scanning.

### Overlays
- **Bottom Sheet:** Sheets are rounded only at the top, nearly opaque blush-white, and feel like a continuation of the app rather than a foreign layer.
- **Dialog:** Dialogs use pure white surfaces, overlay shadow, compact typography, and small corner radii to stay readable and focused.
- **Tooltip:** Tooltips invert into Ink Plum with white text for maximum contrast and clear hierarchy.

### Signature Component
- **Solution Tabs and Story Panels:** Landing feature tabs and solution panels are the clearest example of Nailed-it's expressive mode. They pair pill selectors with large serif headlines and full-color panel backgrounds. Use this pattern only for high-level storytelling or feature explanation, not for dense task flows.

## Do's and Don'ts

### Do:
- **Do** use `#ec5d7b` as the default action accent in product flows, with white text and medium-radius geometry.
- **Do** switch to `Source Han Serif SC` for brand headlines, hero statements, and storytelling sections that need feminine authority.
- **Do** keep operational screens grounded in `#fff8f7`, `#ffffff`, `#24181f`, and `#6c5a65` so pricing, messages, and calendars remain easy to scan.
- **Do** use pastel colors in roles, not at random. Lavender, cream, and sky blue should have a compositional reason.
- **Do** preserve reduced-motion support by collapsing decorative animation when `prefers-reduced-motion` is enabled.
- **Do** keep touch targets around `44px` tall in interactive product controls whenever possible.

### Don't:
- **Don't** make this feel like a generic enterprise dashboard. Avoid heavy grid severity, cold grayscale UI, and purely utilitarian admin styling.
- **Don't** turn the product into a dark cyberpunk AI tool. Avoid heavy black UI, neon glows, and aggressive futuristic gradients.
- **Don't** use a blunt beauty e-commerce template. The product is not just a catalog and checkout flow.
- **Don't** add glass-heavy AI gloss, decorative blur everywhere, or purple-on-black "AI" theatrics.
- **Don't** push the interface into overly cute decoration that weakens trust in quotes, time estimates, or merchant scheduling.
- **Don't** rely on color alone to explain booking states, AI confidence, or merchant actions.
- **Don't** let serif typography or full-color landing treatments bleed into dense management screens unless the moment is intentionally brand-led and still readable.

## Merchant Agent Home (今日 tab)

The merchant's first tab is an **operational agent-ops home**, not a calendar. It surfaces the AI operations team's work + salon live state. It is a **workflow** surface, so it lives fully in sans/blush mode per the Two-Mode Type and Dual-Surface rules. Concept + rationale: `docs/plans/2026-07-03-merchant-home-agent-feed.md`. Reference implementation: artifact `home-agent-feed-v2` (note: that mock drifted on accent hue/radius/fonts — canonical values below win).

### Layout (agent-first; single vertical scroll, bounded height)

The **agent feed is the main character**. The top is a light orientation header, not a hero dashboard — the earlier 3 KPI tiles were dropped because they duplicated the pin (待确认) and the schedule (今日预约); only 本周营收 was unique.

1. **Stat strip** — page title 今日 + a compact **3-cell strip** (one bordered container with dividers): `本周营收 ↑N%` · `今日 M 单` · `本周新客 +K`. Inter, tabular-nums, small. A *structured* mini-dashboard, not a floating text line (a loose line reads as a caption, not a component) — but kept lighter than the agent hero. Cells must not duplicate the pin (待确认) or the schedule roll; the third cell is a health metric surfaced nowhere else. New-salon fallback: absolute figure + "暂无对比" (see Open items).
2. **需要关注 (HERO)** — the visual focus of the page. Split by miss-tolerance:
   - **Pending pin** (`proposed`): full-width, amber state edge, pinned so a human-in-loop decision can't be missed. Usually 0–2; collapses to a count banner ("N 条待确认 →") if more.
   - **最近完成 roll** (`applied`): horizontal scroll, cards ~74% width, **fixed height regardless of count** (20 items never balloon the page).
   - **Calm state**: when the roll is empty, a dashed `surface-base` note "今日无新动作 · 团队监测中". No manufactured activity.
3. **今日 · 技师 roll** — one card per technician (see Technician card), horizontal so adding staff never bloats vertical space. This roll is the **single calendar entry**: tap a tech → their day; tap the header "完整日历 →" → full calendar.
4. **常驻入口 2×2** — `lcard` tiles: 款式图鉴(选品) · 周报 · AI团队 · 技师管理. No 日历 tile — the technician roll is the calendar entry, so a tile would be a second redundant path. 技师管理 belongs here now that technicians are first-class on the home (roll = status, tile = manage the team).

IA: bottom tabs stay 今日 / 管理 / 消息 / 我的 (tab 1 renamed 日历→今日). The full calendar has exactly one home entry — the technician roll.

### Technician card (今日 · 技师 roll)

- **Content:** avatar (initial/emoji) · name · status line · today's load.
- **Status states** (label-backed, never color alone; label is structured in the read model + formatted
  per-language in the UI — the domain emits no display strings):
  - **忙碌** — *currently inside* an appointment (interval `[start, start+duration)`), showing 接待中 · service.
  - **空闲** — free now, with 下一场 {time} · service if there's a later booking, else 今日已完成 / 当前空闲.
  - **下班 / 未排班** — off today; muted card. *Real (Phase 5):* a technician with no `workingPlan`
    covering today's weekday reads 今日未排班 — the scheduling kernel's plans, the same source the booking
    availability grid uses. Blocked-time (partial-window leave/training) stays in the full calendar.
- **Ordering:** busy (in an appointment now) → 空闲 → 下班.
- **Solo salon:** degrades to a single card (the owner). Never assume more than one technician.
- **Tap:** opens that technician's day in the calendar.

### Interaction states (every zone gets all five)

Never an infinite spinner — the live calendar shipped one, don't repeat it.

| Zone | Loading | Empty | Error | Partial |
|---|---|---|---|---|
| Stat strip | shimmer skeleton cells | new salon → absolute figure + "暂无对比" | "数据暂不可用" inline, keep the frame | cells load independently; a failed cell shows "—", not a broken row |
| Pending pin | renders from cache; skeleton if cold | no pin (nothing to decide) | a failed action is dropped + logged, never a broken card | — |
| Done-roll | 2–3 skeleton cards | dashed "今日无新动作 · 团队监测中" | "最近动作加载失败 · 重试" | show what loaded; omit a failed card |
| Tech-roll | avatar skeletons | "今日无排班" | "排班加载失败 · 重试" | per-tech; a tech whose bookings fail shows "—" load |
| Drill-down sheet | skeleton face + steps | n/a | "详情加载失败 · 重试" (sheet stays open) | render the face even if the transcript fails |

Rule: zones load and fail **independently** — one broken zone never blanks the page.

### First-run / empty account (the judge's first impression)

A brand-new merchant has no agent runs, no revenue history, maybe no technicians. Do **not** show four empty zones. Show a **"认识你的 AI 团队"** first-run state:
- Stat strip → absolute today numbers + "暂无对比" (no fake delta).
- 需要关注 → a warm intro card: "AI 团队已就位 · 今晚首次巡店后，动作会出现在这里" + a 了解团队 link.
- Tech-roll → if no technicians, a single "添加技师 →" card into 技师管理.
- Warmth + one primary action, never a bare "暂无数据".

### Accessibility

- **Touch targets ≥ 44px** on every control — the pin's 批准/拒绝/详情 buttons included (currently short; must grow).
- **Horizontal rolls:** *done (Phase 6)* — each roll is `role="group"` + `aria-label`; cards are native
  `<button>` / `<Link>` (keep their button/link role — an earlier `role="listitem"` on them was an
  anti-pattern that stripped it). Focusing a card scrolls it into view. Roving-tabindex was reconsidered
  and dropped: on a short roll of a handful of interactive cards, native tab order is simpler and doesn't
  hide cards from keyboard users. `:focus-visible` ring on every interactive card; `prefers-reduced-motion`
  drops the hover-lift.
- **Contrast:** *fixed (Phase 6).* `--color-muted #6c5a65` on white = 6.39:1 (stat labels already passed).
  The colored state chips were sub-AA at 10px bold (green `#2e8b6c`/`#e4f3ec` = 3.65:1, busy
  `#c73963`/`#ffe4eb` = 4.18:1, amber `#d97706`/`#fdecd2` = 2.75:1; accent link text `#ec5d7b` on white =
  3.27:1). Added three **ink tokens** to `globals.css` — `--color-success-ink #217a5c`,
  `--color-warning-ink #9a5b00`, `--color-accent-ink #b32e57` — the AA-safe text shades for a hue sitting
  as small text on its own soft tint (base success/warning/accent stay for fills/icons). Home chips now use
  them (≥4.5:1 on tint and on white); accent link text uses the existing `--color-accent-strong` (5.01:1).
  The ink tokens are a global primitive other screens can adopt; no existing screen's appearance changed.
  Sheet focus-trap/focus-on-open belongs to the shared `BottomSheet` and is left for a component-level pass.
- **Icons** carry `aria-label`; state + agent are also text, so an icon is never the sole signal.
- Reduced-motion already handled (Ambient Lift collapses).

### Icons — emoji now, line-icon set in backlog

**Current:** emoji icons (📣🛍💬🎯) — product kept the v5 look (2026-07-05).
**Backlog (before the semifinal):** one **1.5px line-icon set**, `currentColor`, 16–20px — agents (投广=megaphone, 团购=tag, 用户运营=chat, 决策=target, 数分=bars, 选品=spark, 监测=magnifier), tabs (home/wallet/mail/user), tiles (trend/report/team/scissors). One family, one weight. Reason: emoji read as unfinished to 美团 judges.

### Agent card

- **Container:** `agent-card` — white surface, `rounded.md` (8px), Soft Surface shadow, padding 13px.
- **State (current):** a state-tinted **color left-stripe** + a **labelled state chip** (待确认 / 已执行). Color is never the sole signal (the chip is labelled). *Backlog:* migrate to chip-only — the left-stripe matches AI-slop pattern #8; product kept the v5 look for the demo (2026-07-05).
- **Header row:** agent **icon** (emoji placeholder) + agent name label + state chip (right). *Backlog:* replace emoji with the line-icon set (see Icons).
- **Body:** action summary (title weight) + one-line 为什么 (body, muted).
- **Foot:** timestamp + "查看推理 →" (opens the drill-down sheet).

### Card states — color is always backed by label + icon (honors "not color alone")

| State | Color token | Label | Icon | Placement | Controls |
|---|---|---|---|---|---|
| `proposed` | warning `#d97706` | 待确认 | ⚠ | pinned pin | 批准 / 拒绝 / 详情 |
| `applied` | success `#2e8b6c` | 已执行 / 已发送 | ✓ | horizontal roll | see reversibility rule |
| `failed` | danger `#b91c1c` | 运行失败 | ✕ | **hidden from home**; full log only | 重试 |

### Agent identity — icon + name, NO unique hue

| Role | Name (zh) | Icon (placeholder) |
|---|---|---|
| lead 主控 | (invisible — authors the KPI dashboard) | — |
| analyst 数分 | 数据分析 | 📊 |
| planner 决策 | 决策助手 | 🎯 |
| operator 投广 | 投广助手 | 📣 |
| operator 团购 | 团购助手 | 🛍 |
| operator 用户运营 | 用户运营 | 💬 |
| operator 选品 | 选品助手 | ✨ |
| reviewer 监测 | 监测助手 | 🔍 |

Icons are placeholders for a consistent line-icon set. Color is never used to tell agents apart.

### Two-depth drill-down (reuses the existing Bottom Sheet) — *implemented, Phase 3 (`AgentRunSheet.tsx`)*

Opens the `Bottom Sheet` component (rounded-top, blush-white, Overlay shadow). Fed by
`getAgentRunDetailAction(runId)` → `deriveRunDetail` (pure lineage). Read-only: the batch controls stay on
the card's pin (single source of that optimistic state); the sheet is the "view" depth.
- **Depth 1 — 老板视角 (default):** agent + status chip · result headline (`output.headline`/`verdict`).
- **Depth 2 — 推理链路:** the transcript steps via the shared global `.agent-chain*` classes (matches the
  `/merchant/agents` run detail), distinguished by **label + tint, not color alone**:
  - **推理** reasoning — ink text, no fill
  - **工具** tool — warning-tint tag, tool name in mono
  - **动作** action — success-tint tag
- **上下游 lineage:** 上游触发 (parent ↑) + 触发的下游 (children ↓) as chips linking to the full run page.
  Backed by `agent_runs.parentRunId`.
- **Deltas from spec (open polish):** the transcript renders always-visible (not a collapsed `<details>`);
  lineage is parent + children chips (no explicit center "本次" chip); controls live on the card, not in
  the sheet.

### Motion & lifecycle

- `proposed` pins until acted; `applied` fades after ~48h (exit ease-in, short 150–250ms); `failed` never appears on home.
- Sheet enter: medium 250–400ms ease-out; collapse under `prefers-reduced-motion`.
- Unseen-since-last-visit: a small `accent-pink` dot on the card.

### Named Rules

**The State-over-Identity Color Rule.** On the agent home, color encodes *state* (待确认 amber / 已执行 green), never agent identity. Agents are told apart by icon + name. This keeps product screens out of rainbow-patchwork (Dual-Surface Rule) and honors "don't explain actions with color alone."

**The Reversibility-Honest Control Rule.** A card's controls come from `controlCapabilities(action)` = **what the backend can actually do today**, not aspiration. Current backend (`setActionStatus`, agent-repository.ts) supports only `approved` / `undone`. So: `draft_upload`(proposed) → **批准 / 拒绝** (backed); every **applied** action → **查看** (detail + reasoning sheet) — there is **no stop/unlist API**, and `undo` is offered only where the action is genuinely reversible in the real world (never on an already-sent message or spent ad). *Backlog:* real 停止投放 / 停止新拼团 / 团购效果 once ads + group-buy are DB-backed — **group-buy is currently browser localStorage** (groupbuy-repository.ts), so a coupon action is a *record*, not a live deal. Python reversibility: `send_customer_message` is now `risk="irreversible"` (a sent message can't be un-sent) so its undo control correctly hides; `place_ad` / `set_group_buy_coupon` stay `reversible` pending a real stop/unlist API — an open product decision, not a silent flip.

**The Bounded-Home Rule.** Computed zones (KPI, timeline) are always present so the home never blanks; unbounded agent volume goes into the horizontal roll so page height stays fixed.

**The Two-Depth Disclosure Rule.** The merchant sees result + why + control by default; transcript + lineage live one tap down in the sheet — for the curious owner and for 美团 judges.

**The Agent-First Rule.** On the home, the agent feed (需要关注) is the visual main character. Business numbers collapse to a one-line pulse; the schedule is a supporting per-technician roll. The home sells "your AI team is running ops," not "here is a dashboard."

**The Horizontal-Scale Rule.** Anything that grows with the business — completed agent actions, technicians — lives in a horizontal roll at fixed height, so expansion never bloats the page vertically. Vertical space is reserved for the things that demand a decision.

### Open items (deferred to build)

- **Stale/expired proposal** — proposed cards carry a TTL; tapping 批准 on an expired/superseded proposal shows "此建议已过期 · 重新评估" instead of acting on stale state.
- **Unseen / dismiss storage** — `last_seen` timestamp + a dismiss gesture for applied cards; the *visual* is specced, the persistence is a backend decision.
- **Pin cadence / nagging guard** — a rate sensibility so the pending pin doesn't turn 待确认 into daily homework (from the design review).
- **Visual polish (design review, product-deferred 2026-07-05):** migrate cards color-left-stripe → **chip-only**; replace **emoji → line-icon set**. Kept as the v5 look for now; both were flagged by the review (slop pattern #8 / judge polish). Build the current (stripe + emoji) look now, swap later.

(Loading/error states, first-run/empty-account, and the new-salon KPI baseline are now specced above — no longer deferred.)

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-04 | Merchant Agent Home section added | color = state not agent identity (Dual-Surface + not-color-alone); KPI in Inter (Two-Mode Type); pin/roll split for miss-tolerance + volume; extend the existing DESIGN.md. Via /design-consultation. |
| 2026-07-04 | Agent-first restructure + multi-technician | Dropped duplicative KPI tiles → slim pulse; agent feed is now the visual hero (Agent-First Rule); "today" became a per-technician horizontal roll (Horizontal-Scale Rule) that doubles as the single calendar entry (removed the double-calendar path); 技师管理 returns to 常驻 2×2. Logged 4 deferred gaps (loading, stale-proposal, KPI baseline, dismiss). |
| 2026-07-04 | /plan-design-review pass | Pulse → structured 3-cell stat strip. Fixes: states 4→9 (full interaction-state table + first-run/empty-account arc), a11y 5→8 (44px targets, roll keyboard/SR, AA contrast), slop 6→8 (emoji → committed line-icon set; dropped the colored left-stripe → **chip-only** state); added stat-strip/technician-card/tab-active component tokens. Overall 6.5 → ~8.5. |
| 2026-07-05 | Reverted main-page look to v5 | Product kept the v5 visuals (emoji + color left-stripe) over the review's chip-only/line-icon choices; retained the structured stat strip + 44px targets + normal 13px 需要关注 header. The two visual migrations → backlog (with the review's reasons). Build the current look; swap later. |
