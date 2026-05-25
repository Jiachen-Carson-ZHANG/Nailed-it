# 2026-05-25 Nailed-it Round 2 Auto-Booking Design

## Status

Approved design for Round 2 planning.

Round 2 should prove that Nailed-it can turn an AI nail quote into an operationally valid salon booking, not only recognize an image.

## Goal

Build the next demo loop:

`AI quote -> technician-backed slots -> instant confirmation -> merchant calendar -> booking-linked messaging`

The core product claim is that the platform reduces merchant scheduling work. Customers should get a confirmed appointment when the system can prove the slot is feasible. Merchant review should be reserved for exceptions.

## Product Decisions

### Instant Confirmation By Default

When a customer selects a valid slot and the booking has no exception flags, the app should auto-confirm the booking. The customer should see language like:

`Confirmed with Mei today at 16:00`

Do not make normal bookings wait for merchant approval.

### Pending Review For Exceptions

Use `pending_review` when the booking needs human review:

1. Low AI confidence.
2. Unsupported or uncertain attributes.
3. Slot conflict during final confirmation.
4. Merchant disables instant booking.
5. Special notes likely change service feasibility.

The review path should create or reuse a booking-linked message thread.

### Customer Slot View

Customers should not see the full multi-technician operating calendar. They should see curated bookable options:

1. Earliest available / shortest wait first.
2. Assigned technician visible on each slot.
3. Optional later filters such as "any technician" or "choose technician".

This keeps the customer focused on outcome, price, and time while still giving context and trust.

### Merchant Calendar View

Merchants should see the operational view:

1. Booking cards with assigned technician.
2. Status.
3. Quote duration.
4. Customer notes.
5. Link to the booking-linked message thread.

Drag-and-drop calendar editing remains deferred.

### Messaging As A Core Demo Function

Messaging should become demo-functional in Round 2, but not production chat.

Required:

1. Booking confirmation creates a booking-linked thread.
2. Customer and merchant can send a message in the thread.
3. Messages persist for the current browser session.
4. `pending_review` bookings use the thread as the approval channel.

Not required:

1. Realtime websockets.
2. Push notifications.
3. Authenticated user identity.
4. Multi-device synchronization.

## Core UX

### Customer

1. Upload or choose a nail image.
2. Review editable AI attributes.
3. See rule-based price and duration.
4. See slot cards such as:
   - `Today 16:00 · Mei · shortest wait`
   - `Today 18:00 · Lina`
   - `Tomorrow 11:00 · Anna`
5. Confirm one slot.
6. See either:
   - `Confirmed`
   - `Pending review`
7. Continue into a booking-linked message thread.

### Merchant

1. See technician-backed booking cards on calendar.
2. See technician roster and availability summary on manage/profile surfaces.
3. Open booking detail with customer, quote, assigned technician, status, and thread link.
4. Reply in the booking-linked message thread.

## Data Model Additions

### Technician

Round 2 needs explicit technicians, but not hard skill matching.

Recommended fields:

```ts
export type Technician = {
  id: string;
  name: string;
  initials: string;
  title: string;
  active: boolean;
};
```

### Slot

Available slots should carry assignment context:

```ts
export type TechnicianSlot = {
  date: string;
  label: string;
  time: string;
  technicianId: string;
  technicianName: string;
  rankReason?: 'shortest_wait' | 'earliest_available';
};
```

### Booking

Bookings should store a technician snapshot or equivalent display fields so historical bookings remain readable if the technician list changes.

Recommended addition:

```ts
export type TechnicianSnapshot = {
  id: string;
  name: string;
  initials: string;
};
```

### Status

Use clearer statuses:

1. `confirmed`
2. `pending_review`
3. `completed`
4. `cancelled`

Existing `pending` can be migrated or treated as legacy display during implementation.

### Messaging

Messaging should use a single booking-linked thread source of truth, then map into customer or merchant view:

```ts
export type MessageAuthorRole = 'customer' | 'merchant' | 'system';

export type BookingMessage = {
  id: string;
  authorRole: MessageAuthorRole;
  body: string;
  sentAt: string;
};

export type BookingConversationThread = {
  id: string;
  bookingId: string;
  customerName: string;
  merchantName: string;
  relatedBookingTime: string;
  messages: BookingMessage[];
};
```

## Architecture

Stay in the current mock/session architecture for Round 2:

1. `src/domain/*` owns pure contracts and deterministic logic.
2. `src/mock/*` owns seeded technicians, bookings, availability, and demo session state.
3. Pages compose existing feature components.
4. Do not rewrite `src/app/globals.css`.
5. Do not introduce a database or auth yet.

The booking flow remains deterministic:

`recognition -> editable attributes -> pricing -> technician slot search -> final conflict check -> booking creation -> thread creation`

AI still does not decide technician assignment, price, duration, or availability.

## Error And Exception Handling

1. If the selected slot disappears, keep the draft and ask the customer to choose another slot.
2. If AI confidence is low, allow the user to continue but create `pending_review`.
3. If the customer enters special notes, keep instant confirmation unless the implementation has a clear rule that marks the notes as review-worthy.
4. If no technicians have valid slots, show an empty state and route customer to message the merchant.

## Testing Strategy

Add focused tests for:

1. Technician slot assignment and conflict exclusion.
2. Auto-confirmed booking creation from a valid slot.
3. `pending_review` creation for exception input.
4. Booking-linked thread creation.
5. Message send from customer and merchant perspectives.
6. Merchant calendar showing assigned technician.
7. Customer confirmation showing technician on slot choices.

Full verification should still include:

```bash
npm test
npx tsc --noEmit --pretty false
npm run build
```

## Deferred

1. Full multi-technician customer calendar.
2. Technician skill matching as a hard scheduling constraint.
3. Drag-and-drop calendar editing.
4. Realtime chat.
5. External calendar sync.
6. Payments, deposits, cancellation windows, and reminders.
