# Nailed-it Round 2 Auto-Booking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build technician-backed instant booking with demo-level booking-linked messaging.

**Architecture:** Stay in the current mock/session architecture. Domain modules own pure technician availability, booking status, and message mapping; mock modules own seeded technicians plus browser-session booking/thread state. Customer sees curated slot choices with assigned technicians, while merchant screens show the operational calendar and technician workload.

**Tech Stack:** Next.js App Router, React client components where session state is needed, TypeScript, Vitest, existing CSS/classes only. Do not modify `src/app/globals.css`.

---

## Prerequisites

1. Start from `/home/tough/Nailed-it`.
2. Keep the existing Gemini recognition work; do not revert it.
3. Do not rewrite `src/app/globals.css`.
4. Before implementation, either commit the current Round 1 Gemini wiring or intentionally include it in the implementation branch. Do not mix unrelated user edits into task commits.

## Task 1: Add Technician And Clear Booking Status Contracts

**Files:**
- Modify: `src/domain/nail.ts`
- Modify: `src/mock/bookings.ts`
- Modify: `src/domain/pricing.test.ts`
- Modify: `src/mock/mock-data.test.ts`

**Step 1: Write failing type/data tests**

Add expectations in `src/mock/mock-data.test.ts`:

```ts
it('keeps every booking tied to a technician snapshot', () => {
  expect(mockBookings.every((booking) => booking.technician.name.length > 0)).toBe(true);
});

it('uses explicit review status instead of generic pending for active bookings', () => {
  const statuses = new Set(mockBookings.map((booking) => booking.status));
  expect(statuses.has('pending')).toBe(false);
});
```

**Step 2: Run test to verify failure**

Run:

```bash
npm test -- src/mock/mock-data.test.ts
```

Expected: fail because bookings have no `technician` and still use `pending`.

**Step 3: Update contracts**

In `src/domain/nail.ts`, add:

```ts
export type Technician = {
  id: string;
  name: string;
  initials: string;
  title: string;
  active: boolean;
};

export type TechnicianSnapshot = Pick<Technician, 'id' | 'name' | 'initials'>;

export type TechnicianSlot = {
  date: string;
  label: string;
  time: string;
  technician: TechnicianSnapshot;
  rankReason?: 'shortest_wait' | 'earliest_available';
};
```

Change `BookingStatus` to:

```ts
export type BookingStatus = 'confirmed' | 'pending_review' | 'completed' | 'cancelled';
```

Add to `Booking`:

```ts
technician: TechnicianSnapshot;
conversationId?: string;
```

**Step 4: Update seed bookings**

In `src/mock/bookings.ts`, add technician snapshots to all seeded bookings and migrate `pending` to `pending_review`.

**Step 5: Verify**

Run:

```bash
npm test -- src/mock/mock-data.test.ts src/domain/pricing.test.ts
```

Expected: pass.

**Step 6: Commit**

```bash
git add src/domain/nail.ts src/mock/bookings.ts src/domain/pricing.test.ts src/mock/mock-data.test.ts
git commit -m "feat: add technician booking contracts"
```

## Task 2: Add Technician Seeds And Slot Assignment Engine

**Files:**
- Create: `src/mock/technicians.ts`
- Create: `src/domain/availability.ts`
- Create: `src/domain/availability.test.ts`
- Modify: `src/mock/bookings.ts`
- Modify: `src/features/customer/BookingTimeSelector.tsx`

**Step 1: Write failing availability tests**

Create `src/domain/availability.test.ts` with tests for:

1. Active technicians produce assigned slots.
2. Bookings block only the same technician/date/time.
3. Results are sorted by earliest date/time.
4. The first available slot gets `shortest_wait`.

Use this expected shape:

```ts
expect(days[0].slots[0]).toMatchObject({
  date: '2026-05-23',
  time: '10:00',
  technician: { name: 'Mei' },
  rankReason: 'shortest_wait'
});
```

**Step 2: Run test to verify failure**

```bash
npm test -- src/domain/availability.test.ts
```

Expected: fail because `findTechnicianSlots` does not exist.

**Step 3: Implement pure slot assignment**

Create `findTechnicianSlots()` in `src/domain/availability.ts`.

Input:

```ts
{
  bookings: Booking[];
  days: Array<{ date: string; label: string; slots: string[] }>;
  technicians: Technician[];
}
```

Behavior:

1. Ignore inactive technicians.
2. Flatten day/time/technician candidates.
3. Exclude candidates with a non-cancelled booking for same `date`, `time`, and `technician.id`.
4. Sort by date, time, then technician name.
5. Group back into `{ date, label, slots: TechnicianSlot[] }`.
6. Mark only the first overall slot as `shortest_wait`; others can use `earliest_available` or omit.

**Step 4: Add technician seed**

