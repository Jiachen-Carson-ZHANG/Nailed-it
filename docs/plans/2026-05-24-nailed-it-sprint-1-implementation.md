# Nailed-it Sprint 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Sprint 1 customer-to-merchant loop: merchant sets rules, customer gets an AI-assisted quote, customer books a valid slot, and merchant sees/manages it in calendar.

**Architecture:** Create a mobile-first Next.js app with pure domain engines for pricing, availability, booking, and AI result normalization. The image model extracts nail attributes only; deterministic rules calculate price, duration, slots, and conflicts. Keep frontend screens aligned with the Lark frontend PRD while exposing stable API contracts so mock UI can be replaced by real backend behavior.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, Prisma, SQLite for local/demo persistence, Zod for validation, Vitest for domain tests, Playwright for one smoke path.

---

## Pre-Flight Rules

1. Start from the current repo root: `/home/tough/Nailed-it`.
2. Do not stage or revert unrelated existing changes in `AGENTS.md`, `CLAUDE.md`, `graphify-out/*`, or `scripts/graphify-out/`.
3. Keep the design doc as source of truth: `docs/plans/2026-05-24-nailed-it-sprint-1-design.md`.
4. Use TDD for domain rules before UI wiring.
5. Commit after each task or small task group.

Run before starting:

```bash
git status --short
```

Expected: unrelated dirty files may exist. Only stage files created or modified by the implementation task.

---

## Task 1: Scaffold The App Shell

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `eslint.config.mjs`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `.env.local.example`

**Step 1: Create package/tooling files**

Use these dependencies unless a newer scaffold already exists:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@prisma/client": "latest",
    "clsx": "latest",
    "date-fns": "latest",
    "lucide-react": "latest",
    "next": "latest",
    "react": "latest",
    "react-dom": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@playwright/test": "latest",
    "@tailwindcss/postcss": "latest",
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "eslint": "latest",
    "eslint-config-next": "latest",
    "prisma": "latest",
    "tailwindcss": "latest",
    "tsx": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

**Step 2: Create the initial mobile shell**

`src/app/page.tsx` should render a minimal role entry page:

```tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <div className="space-y-6">
        <div>
          <p className="text-sm text-neutral-500">AI Nail Booking Assistant</p>
          <h1 className="text-3xl font-semibold tracking-normal">Nailed-it</h1>
          <p className="mt-2 text-neutral-600">
            Upload a nail design, get an editable quote, and book a real salon slot.
          </p>
        </div>
        <div className="grid gap-3">
          <Link className="rounded-md bg-neutral-950 px-4 py-3 text-center text-white" href="/customer/home">
            I am a customer
          </Link>
          <Link className="rounded-md border border-neutral-300 px-4 py-3 text-center" href="/merchant/calendar">
            I am a merchant
          </Link>
        </div>
      </div>
    </main>
  );
}
```

**Step 3: Add env example**

`.env.local.example`:

```bash
DATABASE_URL="file:./dev.db"
VISION_MODEL_PROVIDER="openai"
VISION_MODEL_NAME=""
OPENAI_API_KEY=""
```

**Step 4: Install and verify**

Run:

```bash
pnpm install
pnpm build
```

Expected: dependencies install and the starter app builds.

**Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs src/app .env.local.example
git commit -m "chore: scaffold nailed-it app shell"
```

---

## Task 2: Define Domain Types And Seed Data

**Files:**
- Create: `src/lib/domain/types.ts`
- Create: `src/lib/domain/seed.ts`
- Create: `src/lib/domain/status.ts`
- Test: `src/lib/domain/types.test.ts`

**Step 1: Write a small type safety test**

```ts
import { describe, expect, it } from "vitest";
import { seedPricingRules, seedTechnicians } from "./seed";

describe("seed domain data", () => {
  it("has enabled pricing rules with duration and price", () => {
    expect(seedPricingRules.every((rule) => rule.enabled)).toBe(true);
    expect(seedPricingRules.every((rule) => rule.priceCents >= 0)).toBe(true);
    expect(seedPricingRules.every((rule) => rule.durationMinutes >= 0)).toBe(true);
  });

  it("starts with multiple technicians for one shop", () => {
    expect(seedTechnicians).toHaveLength(3);
    expect(new Set(seedTechnicians.map((tech) => tech.shopId)).size).toBe(1);
  });
});
```

**Step 2: Implement `types.ts`**

Define these minimum exported types:

```ts
export type ServiceCategory = "base" | "shape" | "style" | "addon";
export type AppointmentStatus = "pending" | "confirmed" | "completed" | "cancelled";

