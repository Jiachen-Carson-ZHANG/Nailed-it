# Architecture: Current State

Last updated: 2026-06-05

## Stack

Next.js App Router, TypeScript, mobile-first shell (`MobileLayout` + `TopBar` + `BottomTabBar`). Currently there is no backend database, and state lives in mock modules and a versioned `localStorage` operations store. Supabase integration is in progress to replace the mock modules. AI calls are server-side API routes.

## Entry points

| Route | Purpose |
|---|---|
| `/` | Landing page (`src/components/landing/`) or role dispatch via `src/domain/session.ts` |
| `/customer/*` | Customer flows: discovery, style detail, booking, try-on, messages, profile |
| `/merchant/*` | Merchant flows: calendar, booking detail, roster/manage, messages, profile |
| `/privacy` | Public privacy disclosure (no auth required) |
| `/api/integrations/pinterest/callback` | Placeholder Pinterest OAuth redirect URI |
| `/dev` | Internal dev/debug page |

## AI API routes

| Route | Model | Purpose |
|---|---|---|
| `/api/ai/recognize-nail-style` | `google/gemini-3.1-flash-image-preview` with 2.5 being the fallback | Image → nail attributes + confidence for booking |
| `/api/ai/try-on` | `google/gemini-3.1-flash-image-preview` (OpenRouter) | Hand + style images → try-on composite |
| `/api/ai/breakdown` | Uses OpenRouter | Image → structured nail component breakdown with pricing |
| `/api/ai/trending-styles` | `qwen/qwen3-235b-a22b` (OpenRouter) | Text → ranked trending style suggestions |

Gemini calls use `GEMINI_API_KEY` directly. OpenRouter calls use `OPENROUTER_API_KEY` via `src/lib/ai/openrouter.ts`. All pricing/booking decisions remain deterministic app logic — AI only extracts attributes.

## Domain modules (`src/domain/`)

- `session.ts` — route intents, tab visibility, home paths, detail-link helpers for both roles
- `nail.ts` — shared nail/booking/technician/quote contracts; confidence-review policy (low-confidence → `pending_review`)
- `pricing.ts` — rule-based quote calculator used by style previews, booking drafts, and merchant snapshots
- `availability.ts` — pure technician-slot assignment (no same-technician/date/time conflicts; earliest-wait ranking)
- `booking-draft.ts` — in-memory draft boundary across `/customer/booking` → `/customer/booking/confirm`
- `messaging.ts` — role-aware mapping from operations-store threads to the shared `Conversation` UI contract

## Mock data (`src/mock/`)

`styles.ts`, `bookings.ts`, `conversations.ts`, `technicians.ts`, `pricing.ts` — seed data.
`operations-store.ts` — versioned `localStorage` store for bookings and threads; survives page reloads within a browser session.
`ai.ts` — sample image path so booking flow works without a provider key.

## LLM adapters (`src/lib/ai/`)

- `nail-recognition.ts` — Gemini adapter; structured JSON output; normalises to supported nail attributes; logs `[nailed-it:vision-cost]` telemetry when `VISION_COST_LOGGING_ENABLED` is not `false`
- `usage-cost.ts` — Gemini usage metadata parser and USD cost estimator
- `openrouter.ts` — shared fetch wrapper for OpenRouter chat completions (text and image modalities)
- `try-on.ts` — two-image try-on via OpenRouter
- `breakdown.ts` — component breakdown via OpenRouter; re-uses recognised attribute helpers from `nail-recognition.ts`
- `trending-styles.ts` — AI trending style feed via OpenRouter

## Testing

Vitest for unit/integration tests (`.test.ts` / `.test.tsx` colocated with source). Playwright for e2e (`e2e/`). Run with `npm test`.
