# Nailed-it Frontend Design Spec

Date: 2026-05-23
Branch: frontend
Source PRD: `/Users/bytedance/Downloads/前端设计PRD 1.0.pdf`

## Goal

Build a mobile-first Next.js web product for Nailed-it that demonstrates the core B2B2C nail booking loop:

1. A customer discovers nail styles.
2. The customer uploads a reference image.
3. Mock AI recognition decomposes the design.
4. The customer edits the decomposition and sees live price/time estimates.
5. The customer confirms an appointment.
6. A merchant configures pricing rules and reviews appointments on a calendar.

This is frontend-only work. Backend integration points must be explicit, but no real backend, authentication, database, or AI service will be implemented in this phase.

## Confirmed Scope

Deliver P0 plus key P1 workflow pages.

Included:

- Landing page with role entry and mock session routing.
- Customer home with trending nail style waterfall/grid.
- Customer style detail page.
- Customer booking page with image upload, mock AI loading, editable recognition result, and live estimate.
- Customer booking confirmation page.
- Customer profile with booking history and preference UI.
- Customer messages list and chat MVP UI.
- Merchant calendar page with monthly appointment overview.
- Merchant booking detail page.
- Merchant pricing/time rule management page.
- Merchant messages list and chat MVP UI.
- Merchant profile with analytics placeholders.
- Customer and merchant bottom tab navigation.

Excluded from this phase:

- Real login/register/auth.
- Real backend requests.
- Real AI recognition.
- Real message sending.
- AI try-on / AR.
- Style inventory management.
- Real BI dashboard.
- Automated reminders.
- Persistent localStorage mock state unless later requested.

## Technical Direction

Use Next.js with TypeScript and App Router.

The app should be mobile-first and behave like an H5 product rather than a marketing site. Server-side rendering is not a primary goal; Next.js is used for route organization, future API compatibility, and maintainable project structure.

## Product Architecture

Routes:

```text
/
  Landing / role entry

/customer/home
/customer/style/[id]
/customer/booking
/customer/booking/confirm
/customer/messages
/customer/messages/[conversationId]
/customer/profile

/merchant/calendar
/merchant/booking/[id]
/merchant/manage
/merchant/messages
/merchant/messages/[conversationId]
/merchant/profile
```

Suggested source layout:

```text
src/app
  Next.js route files and route-level layout composition

src/components
  Shared UI components with no role-specific business logic

src/features
  Customer and merchant feature components

src/domain
  Shared business types, pricing calculation, and contracts

src/mock
  Mock styles, bookings, conversations, AI results, and pricing rules

src/lib
  Small utilities, session helpers, route helpers, formatting helpers
```

The important boundary is that page components should not own pricing rules or mock business data. Pages should compose feature components, feature components should call domain helpers, and mock data should live behind a small replacement-friendly layer.

## Visual Direction

Use a refined nail studio style:

- Mobile-first layout.
- Clean white base.
- Soft rose / blush accents.
- Graphite text for professional contrast.
- Low-saturation surfaces.
- Cards at 8px radius or less unless a component needs a different platform convention.
- Customer screens may use richer image density.
- Merchant screens should be calmer, denser, and optimized for scanning.

Do not build a marketing landing page. The first screen should immediately support role selection and product entry.

## Shared Components

Shared UI:

```text
MobileLayout
TopBar
BottomTabBar
Button
ChipButton
BottomSheet
Toast
ImageUploader
Avatar
EmptyState
LoadingState
```

Customer feature components:

```text
StyleWaterfallGrid
StyleCard
StyleDetailPanel
AIRecognitionPanel
NailAttributeEditor
PriceEstimateBar
BookingTimeSelector
BookingHistoryCard
```

Merchant feature components:

```text
MonthlyCalendar
BookingDaySheet
BookingListCard
PricingRuleCard
DurationSlider
MerchantAnalyticsCard
ConversationListItem
ChatRoom
```

Components should be small and single-purpose. If a component starts combining data loading, editing state, display, and navigation, split it before it becomes a hidden workflow controller.

## Data Contracts

Core style card:

```ts
export type NailStyleCard = {
  id: string;
  imageUrl: string;
  title: string;
  tags: string[];
  estimatedPrice: number;
  estimatedDuration: number;
  popularityScore: number;
};
```

AI recognition result:

```ts
export type AIRecognitionResult = {
  removal: boolean;
  extension: boolean;
  builderGel: boolean;
  nailShape: NailShape;
  styles: string[];
  otherNotes: string;
  confidence: number;
  estimatedPrice: number;
  estimatedDuration: number;
};
```

Pricing rule item:

```ts
export type PricingItem = {
  id: string;
  category: 'base' | 'shape' | 'style' | 'addon';
  name: string;
  price: number;
  duration: number;
  enabled: boolean;
};
```

These contracts should be placed in the domain layer so future API clients and UI components use the same shape.

## State And Mock Data

Use local in-memory state plus centralized mock files.

Expected behavior:

- Refreshing the browser resets mock state.
- Merchant pricing edits may affect customer estimate calculations during the current session.
- Mock data should not be scattered inside route files or low-level UI components.
- Backend replacement should primarily touch mock/service boundaries, not every page.

This deliberately avoids localStorage persistence for the first version. The goal is a clean frontend contract, not fake persistence that later needs migration and invalidation rules.

## Customer Workflow

Customer booking flow:

```text
Upload image
-> show preview
-> click smart recognition
-> show mock AI loading state
-> open/edit AI result in a mobile bottom sheet
-> recalculate price and duration with calculateEstimate()
-> show fixed estimate action area
-> continue to booking confirmation
-> select mock date/time
-> confirm appointment and show toast/success state
```

The AI result editor should support:

- Removal: none / yes.
- Extension: none / yes.
- Builder gel: none / yes.
- Nail shape chips.
- Multi-select style chips.
- Other notes free text.

The estimate area should update when the user changes recognition attributes.

## Merchant Workflow

Merchant management flow:

```text
Open manage tab
-> view grouped pricing rules
-> edit price and duration
-> toggle rule enabled/disabled
-> save price list
-> show toast confirming that rules will be used for customer estimates
```

Merchant calendar flow:

```text
Open calendar tab
-> view current month grid
-> each date shows booking count / status indicator
-> tap a date
-> bottom sheet lists appointments for that day
-> tap appointment
-> open booking detail page
```

Merchant booking detail should expose status controls as UI only:

```text
pending
confirmed
in_progress
completed
cancelled
```

## API Placeholders

Do not call these endpoints yet. Keep the route/service boundaries compatible with replacing mock data later.

```text
GET  /api/styles/trending
GET  /api/styles/:id
POST /api/ai/recognize-nail-style
GET  /api/merchant/pricing-rules
PUT  /api/merchant/pricing-rules
GET  /api/bookings
POST /api/bookings
GET  /api/conversations
POST /api/messages
```

## Error And Empty States

Implement visible UI states for:

- No uploaded image.
- Upload preview ready.
- AI recognition loading.
- Recognition result ready.
- No available appointment times.
- Empty message list.
- Empty calendar day.
- Pricing save confirmation.
- Booking confirmation success.

Complex failure simulation is not required in this phase. However, components should have a place to render future error messages instead of swallowing failures silently.

## Testing Strategy

Use focused tests where risk is highest.

Required:

- Unit tests for `calculateEstimate()`.
- Unit tests for pricing rules enabled/disabled behavior.
- Unit tests showing user edits to removal, extension, builder gel, shape, and style affect price/duration.

Recommended:

- Smoke tests for role entry navigation.
- Smoke tests for the customer booking flow.
- Smoke tests for merchant pricing edit and save feedback.

Manual mobile QA:

- Verify common mobile viewport widths.
- Verify no text overflow in buttons, tabs, cards, or bottom sheets.
- Verify fixed bottom bars do not cover important content.
- Verify the bottom sheet can scroll and action buttons remain reachable.
- Verify customer and merchant tabs navigate correctly.

## Documentation Updates During Implementation

When implementation begins, update:

- `docs/architecture/current-state.md` after the frontend architecture is created.
- `docs/changes/implementation-log.md` after meaningful implementation milestones.

If a major architectural decision is introduced beyond this spec, add an ADR under `docs/decisions/`.

## Acceptance Criteria

The implementation is done when:

- `npm run dev` starts the Next.js app.
- The product is usable at mobile width.
- All included P0 plus key P1 routes exist and are navigable.
- Customer booking can complete the mock AI estimate and booking confirmation path.
- Merchant can view calendar appointments and edit pricing rules.
- Data contracts, mock data, and pricing calculation are centralized.
- Backend API replacement points are clear.
- Relevant domain logic has tests.
- Architecture and implementation docs are updated.
- No unrelated user changes are reverted.