export type ServiceBlock = {
  key: string;
  label: string;
  category: ServiceCategory;
  quantity: number;
  uncertain?: boolean;
};

export type PriceRule = {
  id: string;
  shopId: string;
  key: string;
  label: string;
  category: ServiceCategory;
  priceCents: number;
  durationMinutes: number;
  enabled: boolean;
  version: number;
};

export type Technician = {
  id: string;
  shopId: string;
  name: string;
  active: boolean;
};

export type TimeInterval = {
  start: Date;
  end: Date;
};

export type WorkingPlan = {
  id: string;
  technicianId: string;
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
};

export type BlockedTime = TimeInterval & {
  id: string;
  technicianId: string;
  reason?: string;
};
```

**Step 3: Implement `seed.ts`**

Seed one shop, three technicians, realistic nail rules, working plans, and style cards. Include keys from the frontend PRD: `removal`, `extension`, `builderGel`, `almond`, `solid`, `french`, `catEye`, `gradient`, `handPainted`, `rhinestone`.

**Step 4: Run test**

```bash
pnpm test src/lib/domain/types.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/domain
git commit -m "feat: define nailed-it domain seeds"
```

---

## Task 3: Build Pricing Engine

**Files:**
- Create: `src/lib/domain/pricing.ts`
- Test: `src/lib/domain/pricing.test.ts`

**Step 1: Write failing tests**

Cover:

1. Matching service blocks to enabled merchant rules.
2. Quantity multiplication.
3. Unknown attributes becoming warning items, not crashes.
4. Customer estimate can be total or range-ready.
5. Merchant breakdown preserves line items.

Example:

```ts
import { describe, expect, it } from "vitest";
import { priceServiceBlocks } from "./pricing";
import { seedPricingRules } from "./seed";

describe("priceServiceBlocks", () => {
  it("calculates price and duration from merchant rules", () => {
    const quote = priceServiceBlocks({
      shopId: "shop_demo",
      serviceBlocks: [
        { key: "extension", label: "Extension", category: "base", quantity: 1 },
        { key: "builderGel", label: "Builder gel", category: "base", quantity: 1 },
        { key: "catEye", label: "Cat-eye", category: "style", quantity: 1 },
        { key: "rhinestone", label: "Rhinestones", category: "addon", quantity: 2 }
      ],
      rules: seedPricingRules
    });

    expect(quote.totalDurationMinutes).toBeGreaterThan(0);
    expect(quote.totalPriceCents).toBeGreaterThan(0);
    expect(quote.lineItems).toHaveLength(4);
    expect(quote.ruleVersion).toBeGreaterThan(0);
  });
});
```

**Step 2: Implement minimal pricing**

`priceServiceBlocks()` should return:

```ts
type QuoteBreakdown = {
  lineItems: Array<{
    key: string;
    label: string;
    quantity: number;
    unitPriceCents: number;
    unitDurationMinutes: number;
    totalPriceCents: number;
    totalDurationMinutes: number;
    ruleId?: string;
    warning?: string;
  }>;
  totalPriceCents: number;
  totalDurationMinutes: number;
  ruleVersion: number;
  warnings: string[];
};
```

Unknown service blocks should add a warning and zero-price line item so the user can still continue after editing.

**Step 3: Run tests**

```bash
pnpm test src/lib/domain/pricing.test.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/lib/domain/pricing.ts src/lib/domain/pricing.test.ts
git commit -m "feat: add merchant pricing engine"
```

---

## Task 4: Build Availability Engine

**Files:**
- Create: `src/lib/domain/availability.ts`
- Test: `src/lib/domain/availability.test.ts`

**Step 1: Write failing tests**

Cover:

1. Working plan creates slots.
2. Existing appointment removes overlapping slots.
3. Blocked time removes overlapping slots.
4. Results are sorted by earliest start.
5. Slots include technician id and wait ranking.

Example:

```ts
import { describe, expect, it } from "vitest";
import { findAvailableSlots } from "./availability";

