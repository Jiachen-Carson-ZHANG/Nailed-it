# Event Taxonomy — Nailed-it

Date: 2026-05-26
Owner: Carson (final say) · Claude (drafts)

Locked event names for the customer + merchant funnel. **Not wired yet** — analytics SDK deferred (confirmed 2026-05-26). Define now so future implementation doesn't drift.

**Until SDK lands:** delta-claim patches that reference these events must back the claim with hallway-test baseline (Part 4 of `ux-rubric.md`), not analytics data. No event = no quantitative lift claim.

Used by:
- Per-patch DoD (delta-claim patches must reference events).
- Conversion funnel (Phase 4 onwards).
- Backlog prioritization (where do we lose users?).

---

## Naming convention

- **snake_case.**
- **Verb-led where possible:** `view_*`, `tap_*`, `submit_*`, `complete_*`.
- **Scoped by surface:** `customer_*`, `merchant_*`, `auth_*`, `system_*`.
- **No PII.** Never include name, email, phone, photo URL, IP.
- **Stable IDs only.** Style ID = stable; "style title" = unstable.

Example: `customer_tap_quote_cta` — clear surface (customer), action (tap), target (quote CTA). No PII.

---

## Customer journey events

### Discovery

| Event | When | Props |
|---|---|---|
| `customer_view_home` | Home page rendered | `entry_source` ("landing" / "tab" / "deep_link") |
| `customer_view_style_card` | Style card visible in viewport ≥ 500ms | `style_id`, `position` (1-based grid index) |
| `customer_tap_style_card` | User taps card | `style_id`, `position` |
| `customer_view_style_detail` | Detail page rendered | `style_id`, `entry_source` ("card" / "deep_link" / "search") |
| `customer_tap_home_upload_cta` | User taps "Book from my own photo" on home | — |

### Upload + quote

| Event | When | Props |
|---|---|---|
| `customer_view_booking_upload` | Booking page rendered | `entry_source` |
| `customer_tap_upload_photo` | Native picker opened | — |
| `customer_complete_upload_photo` | Photo selected (not yet uploaded) | `file_size_bucket` ("<1mb" / "1-5mb" / ">5mb"), `format` |
| `customer_complete_upload_sample` | User picked sample image | — |
| `customer_tap_analyze` | Analyze button tapped | — |
| `customer_view_quote` | Quote rendered (sheet shown) | `confidence_bucket` ("high" / "medium" / "low"), `price_bucket` |
| `customer_edit_quote_attribute` | User changes detected attribute | `attribute` (e.g. "removal", "extension", "shape") |
| `customer_tap_quote_continue` | User taps continue from quote sheet | `confidence_bucket`, `price_bucket` |
| `customer_quote_failed` | Analysis returned error | `error_reason` ("network" / "format" / "server" / "low_confidence_reject") |

### Confirm

| Event | When | Props |
|---|---|---|
| `customer_view_confirm` | Confirm page rendered | — |
| `customer_view_confirm_empty` | Confirm page rendered but no draft | — |
| `customer_view_slot` | Slot visible in scroll viewport | `slot_id`, `technician_id` |
| `customer_tap_slot` | User selects slot | `slot_id`, `technician_id` |
| `customer_tap_confirm` | Confirm button tapped | — |
| `customer_complete_confirm` | Booking persisted | `booking_id`, `status` ("confirmed" / "pending_review") |
| `customer_confirm_failed` | Confirm action returned error | `error_reason` |

### Post-book

| Event | When | Props |
|---|---|---|
| `customer_view_booking_messages` | Booking message thread opened | `booking_id`, `thread_id` |
| `customer_send_message` | Customer sends a message | `thread_id`, `length_bucket` ("<20" / "20-100" / ">100") |
| `customer_tap_reschedule` | Reschedule action initiated | `booking_id` |
| `customer_tap_cancel` | Cancel action initiated | `booking_id` |
| `customer_complete_reschedule` | Reschedule confirmed | `booking_id` |
| `customer_complete_cancel` | Cancellation persisted | `booking_id`, `reason_bucket` |

