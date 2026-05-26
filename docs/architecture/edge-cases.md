# Edge Cases — Nailed-it

Date: 2026-05-26
Owner: Carson (decisions) · Claude (drafts)

Every screen × every non-happy state, with designed copy + CTA. Goal: eliminate ad-hoc empty/loading/error UI.

Used by:
- Phase 2 audit Lens A (spec compliance).
- Per-patch DoD (flow checks).
- Future error-state component library.

---

## State taxonomy

Every screen with data must handle these states:

| State | Trigger |
|---|---|
| **Happy** | data present, user is authed where required |
| **Loading** | data fetch in flight, > 200ms |
| **Empty** | data fetch succeeded, returned zero results |
| **Error** | data fetch failed (network, server, validation) |
| **Partial** | some data present, some missing (e.g. style detected but quote failed) |
| **Stale** | data is older than safe threshold (e.g. slots from 5 min ago) |
| **Permission-denied** | user is not authed or not authorized |
| **Offline** | network unreachable |

Not every screen needs all 8. Mark per-screen below.

---

## Customer flow edge cases

### `/customer/home` — discovery feed

| State | Copy | CTA | Notes |
|---|---|---|---|
| Happy | (existing) | (existing) | — |
| Loading | (skeleton cards, no text) | — | ≥ 6 skeleton cards |
| Empty | "No trending styles right now — check back soon." | "Book from your own photo" → `/customer/booking` | (already shipped UI-E5) |
| Error | "Couldn't load styles. Check connection and retry." | "Retry" + "Book from your own photo" | — |
| Offline | "You're offline. Connect to see today's styles." | "Retry" | Hide trending grid, show offline banner |

### `/customer/booking` — upload + quote

| State | Copy | CTA |
|---|---|---|
| No photo yet | "Choose a nail photo to get your instant quote." | "Upload photo" / "Try with example" |
| Photo uploaded, no analysis | "Photo ready. Tap to analyze." | "Analyze my photo" |
| Loading analysis | "Detecting style…" | (disabled) |
| Analysis done, confident | "Style detected." → bottom sheet | "View your estimate" |
| Analysis done, low confidence (< 0.6) | "We're not sure about this one. Edit details to refine your quote." | "Edit details" |
| Analysis failed | "Couldn't analyze that photo. Try a sharper one, or use our example." | "Try again" + "Try with example" |
| Upload failed | "Upload didn't go through. Try again or use a smaller photo." | "Retry" |
| Photo too large / wrong format | "That file's too large. Try a JPG or PNG under 10 MB." | "Choose different photo" |
| Offline at any step | "You're offline. Your photo is saved here — try again when connected." | "Retry" |

### `/customer/booking/confirm` — slot pick + confirm

| State | Copy | CTA |
|---|---|---|
| Happy, draft loaded | (existing) | "Confirm appointment" |
| Empty (no draft) | "No active booking draft. Start a new quote." | "Back to booking" → `/customer/booking` |
| No slots in next 7 days | "No slots open this week. Try next week or message the salon." | "Next week" + "Message salon" |
| Slot taken between view and confirm | "Someone just booked this slot. Pick another." | "Pick another time" |
| Confirm failed (server) | "Booking didn't go through. Try again — your slot may still be open." | "Retry" + "Back to slots" |
| Pending review (low confidence quote) | (existing) "Pending review with [tech]" | "Open booking messages" |
| Offline at confirm | "You're offline. Slot held for 60 sec. Reconnect to confirm." | (Retry button) |

### `/customer/style/[id]` — style detail

| State | Copy | CTA |
|---|---|---|
| Happy | (existing) | "Book this look" |
| Style not found (bad id) | "This style isn't available anymore. Browse current trending styles." | "Back to discovery" → `/customer/home` |
| Image load failed | (silent fallback to placeholder image with style tags visible) | — |

### `/customer/messages` + `/customer/messages/[id]`

| State | Copy | CTA |
|---|---|---|
| Empty list | "No messages yet. Conversations appear after you book." | "Browse styles" → `/customer/home` |
| Conversation not found | "This conversation isn't available." | "Back to messages" |
| Send failed | (toast: "Message didn't send. Tap to retry.") | tap toast |

### `/customer/profile`

| State | Copy | CTA |
|---|---|---|
| Empty bookings | "No appointments yet. Book your first nail look." | "Browse styles" |
| Empty preferences | "Add your nail preferences to get sharper quotes." | "Add preferences" (defer until preference UI exists) |

---

## Merchant flow edge cases

### `/merchant/calendar`

| State | Copy | CTA |
|---|---|---|
| Happy | (existing) | — |
| Empty (no bookings today) | "No bookings today. Use the manage tab to update pricing or block slots." | "Block a slot" → opens slot picker |
| Empty week | "Calendar is empty for this week." | (no CTA — passive state) |
| Booking detail load failed | "Couldn't load this booking. Try again." | "Retry" |

### `/merchant/manage`

| State | Copy | CTA |
|---|---|---|
| Happy (rules present) | (existing) | — |
| Empty (no rules) | "No pricing rules yet. Add your first rule to start taking bookings." | "Add rule" |
| Save failed | (toast: "Pricing didn't save. Try again.") | tap to retry |
| Save partial (some rules saved, some failed) | (toast: "Saved 3 of 4 rules. Check the highlighted ones.") | highlight failures inline |

### `/merchant/booking/[id]`

| State | Copy | CTA |
|---|---|---|
| Happy | (existing) | — |
| Booking not found | "This booking isn't available. It may have been cancelled." | "Back to calendar" |
| Status update failed | (toast: "Status didn't update. Try again.") | retry |

---

## Cross-cutting requirements

### Loading states

- Skeleton UI preferred over spinners for content-heavy screens (home, calendar).
- Spinners acceptable for in-button state ("Confirming…").
- Loading copy: ≤ 3 words, present-tense -ing, end with ellipsis.

### Empty states

- Must include: illustration (TBD), one-line situation, next-step CTA.
- Never just "No data" or "Nothing here".
- Tone: warm, brief, action-forward.

### Error states

- Must include: what went wrong (one line), how to recover (CTA).
- Never expose stack traces, error codes, or internal IDs to user.
- Log full error to console for dev debugging (separate from user copy).

### Offline detection

- Use `navigator.onLine` + listen to `online`/`offline` events.
- Show persistent banner at top of screen when offline.
- Disable destructive actions (confirm, save, send).
- Preserve in-flight form data in memory.

### Toast lifecycle

- Auto-dismiss after 4s for info/success.
- Persist until action for error (require tap to dismiss).
- Max 1 toast on screen at once. Queue if more arrive.

---

## Components that need to exist

Currently missing or partial:

- `<EmptyState illustration title body cta />` — central component.
- `<ErrorState title body retry />` — central component.
- `<OfflineBanner />` — global, conditional render.
- `<LoadingSkeleton variant="card" count={6} />` — for grids.
- `<Toast variant="info|success|error" />` — currently ad-hoc.

Patch backlog: build these as part of Phase 4 if missing.

---

## Open questions

- Offline behavior on booking confirm: hold slot 60s? Or fail immediately? (Reservation race condition.)
- Low-confidence AI: hard threshold 0.6? Or expose as gradient ("uncertain about extension")?
- Send-failure for messages: queue and retry on reconnect, or fail and show?
- Default illustrations for empty states: who designs? (Melissa, TBD priority.)