Create `src/mock/technicians.ts`:

```ts
export const mockTechnicians: Technician[] = [
  { id: 'tech-mei', name: 'Mei Chen', initials: 'MC', title: 'Lead nail artist', active: true },
  { id: 'tech-lina', name: 'Lina Park', initials: 'LP', title: 'Gel specialist', active: true },
  { id: 'tech-anna', name: 'Anna Lim', initials: 'AL', title: 'Nail artist', active: true }
];
```

**Step 5: Replace string slots**

In `src/mock/bookings.ts`, replace `availableSlots` with `getAvailableBookingDays(bookings = mockBookings)` that calls `findTechnicianSlots()`.

Update `BookingTimeSelector` prop types from `slots: string[]` to `slots: TechnicianSlot[]`. Render labels like:

```ts
`${slot.time} · ${slot.technician.name}`
```

**Step 6: Verify**

```bash
npm test -- src/domain/availability.test.ts src/app/customer/booking/confirm/page.test.tsx
```

Expected: customer confirmation tests fail until Task 4 updates selected slot handling; availability tests pass.

**Step 7: Commit after the selector compiles**

```bash
git add src/domain/availability.ts src/domain/availability.test.ts src/mock/technicians.ts src/mock/bookings.ts src/features/customer/BookingTimeSelector.tsx
git commit -m "feat: assign technicians to available slots"
```

## Task 3: Add Browser-Session Operations Store

**Files:**
- Create: `src/mock/operations-store.ts`
- Create: `src/mock/operations-store.test.ts`
- Modify: `src/mock/conversations.ts`
- Create: `src/domain/messaging.ts`
- Create: `src/domain/messaging.test.ts`

**Step 1: Write failing store tests**

Create tests proving:

1. `getBookingsSnapshot()` starts from seeded bookings.
2. `createBookingFromDraft()` appends a new booking with selected technician.
3. Valid slot creates `confirmed`.
4. Low confidence creates `pending_review`.
5. Booking creation also creates a thread.
6. `resetOperationsStoreForTests()` restores seeds.

**Step 2: Write failing message mapping tests**

In `src/domain/messaging.test.ts`, test:

```ts
expect(toConversationForRole(thread, 'customer').messages[0].author).toBe('system');
expect(toConversationForRole(thread, 'merchant').participantName).toBe(thread.customerName);
```

**Step 3: Run tests**

```bash
npm test -- src/mock/operations-store.test.ts src/domain/messaging.test.ts
```

Expected: fail because files/functions do not exist.

**Step 4: Implement message mapping**

`src/domain/messaging.ts` should convert one `BookingConversationThread` into current `Conversation` shape for customer or merchant perspective. Map `authorRole`:

1. Same as viewer role -> `me`.
2. `system` -> `system`.
3. Other human role -> `them`.

**Step 5: Implement operations store**

`src/mock/operations-store.ts` should hold module-level mutable copies:

```ts
let bookingState = [...mockBookings];
let threadState = [...seedConversationThreads];
```

Expose:

```ts
getBookingsSnapshot()
getAvailableBookingDays()
createBookingFromDraft({ draft, slot, notes })
getConversationThreads()
getConversationForRole(conversationId, role)
getConversationsForRole(role)
sendMessage({ conversationId, authorRole, body })
resetOperationsStoreForTests()
```

Use `pending_review` if `draft.recognition.meta.confidence < 0.75`; otherwise `confirmed`.

**Step 6: Verify**

```bash
npm test -- src/mock/operations-store.test.ts src/domain/messaging.test.ts
```

Expected: pass.

**Step 7: Commit**

```bash
git add src/mock/operations-store.ts src/mock/operations-store.test.ts src/mock/conversations.ts src/domain/messaging.ts src/domain/messaging.test.ts
git commit -m "feat: add booking operations session store"
```

## Task 4: Auto-Confirm Customer Booking

**Files:**
- Modify: `src/app/customer/booking/confirm/page.tsx`
- Modify: `src/app/customer/booking/confirm/page.test.tsx`
- Modify: `src/features/customer/BookingTimeSelector.tsx`

**Step 1: Update failing tests**

In `page.test.tsx`, change the old toast expectation from request-sent to confirmed:

```ts
expect(screen.getByRole('status')).toHaveTextContent(/confirmed with/i);
```

Add a test that the slot button includes a technician name:

```ts
expect(screen.getByRole('button', { name: /10:00 .* mei/i })).toBeInTheDocument();
```

Add a low-confidence draft test expecting `pending review`.

**Step 2: Run test**

```bash
npm test -- src/app/customer/booking/confirm/page.test.tsx
```

Expected: fail on old copy/slot handling.

**Step 3: Implement confirmation**

Replace static `availableSlots` import with:

```ts
import { createBookingFromDraft, getAvailableBookingDays } from '@/mock/operations-store';
```

Use `getAvailableBookingDays()` for `BookingTimeSelector`. On confirm:

1. Call `createBookingFromDraft({ draft, slot: selectedSlot, notes })`.
2. Set toast:
   - `Confirmed with ${booking.technician.name}...`
   - or `Sent for merchant review...`
3. Show a link to `getCustomerMessagesPath(booking.conversationId)`.

**Step 4: Verify**

```bash
npm test -- src/app/customer/booking/confirm/page.test.tsx
```

Expected: pass.

**Step 5: Commit**

```bash
git add src/app/customer/booking/confirm/page.tsx src/app/customer/booking/confirm/page.test.tsx src/features/customer/BookingTimeSelector.tsx
git commit -m "feat: auto-confirm technician-backed bookings"
```

## Task 5: Show Technician Assignment In Merchant Calendar

**Files:**
- Modify: `src/app/merchant/calendar/page.tsx`
- Modify: `src/app/merchant/calendar/page.test.tsx`
- Modify: `src/features/merchant/BookingListCard.tsx`
- Modify: `src/features/merchant/BookingDaySheet.tsx`
- Modify: `src/features/merchant/MonthlyCalendar.tsx`

**Step 1: Write failing merchant calendar assertions**

Update tests to expect assigned technician text on booking cards:

```ts
expect(screen.getByText(/mei chen/i)).toBeInTheDocument();
```

Also assert a newly created booking can appear if the operations store test setup creates one.

**Step 2: Run test**

```bash
npm test -- src/app/merchant/calendar/page.test.tsx
```

Expected: fail because merchant calendar still reads static `mockBookings`.

**Step 3: Read from operations store**

Make merchant calendar a client page or move dynamic content into a client component. Use:

```ts
const [bookings] = useState(() => getBookingsSnapshot());
```

Pass those bookings into `MonthlyCalendar`.

Update booking cards to show:

```text
<technician name> · <duration> min · SGD <price>
```

**Step 4: Verify**

```bash
npm test -- src/app/merchant/calendar/page.test.tsx
```

Expected: pass.

**Step 5: Commit**

```bash
git add src/app/merchant/calendar/page.tsx src/app/merchant/calendar/page.test.tsx src/features/merchant/BookingListCard.tsx src/features/merchant/BookingDaySheet.tsx src/features/merchant/MonthlyCalendar.tsx
git commit -m "feat: show technicians on merchant calendar"
```

## Task 6: Add Technician Roster And Workload Summary

**Files:**
- Create: `src/features/merchant/TechnicianRosterCard.tsx`
- Modify: `src/app/merchant/manage/page.tsx`
- Modify: `src/app/merchant/manage/page.test.tsx`
- Modify: `src/app/merchant/profile/page.tsx`
- Modify: `src/app/merchant/profile/page.test.tsx`

**Step 1: Write failing tests**

Merchant manage should show technician names. Merchant profile should show workload counts by technician.

```ts
expect(screen.getByText(/mei chen/i)).toBeInTheDocument();
expect(screen.getByText(/technician workload/i)).toBeInTheDocument();
```

**Step 2: Run tests**

```bash
npm test -- src/app/merchant/manage/page.test.tsx src/app/merchant/profile/page.test.tsx
```

Expected: fail.

**Step 3: Implement roster component**

Use existing `summary-card`, `chip-row`, and `section-copy` classes. Do not add global CSS.

`TechnicianRosterCard` props:

```ts
technicians: Technician[];
bookings: Booking[];
```

Render name, title, active state, and active booking count.

**Step 4: Wire manage/profile**

Merchant manage: show roster above pricing rules.

Merchant profile: add workload summary card from `getBookingsSnapshot()`.

**Step 5: Verify**

```bash
npm test -- src/app/merchant/manage/page.test.tsx src/app/merchant/profile/page.test.tsx
```

Expected: pass.

**Step 6: Commit**

```bash
git add src/features/merchant/TechnicianRosterCard.tsx src/app/merchant/manage/page.tsx src/app/merchant/manage/page.test.tsx src/app/merchant/profile/page.tsx src/app/merchant/profile/page.test.tsx
git commit -m "feat: expose technician roster to merchants"
```

## Task 7: Make Messaging Demo-Functional

**Files:**
- Modify: `src/features/messages/ChatRoom.tsx`
- Modify: `src/app/customer/messages/page.tsx`
- Modify: `src/app/customer/messages/page.test.tsx`
- Modify: `src/app/customer/messages/[conversationId]/page.tsx`
- Create: `src/app/customer/messages/[conversationId]/conversation-client.tsx`
- Modify: `src/app/customer/messages/[conversationId]/page.test.tsx`
- Modify: `src/app/merchant/messages/page.tsx`
- Modify: `src/app/merchant/messages/page.test.tsx`
- Modify: `src/app/merchant/messages/[conversationId]/page.tsx`
- Create: `src/app/merchant/messages/[conversationId]/conversation-client.tsx`
- Modify: `src/app/merchant/messages/[conversationId]/page.test.tsx`