describe("findAvailableSlots", () => {
  it("excludes blocked intervals and ranks by earliest start", () => {
    const date = new Date("2026-06-01T00:00:00+08:00");
    const slots = findAvailableSlots({
      date,
      durationMinutes: 90,
      technicians: [{ id: "tech_1", shopId: "shop_demo", name: "Amy", active: true }],
      workingPlans: [{ id: "wp_1", technicianId: "tech_1", dayOfWeek: 1, startMinutes: 600, endMinutes: 1080 }],
      appointments: [{ id: "appt_1", technicianId: "tech_1", start: new Date("2026-06-01T10:00:00+08:00"), end: new Date("2026-06-01T11:30:00+08:00") }],
      blockedTimes: [],
      slotStepMinutes: 30,
      bufferMinutes: 0
    });

    expect(slots[0].start.toISOString()).toContain("03:30:00.000Z");
  });
});
```

**Step 2: Implement overlap-safe availability**

Core helpers:

```ts
export function overlaps(a: TimeInterval, b: TimeInterval) {
  return a.start < b.end && b.start < a.end;
}
```

`findAvailableSlots()` should generate same-day candidate starts from working plans, then exclude candidates overlapping appointments or blocked time. Sort by earliest start.

**Step 3: Run tests**

```bash
pnpm test src/lib/domain/availability.test.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/lib/domain/availability.ts src/lib/domain/availability.test.ts
git commit -m "feat: add availability engine"
```

---

## Task 5: Build Quote Snapshot And Booking Rules

**Files:**
- Create: `src/lib/domain/booking.ts`
- Test: `src/lib/domain/booking.test.ts`

**Step 1: Write failing tests**

Cover:

1. Booking requires a quote snapshot.
2. Booking re-checks conflicts before creation.
3. Manual merchant bookings use the same conflict check.
4. Cancelled appointments do not block future slots.
5. Valid statuses are `pending`, `confirmed`, `completed`, `cancelled`.

**Step 2: Implement booking helpers**

Minimum functions:

```ts
export function canCreateAppointment(input: {
  technicianId: string;
  start: Date;
  end: Date;
  existingAppointments: Array<{ technicianId: string; start: Date; end: Date; status: string }>;
  blockedTimes: Array<{ technicianId: string; start: Date; end: Date }>;
}): { ok: true } | { ok: false; reason: string };

export function createAppointmentDraft(input: {
  quoteId: string;
  customerId: string;
  technicianId: string;
  start: Date;
  end: Date;
}) {
  return {
    id: crypto.randomUUID(),
    quoteId: input.quoteId,
    customerId: input.customerId,
    technicianId: input.technicianId,
    start: input.start,
    end: input.end,
    status: "pending" as const
  };
}
```

**Step 3: Run tests**

```bash
pnpm test src/lib/domain/booking.test.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/lib/domain/booking.ts src/lib/domain/booking.test.ts
git commit -m "feat: add booking conflict rules"
```

---

## Task 6: Add Prisma Persistence

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma/seed.ts`
- Create: `src/lib/db.ts`
- Create: `src/lib/repositories/shop-repository.ts`
- Create: `src/lib/repositories/booking-repository.ts`
- Test: `src/lib/repositories/booking-repository.test.ts`

**Step 1: Define schema**

Include models:

1. `Shop`
2. `Technician`
3. `Customer`
4. `NailStyle`
5. `PriceRule`
6. `WorkingPlan`
7. `BlockedTime`
8. `AIAnalysis`
9. `Quote`
10. `Appointment`

Keep JSON fields only for snapshots that should preserve historical context, such as quote line items and AI attributes.

**Step 2: Generate and migrate**

```bash
pnpm db:generate
pnpm db:migrate --name init
pnpm db:seed
```

Expected: Prisma client generated, local SQLite DB created, seed data inserted.

**Step 3: Repository test**

Write a test that creates a quote and appointment, then loads merchant calendar data for the appointment day.

**Step 4: Run tests**

```bash
pnpm test src/lib/repositories/booking-repository.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add prisma src/lib/db.ts src/lib/repositories
git commit -m "feat: add prisma persistence for bookings"
```

---

## Task 7: Implement AI Recognition Adapter And Fallback

**Files:**
- Create: `src/lib/ai/nail-schema.ts`
- Create: `src/lib/ai/image-quality.ts`
- Create: `src/lib/ai/nail-recognition.ts`
- Create: `src/lib/ai/recovery.ts`
- Test: `src/lib/ai/nail-recognition.test.ts`

**Step 1: Write schema tests**

Use Zod to validate a normalized result:

```ts
import { describe, expect, it } from "vitest";
import { normalizeNailRecognition } from "./nail-recognition";

describe("normalizeNailRecognition", () => {
  it("turns model output into service blocks", () => {
    const result = normalizeNailRecognition({
      removal: false,
      extension: true,
      builderGel: true,
      nailShape: "almond",
      styles: ["catEye", "rhinestone"],
      otherNotes: "pink cat-eye with partial rhinestones",
      confidence: 0.86
    });

    expect(result.serviceBlocks.map((block) => block.key)).toEqual([
      "extension",
      "builderGel",
      "almond",
      "catEye",
      "rhinestone"
    ]);
  });
});
```

