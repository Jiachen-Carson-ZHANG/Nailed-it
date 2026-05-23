# 2026-05-24 Nailed-it Sprint 1 Design

## Status

Approved design for the first implementation plan.

This document captures the agreed Sprint 1 product and system design for the Meituan nail salon app. It aligns the Lark PRDs, external scheduling references, and the current team frontend direction before implementation planning starts.

## Goal

Build a complete customer-to-merchant booking loop for a mobile-first Web App / H5 product:

1. A customer uploads or selects a nail design image.
2. The system uses a real image model to extract editable nail-service attributes.
3. Merchant-configured pricing and duration rules produce a customer-facing quote estimate.
4. The customer chooses an available time, ranked by earliest time / shortest wait.
5. The appointment is created with conflict checks.
6. The merchant sees and manages the booking in a calendar.

The first demo should prove one usable chain:

`Merchant sets rules -> customer gets AI quote -> customer books -> merchant sees and manages it`

## Source Alignment

### Lark Product Docs

The Lark docs define Nailed-it as a B2B2C nail-service product for merchants, nail technicians, and customers. The core themes are AI style decomposition, quote generation, appointment booking, and merchant operations.

The frontend PRD defines:

1. Mobile-first Web App / H5.
2. Two entrances: Customer App and Merchant App.
3. Customer tabs: Home, Booking, Messages, Profile.
4. Merchant tabs: Calendar, Management, Messages, Profile.
5. Customer P0: trending style waterfall, image upload, AI recognition, editable bottom sheet, realtime price/time estimate.
6. Merchant P0: monthly booking calendar and price/time rule management.

Backend contracts should support those UI routes and components so frontend can work with mock data first, then swap in real backend/model behavior behind stable APIs.

### External References

Easy!Appointments is the main practical scheduling reference. It validates the core model of customers, services, providers, appointments, working plans, booking rules, notifications, and calendar sync.

Salon Booking is the salon-domain reference. It validates merchant calendar control, manual reservations, blocked time slots, confirmation states, reminders, and admin calendar UX.

Cal.diy is the modern full-stack scheduling reference. It validates using clean app/schema boundaries, booking-page separation, schedules, availability rows, bookings, and buffer concepts. It should not drive salon-specific business logic.

LibreBooking is the resource-reservation reference. It validates deterministic conflict prevention and the idea that salon resources can map to technicians, chairs, rooms, or equipment. Waitlists, quotas, and broad resource management are later-scope ideas.

## Sprint 1 Scope

### Required

1. Landing and role-based entry consistent with the frontend PRD.
2. Customer style discovery using seeded or mock trending nail styles.
3. Customer image upload or style selection.
4. Real image-model analysis for nail attributes.
5. Bounded image recovery fallback when confidence or image quality is weak.
6. Editable nail attributes in the customer flow.
7. Merchant-configurable price and duration rules.
8. Quote generation from merchant rules, not direct AI price output.
9. One shop with multiple technicians.
10. Technician weekly availability.
11. Merchant blocked unavailable time.
12. Earliest available / shortest-wait slot recommendation.
13. Booking creation with conflict checks.
14. Merchant monthly/day calendar.
15. Merchant manual booking creation.
16. Merchant booking detail view.

### Deferred But Remembered

These are not rejected. They should remain visible for later planning:

1. Drag-and-drop calendar editing.
2. External calendar sync.
3. Reminders and follow-ups.
4. Waitlists.
5. Payments and deposits.
6. Complex recurring shifts.
7. Richer technician service eligibility / skills.
8. Full AR-quality try-on.
9. Live trend scraping.
10. Real analytics dashboard.

## Product Scope

Sprint 1 should cover both sides of the product, but the customer flow remains the entry point:

`Customer image/style -> AI attributes -> quote -> appointment -> merchant calendar`

The merchant side is required because the customer quote and booking are only meaningful if merchants can configure the rules and protect real-world time.

Technician skills are not a hard Sprint 1 scheduling constraint because the core docs do not require them. Technicians should be modeled as staff with availability. Richer service eligibility can be added later if real merchant behavior demands it.

## System Architecture

Use one app, one database, deterministic domain modules, and an AI adapter.

### Frontend Surfaces

1. Customer home: trending nail style waterfall.
2. Customer booking: upload/select image, AI result, editable attributes, quote estimate, slot selection.
3. Customer messages/profile: present as frontend routes, but full message logic can stay light in Sprint 1.
4. Merchant calendar: month/day bookings, manual booking, blocked time.
5. Merchant management: price/time rules, technicians, availability.
6. Merchant messages/profile: present as frontend routes; analytics can be placeholder unless needed for demo.

### Backend Modules

1. `ai-analysis`: calls the real image model, validates output, and normalizes it into nail attributes.
2. `pricing`: calculates price and duration from merchant rules.
3. `availability`: computes valid slots from working plans, blocked time, existing appointments, and quote duration.
4. `booking`: creates appointments and enforces final conflict checks.
5. `admin-config`: manages shop, technician, pricing, and availability settings.
6. `calendar`: returns merchant calendar views backed by appointments and blocked time.

### Important Boundary

The image model should not decide price, duration, or availability.

The model extracts attributes such as extension, builder gel, nail shape, cat-eye, French, rhinestones, hand-painting, and other add-ons. The pricing engine maps those attributes to merchant rules. The availability engine uses the computed duration to find valid slots.

The frontend may show AI result, price, and duration together, but the backend source of truth should stay separated:

`AI recognition -> editable nail attributes -> pricing engine -> availability engine -> booking engine`

## Suggested API Contracts