### Navigation / errors

| Event | When | Props |
|---|---|---|
| `customer_tap_back` | Back button | `from_route`, `to_route` |
| `customer_tap_tab` | Bottom tab switch | `tab` ("home" / "book" / "messages" / "profile") |
| `customer_view_error` | Error state shown to user | `route`, `error_kind` |
| `customer_dismiss_error` | User dismisses error | `route`, `error_kind` |

---

## Merchant journey events

### Calendar

| Event | When | Props |
|---|---|---|
| `merchant_view_calendar` | Calendar opened | `view` ("month" / "day") |
| `merchant_tap_day` | Day tile tapped | `date` (YYYY-MM-DD), `booking_count` |
| `merchant_view_booking_detail` | Booking detail opened | `booking_id` |
| `merchant_update_status` | Status changed | `booking_id`, `from_status`, `to_status` |

### Manage

| Event | When | Props |
|---|---|---|
| `merchant_view_manage` | Manage tab opened | — |
| `merchant_edit_pricing_rule` | Rule edit started | `rule_id`, `category` |
| `merchant_save_pricing` | Save action | `rule_count_changed` |
| `merchant_save_pricing_failed` | Save returned error | `error_reason` |

### Messages

| Event | When | Props |
|---|---|---|
| `merchant_view_messages` | List opened | — |
| `merchant_view_conversation` | Thread opened | `thread_id` |
| `merchant_send_message` | Merchant replies | `thread_id` |

---

## Auth / session

| Event | When | Props |
|---|---|---|
| `auth_view_landing` | Root page rendered | `referrer_bucket` |
| `auth_select_role` | Role selected on landing | `role` ("customer" / "merchant") |

(Real login deferred. Stub events for future.)

---

## System / performance

| Event | When | Props |
|---|---|---|
| `system_page_view` | Any route loaded | `route`, `lcp_ms`, `cls`, `inp_ms` |
| `system_offline_detected` | `navigator.onLine` flips false | `route` |
| `system_online_restored` | flips true after offline | `route`, `offline_duration_ms` |

---

## Funnel views (queries we want to answer)

### Customer booking funnel

```
customer_view_home
  ↓ (view_style_card or tap_home_upload_cta)
customer_view_booking_upload
  ↓ (tap_upload_photo + complete_upload_photo)
customer_tap_analyze
  ↓
customer_view_quote
  ↓ (tap_quote_continue)
customer_view_confirm
  ↓ (tap_slot)
customer_tap_confirm
  ↓
customer_complete_confirm
```

Drop-off between steps = backlog input.

### Merchant daily flow

```
merchant_view_calendar (view="day")
  ↓
merchant_view_booking_detail (or merchant_update_status inline)
```

---

## Privacy + retention

- No PII in event props. Verified by lint pre-launch.
- Photo URLs never sent — only `file_size_bucket` and `format`.
- Default retention: 90 days for raw events, 1 year for aggregated metrics.
- User opt-out switch in profile (future).

---

## Implementation notes

- When analytics tooling is picked (Sentry / Mixpanel / Amplitude / custom), wrap calls in `src/lib/analytics.ts` with this shape:

```ts
track(eventName: string, props?: Record<string, string | number>): void
```

- All events fired from one place per route (custom hook `useTrackPageView`) — not scattered.
- New event names must land in this doc first, then code.
- No event = no patch claim of conversion lift. Enforced at PR review.

---

## Open questions

- Tooling: Mixpanel, Amplitude, GA4, or roll own? Cost vs flexibility tradeoff.
- Server-side vs client-side events? Confirms have higher trust if server-emitted.
- Sampling: 100% in dev, throttle in prod? Decide before launch.
- Do we instrument before launch or wait for traffic? Recommend before — calibrate funnel pre-launch with internal QA.
