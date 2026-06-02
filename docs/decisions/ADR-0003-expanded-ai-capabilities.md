# ADR-0003: Expanded AI capabilities — trending, breakdown, try-on

**Status:** Accepted  
**Date:** 2026-06-01  
**Supersedes:** —  
**Superseded by:** —

---

## Context

The initial AI integration (ADR-0001) established a single use-case: Gemini Vision extracts nail-service attributes from a customer reference image, and all pricing/duration logic stays deterministic. Three new customer-facing features require AI capabilities that go beyond attribute extraction.

---

## Decision

Introduce three new AI-powered features, each backed by a dedicated `src/lib/ai/` module and `src/app/api/ai/` route:

### 1. Trending Styles (`/api/ai/trending-styles`)

- **What:** On-demand generation of the top-10 trending nail styles for the current month.
- **AI role:** Content generation only (names, descriptions, tags). No pricing or booking logic.
- **Model:** `gemini-3.1-flash-image-preview` (text-only prompt).
- **Output:** Bilingual (EN + ZH) style list with AI-built search links to Pinterest, Xiaohongshu, Google Images, and TikTok.
- **Caching:** None by default; a "Refresh" button in `TrendingStylesPanel` fetches live data on demand.

### 2. Component Breakdown (`/api/ai/breakdown`)

Two modes, toggled per-request via `freeMode: boolean`:

**Standard mode (default)**
- AI identifies components using the existing domain enums (`BaseServiceName`, `NailShape`, `NailStyleName`, `NailAddonName`).
- Pricing and duration are produced deterministically by `calculateEstimate()` from `src/domain/pricing.ts`.
- Consistent with ADR-0001: AI never prices.

**Free mode**
- AI freely identifies any visible component (including techniques not covered by existing enums, e.g. "ombre gradient", "3D gel art").
- AI provides its own price and duration estimates per component.
- Results are displayed in an editable table — quantities and unit prices can be adjusted by the user.
- **AI pricing is permitted in free mode** and is informational; it does not create or modify a booking.

### 3. Virtual Try-On (`/api/ai/try-on`)

- **What:** Accepts two images (hand photo + style reference) and generates a realistic composite image showing the style applied to the customer's nails.
- **AI role:** Image generation for visual preview only. No data is persisted, no booking is created.
- **Model:** `gemini-3.1-flash-image-preview` with `responseModalities: ["IMAGE", "TEXT"]`.
- **Entry point:** Accessible from style detail pages ("Try on this look" → `/customer/try-on?styleId=…`) or directly at `/customer/try-on`.

---

## Design Principles

1. **Separation of concerns:** Each feature has its own `src/lib/ai/` module, API route, and UI component. They do not share state.
2. **AI pricing boundary is per-mode, not per-feature:** Trending and try-on never involve pricing. Standard breakdown uses deterministic pricing. Free breakdown explicitly delegates pricing to AI — this is a documented exception, not a leak.
3. **Model:** All three features use `gemini-3.1-flash-image-preview`, controlled via `GEMINI_IMAGE_MODEL_NAME` env var.
4. **No caching infrastructure added:** Trending data is fetched on user demand. This keeps the implementation simple; a cache layer can be added later without API changes.
5. **No new navigation tabs:** Try-on is a sub-route under `/customer/` (like `/customer/style/[id]`), not a tab. Trending is a panel on the home page.

---

## Alternatives Considered

- **Cache trending styles server-side (1-hour TTL):** Rejected in favour of a Refresh button to keep implementation simple and give users explicit control over freshness.
- **Reuse recognize-nail-style for breakdown:** The existing recognition endpoint only returns domain enum values. Free-mode breakdown needs unconstrained component names, so a separate endpoint and lib are required.
- **OpenRouter instead of Gemini direct:** The feature branch used OpenRouter. The main app uses direct Gemini API calls with its own key management and telemetry. Staying on the same stack avoids adding a new dependency and a second API key.

---

## Consequences

**Positive:**
- Three customer-facing AI features added without changing the core booking flow.
- Standard breakdown maintains ADR-0001 pricing discipline.
- Free mode provides a richer exploration tool with explicit disclosure that AI prices are estimates.
- Try-on is purely visual — no risk of AI influencing booking data.

**Negative:**
- `gemini-3.1-flash-image-preview` is a preview model; availability and pricing may change.
- No eval set or accuracy measurement for trending styles or free-mode breakdown.
- Try-on image generation quality depends on the model's multimodal output capabilities.

---

## References

- [ADR-0001 — Gemini vision recognition](ADR-0001-gemini-vision-recognition.md)
- `src/lib/ai/trending-styles.ts`
- `src/lib/ai/breakdown.ts`
- `src/lib/ai/try-on.ts`