**Step 2: Implement image model boundary**

Create one exported function:

```ts
export async function recognizeNailStyle(input: {
  imageBase64: string;
  mimeType: string;
}): Promise<{
  serviceBlocks: ServiceBlock[];
  confidence: number;
  warnings: string[];
  recoveryUsed: boolean;
  rawModelOutput?: unknown;
}>;
```

Rules:

1. First run the normal image-model call.
2. If confidence is high enough, return.
3. If confidence is medium/low or quality check is weak, run one recovery pass.
4. Recovery pass should crop/zoom/enhance only if a practical library is added; otherwise implement the fallback interface with a deterministic no-op enhancer and one retry hook.
5. Never let the AI return final price or final duration.

**Step 3: Provider behavior**

If `OPENAI_API_KEY` and `VISION_MODEL_NAME` are configured, call the real vision provider. If missing, return a clear `missing_vision_config` error for production routes. For tests, inject a fake provider.

Before implementing provider-specific request details, check current official provider docs. Do not guess the request shape from memory.

**Step 4: Run tests**

```bash
pnpm test src/lib/ai/nail-recognition.test.ts
```

Expected: PASS using fake provider.

**Step 5: Commit**

```bash
git add src/lib/ai
git commit -m "feat: add nail recognition adapter"
```

---

## Task 8: Add API Routes

**Files:**
- Create: `src/app/api/styles/trending/route.ts`
- Create: `src/app/api/styles/[id]/route.ts`
- Create: `src/app/api/ai/recognize-nail-style/route.ts`
- Create: `src/app/api/quotes/route.ts`
- Create: `src/app/api/availability/route.ts`
- Create: `src/app/api/appointments/route.ts`
- Create: `src/app/api/merchant/pricing-rules/route.ts`
- Create: `src/app/api/merchant/calendar/route.ts`
- Create: `src/app/api/merchant/manual-bookings/route.ts`
- Create: `src/app/api/merchant/blocked-times/route.ts`
- Test: `src/app/api/api-contracts.test.ts`

**Step 1: Write contract tests**

Use direct handler-level tests or repository-backed tests. Cover:

1. Trending styles return array of cards.
2. Quote route returns customer estimate and merchant breakdown.
3. Availability route returns sorted slots.
4. Appointment route re-checks conflict.

**Step 2: Implement route handlers**

Use Zod request parsing. Return consistent shape:

```ts
type ApiOk<T> = { ok: true; data: T };
type ApiError = { ok: false; error: { code: string; message: string } };
```

**Step 3: Run tests**

```bash
pnpm test src/app/api/api-contracts.test.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/app/api
git commit -m "feat: add sprint one api contracts"
```

---

## Task 9: Build Customer UI Flow

**Files:**
- Create: `src/components/mobile-shell.tsx`
- Create: `src/components/bottom-tab-bar.tsx`
- Create: `src/components/style-card.tsx`
- Create: `src/components/image-uploader.tsx`
- Create: `src/components/nail-attribute-editor.tsx`
- Create: `src/components/price-estimate-card.tsx`
- Create: `src/components/booking-time-selector.tsx`
- Create: `src/app/customer/home/page.tsx`
- Create: `src/app/customer/style/[id]/page.tsx`
- Create: `src/app/customer/booking/page.tsx`
- Create: `src/app/customer/booking/confirm/page.tsx`

**Step 1: Build layout components**

Implement a mobile-width shell with top logo and bottom tabs matching frontend PRD:

Customer tabs: Home, Booking, Messages, Profile.

Use lucide icons for tab icons.

**Step 2: Build style discovery**

`/customer/home` renders waterfall-like responsive cards using seeded styles.

**Step 3: Build booking flow**

`/customer/booking` supports:

1. Image upload preview.
2. Recognize button.
3. Loading state.
4. Editable bottom-sheet-style attribute panel.
5. Customer estimate summary.
6. Continue to slot selection.

**Step 4: Build confirmation page**

`/customer/booking/confirm` fetches availability, lets the user pick a slot, and posts appointment creation.

**Step 5: Verify manually**

Run:

```bash
pnpm dev
```

Open `/customer/home` and `/customer/booking`.

Expected: mobile flow works with seeded/mock data and real route calls where available.

**Step 6: Commit**

```bash
git add src/components src/app/customer
git commit -m "feat: build customer booking flow"
```

---

## Task 10: Build Merchant UI Flow