These route shapes are intended to align with the frontend PRD. Exact naming can change during implementation planning.

1. `GET /api/styles/trending`
2. `GET /api/styles/:id`
3. `POST /api/ai/recognize-nail-style`
4. `POST /api/quotes`
5. `GET /api/availability`
6. `POST /api/appointments`
7. `GET /api/merchant/pricing-rules`
8. `PUT /api/merchant/pricing-rules`
9. `GET /api/merchant/calendar`
10. `POST /api/merchant/manual-bookings`
11. `POST /api/merchant/blocked-times`

## Core Data Model

The implementation plan should refine this into concrete schema definitions.

1. `Shop`: merchant business profile.
2. `Technician`: staff member under one shop.
3. `Customer`: booking user.
4. `NailStyle`: uploaded or seeded style image with tags and popularity metadata.
5. `AIAnalysis`: raw and normalized image-model result.
6. `ServiceBlock`: normalized nail attributes used for pricing.
7. `PriceRule`: merchant-controlled price and duration rule.
8. `Quote`: snapshot of attributes, edits, matched rules, total price, duration, and expiry.
9. `WorkingPlan`: weekly technician availability.
10. `BlockedTime`: merchant-controlled unavailable interval.
11. `Appointment`: customer or merchant-created booking.

## Data Flow

Main flow:

`Customer image/style -> image quality check -> AI analysis -> optional recovery pass -> editable service attributes -> quote -> availability search -> appointment -> merchant calendar`

Every booking should be created from a quote snapshot. The quote stores the image reference, AI attributes, user edits, pricing rule version, line items, total price, duration, and expiration time.

The appointment stores the final quote id, technician, start/end time, status, and customer info.

## AI Image Recovery Fallback

Sprint 1 includes a bounded fallback for weak image quality or uncertain model output.

Default path:

`original image -> single AI analysis -> editable result -> quote`

Fallback path:

`weak image/confidence -> crop/zoom nail area -> light enhancement -> one retry -> merge/check result -> editable result`

Rules:

1. Keep this as a fallback path, not the default path.
2. Run at most one recovery retry in Sprint 1.
3. Use the fallback to improve practical robustness, not to build a full computer-vision subsystem.
4. If uncertainty remains, show a soft customer confirmation state: "Please check these details before continuing."

## Customer And Merchant Quote Visibility

Customers should see a simple estimate:

1. Estimated price summary or range.
2. Estimated duration.
3. Editable style/service attributes.
4. Short included-items summary.

Customers should not see the full line-by-line pricing formula by default.

Merchants should see the full operational breakdown:

1. Matched pricing rules.
2. Price and duration per service block.
3. AI confidence and uncertain attributes.
4. User edits.
5. Final price and duration.

## Scheduling Rules

Sprint 1 scheduling should be deterministic and simple.

Availability is computed from:

1. Technician weekly working plan.
2. Merchant blocked time.
3. Existing appointments.
4. Quote duration.
5. Optional simple buffer if implementation time allows.

Slot recommendation ranks by:

1. Earliest available start time.
2. Shortest customer wait.

Do not include balanced shop utilization in Sprint 1. Do not include technician skill matching as a hard constraint unless a later design decision adds it.

## Edge Cases

1. User edits attributes: update the customer estimate and preserve the full merchant breakdown.
2. Pricing changes after quote: existing quote keeps its rule version until expiry; new quotes use new rules.
3. Slot disappears during confirmation: booking creation re-checks conflicts and asks the customer to choose another slot.
4. Merchant manual booking or blocked time: use the same conflict rules as customer bookings.
5. Low image confidence after fallback: show editable confirmation rather than blocking the flow.
6. Appointment status changes: start with `pending`, `confirmed`, `completed`, and `cancelled`.

## Sprint 1 Build Slices

### Slice 1: Foundation And Contracts

Define routes, shared types, seed/mock data, and API contracts that match the frontend PRD.

Outcome: frontend can keep using mocks while backend replaces the behavior behind the same shapes.

### Slice 2: AI Quote Loop

Implement image upload/select, real image-model call, bounded recovery fallback, normalized attributes, editable result, customer-facing quote estimate, and merchant-facing breakdown.

Outcome: a customer can get an explainable estimate from a nail image.

### Slice 3: Availability And Booking Loop

Implement merchant technicians, weekly availability, blocked time, price/time rules, slot recommendation, and appointment creation with conflict checks.

Outcome: a customer can choose a valid slot and create a booking.

### Slice 4: Merchant Calendar Loop

Implement merchant month/day calendar, booking details, manual booking, and blocked-time creation.

Outcome: the merchant can see and manage the booking created by the customer flow.

## Testing And Evaluation

Sprint 1 should include focused tests for the system invariants:

1. AI output schema validation.
2. Pricing rule calculation.
3. Quote snapshot and rule-version behavior.
4. Availability conflict exclusion.
5. Appointment conflict re-check.
6. Merchant blocked time and manual booking conflicts.
7. One customer-to-merchant happy path.

Do not claim improved AI accuracy without a small eval set or clear demo evidence. For Sprint 1, the minimum acceptable evidence is a small set of representative nail images that exercise normal analysis, fallback recovery, and user correction.

## Locked Assumptions

1. The product remains one-shop, multiple-technician for Sprint 1.
2. The customer flow leads, but merchant configuration and calendar control are required.
3. Real image model output is required; pure mock AI is not enough for our system plan.
4. The image model extracts attributes only. Deterministic rules calculate price, duration, and availability.
5. Merchant manual booking and blocked unavailable time are Sprint 1 scope.
6. Deferred scope stays documented and should be revisited after the first end-to-end loop works.