**Step 1: Write failing chat tests**

For customer thread:

```ts
await user.type(screen.getByRole('textbox', { name: /message/i }), 'Can I arrive 10 minutes early?');
await user.click(screen.getByRole('button', { name: /send/i }));
expect(screen.getByText(/arrive 10 minutes early/i)).toBeInTheDocument();
```

For merchant thread, assert merchant can reply and it appears as `me` in merchant view.

**Step 2: Run tests**

```bash
npm test -- src/app/customer/messages/[conversationId]/page.test.tsx src/app/merchant/messages/[conversationId]/page.test.tsx
```

Expected: fail because `ChatRoom` has no input.

**Step 3: Update ChatRoom**

Add optional props:

```ts
onSend?: (body: string) => void;
```

If `onSend` exists, render a `textarea` and `Send` button using existing `field` and `button` classes.

**Step 4: Add client wrappers**

Each conversation page should resolve `conversationId` in the server page, then render a client wrapper that:

1. Reads `getConversationForRole(conversationId, role)`.
2. Sends messages via `sendMessage()`.
3. Updates local state from the returned thread.

**Step 5: Update message list pages**

Read conversations from `getConversationsForRole('customer')` and `getConversationsForRole('merchant')` instead of static arrays.

**Step 6: Verify**

```bash
npm test -- src/app/customer/messages/page.test.tsx src/app/customer/messages/[conversationId]/page.test.tsx src/app/merchant/messages/page.test.tsx src/app/merchant/messages/[conversationId]/page.test.tsx
```

Expected: pass.

**Step 7: Commit**

```bash
git add src/features/messages/ChatRoom.tsx src/app/customer/messages src/app/merchant/messages
git commit -m "feat: add demo booking-linked messaging"
```

## Task 8: Wire Booking Detail To Technician And Thread

**Files:**
- Modify: `src/app/merchant/booking/[id]/page.tsx`
- Modify: `src/app/merchant/booking/[id]/page.test.tsx`

**Step 1: Write failing test**

Assert booking detail shows:

1. Assigned technician.
2. `confirmed` or `pending_review`.
3. Link to booking-linked message thread.

**Step 2: Run test**

```bash
npm test -- src/app/merchant/booking/[id]/page.test.tsx
```

Expected: fail.

**Step 3: Implement detail update**

Read bookings from `getBookingsSnapshot()` and render:

```text
Technician: Mei Chen
Status: confirmed
Open message thread
```

Use `getMerchantMessagesPath(booking.conversationId)`.

**Step 4: Verify**

```bash
npm test -- src/app/merchant/booking/[id]/page.test.tsx
```

Expected: pass.

**Step 5: Commit**

```bash
git add src/app/merchant/booking/[id]/page.tsx src/app/merchant/booking/[id]/page.test.tsx
git commit -m "feat: connect merchant booking detail to technician threads"
```

## Task 9: Documentation And Final Verification

**Files:**
- Modify: `docs/architecture/current-state.md`
- Modify: `docs/changes/implementation-log.md`
- Optional modify: `docs/decisions/ADR-0001-gemini-vision-recognition.md` only if AI boundary changed.

**Step 1: Update docs**

In `current-state.md`, record:

1. Technician-backed slots.
2. Instant confirmation.
3. `pending_review` exceptions.
4. Demo-functional booking-linked messaging.
5. Merchant technician visibility.

In `implementation-log.md`, append a concise Round 2 entry with:

1. What changed.
2. Why.
3. Tradeoff.
4. What must remain true.

**Step 2: Run full verification**

```bash
npm test
npx tsc --noEmit --pretty false
npm run build
git diff -- src/app/globals.css
```

Expected:

1. All tests pass.
2. TypeScript exits 0.
3. Build exits 0.
4. `src/app/globals.css` diff is empty.

**Step 3: Commit**

```bash
git add docs/architecture/current-state.md docs/changes/implementation-log.md
git commit -m "docs: document round two auto booking"
```

## Acceptance Checklist

Round 2 is complete only if:

1. Customer slot choices show assigned technicians.
2. Normal valid bookings auto-confirm.
3. Low-confidence bookings become `pending_review`.
4. Booking creation appends a merchant-visible booking.
5. Booking creation creates a message thread.
6. Customer and merchant can send demo messages in the thread.
7. Merchant calendar/detail/manage/profile expose technicians.
8. No implementation rewrites `src/app/globals.css`.
9. Full verification passes.