**Files:**
- Create: `src/components/monthly-calendar.tsx`
- Create: `src/components/booking-day-sheet.tsx`
- Create: `src/components/pricing-rule-card.tsx`
- Create: `src/components/technician-availability-form.tsx`
- Create: `src/components/blocked-time-form.tsx`
- Create: `src/app/merchant/calendar/page.tsx`
- Create: `src/app/merchant/booking/[id]/page.tsx`
- Create: `src/app/merchant/manage/page.tsx`
- Create: `src/app/merchant/messages/page.tsx`
- Create: `src/app/merchant/profile/page.tsx`

**Step 1: Build merchant tabs**

Merchant tabs: Calendar, Management, Messages, Profile.

**Step 2: Build pricing management**

`/merchant/manage` supports:

1. Price input.
2. Duration input or slider.
3. Enabled toggle.
4. Save action through `PUT /api/merchant/pricing-rules`.

**Step 3: Build availability controls**

Add simple weekly availability and blocked-time controls. Keep complex recurring shifts out of Sprint 1.

**Step 4: Build calendar**

`/merchant/calendar` supports:

1. Month view.
2. Day booking list.
3. Booking detail link.
4. Manual booking form.
5. Block unavailable time form.

**Step 5: Verify manually**

Run:

```bash
pnpm dev
```

Open `/merchant/manage` and `/merchant/calendar`.

Expected: merchant can edit rules, see appointments, create manual booking, and block time.

**Step 6: Commit**

```bash
git add src/components src/app/merchant
git commit -m "feat: build merchant calendar and management"
```

---

## Task 11: Add End-To-End Smoke Test

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/customer-booking.spec.ts`

**Step 1: Write smoke path**

The smoke test should:

1. Open `/merchant/manage`.
2. Verify pricing rules are visible.
3. Open `/customer/booking`.
4. Upload or attach a fixture nail image.
5. Trigger recognition using a test fake provider mode.
6. Edit at least one attribute.
7. Select the earliest available slot.
8. Confirm booking.
9. Open `/merchant/calendar`.
10. Verify booking appears.

**Step 2: Add fixture mode**

Use an env var such as:

```bash
VISION_MODEL_PROVIDER="fixture"
```

This is only for deterministic e2e testing. Production/demo with real AI should use the real provider.

**Step 3: Run e2e**

```bash
pnpm test:e2e
```

Expected: one customer-to-merchant smoke path passes.

**Step 4: Commit**

```bash
git add playwright.config.ts tests/e2e
git commit -m "test: add booking smoke path"
```

---

## Task 12: Documentation And Final Verification

**Files:**
- Modify: `docs/architecture/current-state.md`
- Modify: `docs/changes/implementation-log.md`
- Optional Create: `docs/decisions/2026-05-24-ai-attributes-not-prices.md`

**Step 1: Update architecture docs**

Document:

1. Next.js app shape.
2. Domain modules.
3. AI boundary: attributes only, no direct AI price/duration.
4. Pricing, availability, and booking invariants.
5. Deferred scope.

**Step 2: Add ADR if implementation confirms the AI boundary**

ADR title:

`ADR: Image Model Extracts Attributes, Rules Calculate Business Outputs`

Decision:

AI returns nail attributes and confidence; deterministic engines calculate price, duration, and availability.

**Step 3: Append implementation log**

Include:

1. What changed.
2. Why.
3. Tradeoffs.
4. What must remain true.
5. Verification commands and results.

**Step 4: Run full verification**

```bash
pnpm test
pnpm build
pnpm test:e2e
```

Expected: all pass.

**Step 5: Commit**

```bash
git add docs/architecture/current-state.md docs/changes/implementation-log.md docs/decisions
git commit -m "docs: document nailed-it sprint one architecture"
```

---

## Acceptance Criteria

1. Customer can browse seeded styles.
2. Customer can upload/select an image and get real image-model attributes when configured.
3. Weak image/model confidence triggers at most one recovery retry.
4. Customer can edit recognized nail attributes.
5. Customer sees price and duration estimate, but not full formula by default.
6. Merchant can configure price and duration rules.
7. Merchant can configure simple availability and blocked time.
8. System recommends earliest available / shortest-wait slots.
9. Booking creation re-checks conflicts.
10. Merchant calendar shows customer and manual bookings.
11. Merchant can create manual booking and blocked time.
12. Tests cover pricing, quote snapshots, availability conflicts, booking conflicts, AI schema validation, and one e2e happy path.

## Open Execution Questions

Resolve these at execution time if not already decided:

1. Which real vision provider and model should be used for the demo environment?
2. Will frontend teammates already have a scaffolded app branch to merge, or should this repo become the app source?
3. Where will the deployed demo run, and does that environment support SQLite, or should Sprint 1 use hosted Postgres immediately?
