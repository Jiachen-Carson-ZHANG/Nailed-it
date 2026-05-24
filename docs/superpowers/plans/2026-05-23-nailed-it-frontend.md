# Nailed-it Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the mobile-first Nailed-it Next.js frontend for the approved P0 plus key P1 customer and merchant workflow.

**Architecture:** Create a Next.js App Router application with a thin route layer, shared mobile UI components, role-specific feature components, centralized domain contracts, centralized mock data, and pure pricing logic. Keep backend replacement points clear by isolating mock/service data away from page components.

**Tech Stack:** Next.js, React, TypeScript, CSS Modules or global CSS with component classes, Vitest, React Testing Library, lucide-react.

---

## Scope Notes

This plan implements the approved design spec at `docs/superpowers/specs/2026-05-23-nailed-it-frontend-design.md`.

The spec spans two roles, but the work is one coherent frontend product rather than independent subsystems because customer quote flow and merchant pricing rules share domain contracts. The plan is decomposed by vertical slices so each task produces working, testable software.

Existing unrelated modified files must not be reverted:

```text
.claude/settings.json
.codex/hooks.json
```

## Target File Structure

Create and modify these files:

```text
package.json
next.config.ts
tsconfig.json
vitest.config.ts
src/app/layout.tsx
src/app/page.tsx
src/app/globals.css
src/app/customer/home/page.tsx
src/app/customer/style/[id]/page.tsx
src/app/customer/booking/page.tsx
src/app/customer/booking/confirm/page.tsx
src/app/customer/messages/page.tsx
src/app/customer/messages/[conversationId]/page.tsx
src/app/customer/profile/page.tsx
src/app/merchant/calendar/page.tsx
src/app/merchant/booking/[id]/page.tsx
src/app/merchant/manage/page.tsx
src/app/merchant/messages/page.tsx
src/app/merchant/messages/[conversationId]/page.tsx
src/app/merchant/profile/page.tsx
src/components/ui/Button.tsx
src/components/ui/ChipButton.tsx
src/components/ui/BottomSheet.tsx
src/components/ui/Toast.tsx
src/components/ui/ImageUploader.tsx
src/components/ui/EmptyState.tsx
src/components/ui/LoadingState.tsx
src/components/layout/MobileLayout.tsx
src/components/layout/TopBar.tsx
src/components/layout/BottomTabBar.tsx
src/domain/nail.ts
src/domain/pricing.ts
src/domain/pricing.test.ts
src/domain/session.ts
src/mock/styles.ts
src/mock/pricing.ts
src/mock/bookings.ts
src/mock/conversations.ts
src/mock/ai.ts
src/features/customer/StyleCard.tsx
src/features/customer/StyleWaterfallGrid.tsx
src/features/customer/StyleDetailPanel.tsx
src/features/customer/NailAttributeEditor.tsx
src/features/customer/PriceEstimateBar.tsx
src/features/customer/BookingTimeSelector.tsx
src/features/customer/BookingHistoryCard.tsx
src/features/merchant/MonthlyCalendar.tsx
src/features/merchant/BookingDaySheet.tsx
src/features/merchant/BookingListCard.tsx
src/features/merchant/PricingRuleCard.tsx
src/features/merchant/MerchantAnalyticsCard.tsx
src/features/messages/ConversationListItem.tsx
src/features/messages/ChatRoom.tsx
docs/architecture/current-state.md
docs/changes/implementation-log.md
```

## Task 1: Scaffold Next.js, TypeScript, Vitest, And Base App Shell

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`

- [ ] **Step 1: Create package and config files**

Create `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "lucide-react": "^0.468.0",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/node": "^22.10.2",
    "@types/react": "^19.0.1",
    "@types/react-dom": "^19.0.2",
    "jsdom": "^25.0.1",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

Create `next.config.ts`:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true
};

export default nextConfig;
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `vitest.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: []
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname
    }
  }
});
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created and install exits with code 0.

- [ ] **Step 3: Create base layout and landing page**

Create `src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nailed-it',
  description: 'AI nail booking assistant'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

Create `src/app/page.tsx`:

```tsx
import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="landing-page">
      <section className="landing-hero">
        <div className="brand-mark">N</div>
        <h1>Nailed-it</h1>
        <p className="tagline">AI Nail Booking Assistant</p>
        <p className="subtitle">Upload a nail reference, get an instant style breakdown, estimate, and booking path.</p>
      </section>

      <section className="role-panel" aria-label="Choose role">
        <Link className="role-card" href="/customer/home">
          <span>Customer</span>
          <strong>Find styles and book</strong>
        </Link>
        <Link className="role-card" href="/merchant/calendar">
          <span>Merchant</span>
          <strong>Manage prices and bookings</strong>
        </Link>
      </section>
    </main>
  );
}
```

Create `src/app/globals.css` with mobile-first base styles:

```css
:root {
  --color-bg: #fffafa;
  --color-surface: #ffffff;
  --color-surface-muted: #f8f1f3;
  --color-text: #22191c;
  --color-muted: #7d6f73;
  --color-border: #eadfe2;
  --color-accent: #d9577f;
  --color-accent-strong: #b83563;
  --shadow-soft: 0 10px 30px rgba(91, 48, 61, 0.1);
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  min-height: 100%;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

a {
  color: inherit;
  text-decoration: none;
}

button,
input,
textarea,
select {
  font: inherit;
}

.landing-page {
  display: flex;
  min-height: 100vh;
  flex-direction: column;
  justify-content: center;
  gap: 28px;
  padding: 28px 20px;
}

.landing-hero {
  display: grid;
  justify-items: center;
  gap: 10px;
  text-align: center;
}

.brand-mark {
  display: grid;
  width: 52px;
  height: 52px;
  place-items: center;
  border-radius: 16px;
  background: var(--color-text);
  color: white;
  font-weight: 800;
}

.landing-hero h1 {
  margin: 0;
  font-size: 36px;
}

.tagline,
.subtitle {
  margin: 0;
}

.tagline {
  color: var(--color-accent-strong);
  font-weight: 700;
}

.subtitle {
  max-width: 320px;
  color: var(--color-muted);
  line-height: 1.45;
}

.role-panel {
  display: grid;
  gap: 12px;
}

.role-card {
  display: grid;
  gap: 4px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  padding: 18px;
  box-shadow: var(--shadow-soft);
}

.role-card span {
  color: var(--color-muted);
  font-size: 13px;
}

.role-card strong {
  font-size: 18px;
}
```

- [ ] **Step 4: Verify scaffold**

Run:

```bash
npm run build
```

Expected: Next.js builds successfully.

Run:

```bash
npm test
```

Expected: Vitest exits successfully with no tests or with an empty suite warning that does not fail.

- [ ] **Step 5: Commit scaffold**

Run:

```bash
git add package.json package-lock.json next.config.ts tsconfig.json vitest.config.ts src/app/layout.tsx src/app/page.tsx src/app/globals.css
git commit -m "feat: scaffold mobile frontend app"
```

## Task 2: Add Domain Contracts And Pricing Tests First

**Files:**
- Create: `src/domain/nail.ts`
- Create: `src/domain/pricing.ts`
- Create: `src/domain/pricing.test.ts`

- [ ] **Step 1: Add failing pricing tests**

Create `src/domain/pricing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { calculateEstimate } from './pricing';
import type { AIRecognitionResult, PricingItem } from './nail';

const baseRecognition: AIRecognitionResult = {
  removal: false,
  extension: false,
  builderGel: false,
  nailShape: 'round',
  styles: ['solid'],
  otherNotes: '',
  confidence: 0.86,
  estimatedPrice: 0,
  estimatedDuration: 0
};

const pricingRules: PricingItem[] = [
  { id: 'base-removal', category: 'base', name: 'removal', price: 10, duration: 15, enabled: true },
  { id: 'base-extension', category: 'base', name: 'extension', price: 25, duration: 30, enabled: true },
  { id: 'base-builder-gel', category: 'base', name: 'builderGel', price: 20, duration: 20, enabled: true },
  { id: 'shape-round', category: 'shape', name: 'round', price: 0, duration: 0, enabled: true },
  { id: 'shape-almond', category: 'shape', name: 'almond', price: 5, duration: 5, enabled: true },
  { id: 'style-solid', category: 'style', name: 'solid', price: 30, duration: 40, enabled: true },
  { id: 'style-cat-eye', category: 'style', name: 'catEye', price: 50, duration: 60, enabled: true },
  { id: 'style-rhinestone', category: 'addon', name: 'rhinestone', price: 20, duration: 20, enabled: true }
];

describe('calculateEstimate', () => {
  it('calculates the base estimate from selected style and shape', () => {
    expect(calculateEstimate(baseRecognition, pricingRules)).toEqual({
      price: 30,
      duration: 40
    });
  });

  it('adds enabled base services, shape, style, and add-ons', () => {
    const recognition: AIRecognitionResult = {
      ...baseRecognition,
      removal: true,
      extension: true,
      builderGel: true,
      nailShape: 'almond',
      styles: ['catEye', 'rhinestone']
    };

    expect(calculateEstimate(recognition, pricingRules)).toEqual({
      price: 130,
      duration: 150
    });
  });

  it('ignores disabled pricing rules', () => {
    const rulesWithDisabledAddon = pricingRules.map((item) =>
      item.name === 'rhinestone' ? { ...item, enabled: false } : item
    );
    const recognition: AIRecognitionResult = {
      ...baseRecognition,
      styles: ['solid', 'rhinestone']
    };

    expect(calculateEstimate(recognition, rulesWithDisabledAddon)).toEqual({
      price: 30,
      duration: 40
    });
  });
});
```

- [ ] **Step 2: Run test and confirm failure**

Run:

```bash
npm test -- src/domain/pricing.test.ts
```

Expected: FAIL because `src/domain/pricing.ts` and `src/domain/nail.ts` do not exist.

- [ ] **Step 3: Add domain contracts**

Create `src/domain/nail.ts`:

```ts
export type UserRole = 'customer' | 'merchant';

export type NailShape = 'round' | 'square' | 'squoval' | 'oval' | 'almond' | 'coffin' | 'stiletto';

export type PricingCategory = 'base' | 'shape' | 'style' | 'addon';

export type NailStyleCard = {
  id: string;
  imageUrl: string;
  title: string;
  tags: string[];
  estimatedPrice: number;
  estimatedDuration: number;
  popularityScore: number;
};

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

export type PricingItem = {
  id: string;
  category: PricingCategory;
  name: string;
  price: number;
  duration: number;
  enabled: boolean;
};

export type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

export type Booking = {
  id: string;
  customerName: string;
  merchantName: string;
  styleTitle: string;
  styleImageUrl: string;
  date: string;
  time: string;
  price: number;
  duration: number;
  status: BookingStatus;
  notes: string;
  recognition: AIRecognitionResult;
};

export type Conversation = {
  id: string;
  participantName: string;
  participantRole: UserRole;
  avatarInitials: string;
  lastMessage: string;
  unreadCount: number;
  relatedBookingTime?: string;
  messages: ChatMessage[];
};

export type ChatMessage = {
  id: string;
  author: 'me' | 'them' | 'system';
  body: string;
  sentAt: string;
};
```

- [ ] **Step 4: Add pricing implementation**

Create `src/domain/pricing.ts`:

```ts
import type { AIRecognitionResult, PricingItem } from './nail';

export type PriceEstimate = {
  price: number;
  duration: number;
};

const baseServiceNames: Array<keyof Pick<AIRecognitionResult, 'removal' | 'extension' | 'builderGel'>> = [
  'removal',
  'extension',
  'builderGel'
];

export function calculateEstimate(recognition: AIRecognitionResult, pricingRules: PricingItem[]): PriceEstimate {
  const enabledRules = pricingRules.filter((rule) => rule.enabled);
  const selectedNames = new Set<string>();

  for (const serviceName of baseServiceNames) {
    if (recognition[serviceName]) {
      selectedNames.add(serviceName);
    }
  }

  selectedNames.add(recognition.nailShape);
  recognition.styles.forEach((styleName) => selectedNames.add(styleName));

  return enabledRules.reduce<PriceEstimate>(
    (estimate, rule) => {
      if (!selectedNames.has(rule.name)) {
        return estimate;
      }

      return {
        price: estimate.price + rule.price,
        duration: estimate.duration + rule.duration
      };
    },
    { price: 0, duration: 0 }
  );
}
```

- [ ] **Step 5: Verify pricing tests pass**

Run:

```bash
npm test -- src/domain/pricing.test.ts
```

Expected: PASS for all pricing tests.

- [ ] **Step 6: Commit domain layer**

Run:

```bash
git add src/domain/nail.ts src/domain/pricing.ts src/domain/pricing.test.ts
git commit -m "feat: add nail pricing domain"
```

## Task 3: Add Central Mock Data And Session Helpers

**Files:**
- Create: `src/domain/session.ts`
- Create: `src/mock/styles.ts`
- Create: `src/mock/pricing.ts`
- Create: `src/mock/bookings.ts`
- Create: `src/mock/conversations.ts`
- Create: `src/mock/ai.ts`

- [ ] **Step 1: Add mock style data**

Create `src/mock/styles.ts`:

```ts
import type { NailStyleCard } from '@/domain/nail';

export const trendingStyles: NailStyleCard[] = [
  {
    id: 'rose-cat-eye',
    imageUrl: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=900&q=80',
    title: 'Rose Cat Eye Shine',
    tags: ['catEye', 'rhinestone', 'sweet'],
    estimatedPrice: 98,
    estimatedDuration: 135,
    popularityScore: 96
  },
  {
    id: 'soft-french',
    imageUrl: 'https://images.unsplash.com/photo-1610992015732-2449b76344bc?auto=format&fit=crop&w=900&q=80',
    title: 'Soft Studio French',
    tags: ['french', 'commute'],
    estimatedPrice: 78,
    estimatedDuration: 100,
    popularityScore: 90
  },
  {
    id: 'almond-gradient',
    imageUrl: 'https://images.unsplash.com/photo-1607779097040-26e80aa78e66?auto=format&fit=crop&w=900&q=80',
    title: 'Almond Blush Gradient',
    tags: ['almond', 'gradient', 'blush'],
    estimatedPrice: 88,
    estimatedDuration: 120,
    popularityScore: 88
  },
  {
    id: 'minimal-solid',
    imageUrl: 'https://images.unsplash.com/photo-1599948128020-9a44505b0d1b?auto=format&fit=crop&w=900&q=80',
    title: 'Clean Daily Solid',
    tags: ['solid', 'minimal'],
    estimatedPrice: 58,
    estimatedDuration: 75,
    popularityScore: 82
  }
];

export function findStyleById(id: string): NailStyleCard | undefined {
  return trendingStyles.find((style) => style.id === id);
}
```

- [ ] **Step 2: Add pricing and AI mock data**

Create `src/mock/pricing.ts`:

```ts
import type { PricingItem } from '@/domain/nail';

export const defaultPricingRules: PricingItem[] = [
  { id: 'base-removal', category: 'base', name: 'removal', price: 10, duration: 15, enabled: true },
  { id: 'base-extension', category: 'base', name: 'extension', price: 25, duration: 30, enabled: true },
  { id: 'base-builder-gel', category: 'base', name: 'builderGel', price: 20, duration: 20, enabled: true },
  { id: 'shape-round', category: 'shape', name: 'round', price: 0, duration: 0, enabled: true },
  { id: 'shape-square', category: 'shape', name: 'square', price: 0, duration: 0, enabled: true },
  { id: 'shape-squoval', category: 'shape', name: 'squoval', price: 0, duration: 0, enabled: true },
  { id: 'shape-oval', category: 'shape', name: 'oval', price: 0, duration: 0, enabled: true },
  { id: 'shape-almond', category: 'shape', name: 'almond', price: 5, duration: 5, enabled: true },
  { id: 'shape-coffin', category: 'shape', name: 'coffin', price: 8, duration: 8, enabled: true },
  { id: 'shape-stiletto', category: 'shape', name: 'stiletto', price: 10, duration: 10, enabled: true },
  { id: 'style-solid', category: 'style', name: 'solid', price: 30, duration: 40, enabled: true },
  { id: 'style-french', category: 'style', name: 'french', price: 45, duration: 60, enabled: true },
  { id: 'style-cat-eye', category: 'style', name: 'catEye', price: 50, duration: 60, enabled: true },
  { id: 'style-gradient', category: 'style', name: 'gradient', price: 45, duration: 55, enabled: true },
  { id: 'style-hand-painted', category: 'style', name: 'handPainted', price: 70, duration: 90, enabled: true },
  { id: 'addon-rhinestone', category: 'addon', name: 'rhinestone', price: 20, duration: 20, enabled: true },
  { id: 'addon-metallic', category: 'addon', name: 'metallic', price: 18, duration: 15, enabled: true }
];
```

Create `src/mock/ai.ts`:

```ts
import type { AIRecognitionResult } from '@/domain/nail';

export const mockAIResult: AIRecognitionResult = {
  removal: false,
  extension: true,
  builderGel: true,
  nailShape: 'almond',
  styles: ['catEye', 'rhinestone'],
  otherNotes: 'Pink cat eye finish with partial rhinestone details and a soft sweet style.',
  confidence: 0.86,
  estimatedPrice: 98,
  estimatedDuration: 135
};
```

- [ ] **Step 3: Add booking and conversation mock data**

Create `src/mock/bookings.ts`:

```ts
import type { Booking } from '@/domain/nail';
import { mockAIResult } from './ai';

export const mockBookings: Booking[] = [
  {
    id: 'booking-001',
    customerName: 'Melissa Tan',
    merchantName: 'Nailed-it Studio',
    styleTitle: 'Rose Cat Eye Shine',
    styleImageUrl: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=900&q=80',
    date: '2026-05-23',
    time: '14:00',
    price: 98,
    duration: 135,
    status: 'pending',
    notes: 'Prefer a softer pink tone.',
    recognition: mockAIResult
  },
  {
    id: 'booking-002',
    customerName: 'Amy Lim',
    merchantName: 'Nailed-it Studio',
    styleTitle: 'Soft Studio French',
    styleImageUrl: 'https://images.unsplash.com/photo-1610992015732-2449b76344bc?auto=format&fit=crop&w=900&q=80',
    date: '2026-05-23',
    time: '16:00',
    price: 78,
    duration: 100,
    status: 'confirmed',
    notes: 'Keep the line thin and natural.',
    recognition: { ...mockAIResult, extension: false, builderGel: false, nailShape: 'oval', styles: ['french'] }
  },
  {
    id: 'booking-003',
    customerName: 'Zoe Wong',
    merchantName: 'Nailed-it Studio',
    styleTitle: 'Almond Blush Gradient',
    styleImageUrl: 'https://images.unsplash.com/photo-1607779097040-26e80aa78e66?auto=format&fit=crop&w=900&q=80',
    date: '2026-05-24',
    time: '11:00',
    price: 88,
    duration: 120,
    status: 'completed',
    notes: 'Short almond shape.',
    recognition: { ...mockAIResult, removal: true, extension: false, nailShape: 'almond', styles: ['gradient'] }
  }
];

export const availableSlots = [
  { label: 'Today', date: '2026-05-23', slots: ['14:00', '16:00'] },
  { label: 'Tomorrow', date: '2026-05-24', slots: ['11:00', '15:30', '18:00'] }
];
```

Create `src/mock/conversations.ts`:

```ts
import type { Conversation } from '@/domain/nail';

export const customerConversations: Conversation[] = [
  {
    id: 'conv-merchant',
    participantName: 'Nailed-it Studio',
    participantRole: 'merchant',
    avatarInitials: 'NS',
    lastMessage: 'We can keep the rhinestones subtle for your appointment.',
    unreadCount: 1,
    relatedBookingTime: 'Today 14:00',
    messages: [
      { id: 'm1', author: 'them', body: 'Hi Melissa, we reviewed your reference image.', sentAt: '13:10' },
      { id: 'm2', author: 'me', body: 'Can the rhinestones be more subtle?', sentAt: '13:12' },
      { id: 'm3', author: 'them', body: 'Yes, we can keep the rhinestones subtle for your appointment.', sentAt: '13:14' }
    ]
  }
];

export const merchantConversations: Conversation[] = [
  {
    id: 'conv-melissa',
    participantName: 'Melissa Tan',
    participantRole: 'customer',
    avatarInitials: 'MT',
    lastMessage: 'Can the rhinestones be more subtle?',
    unreadCount: 2,
    relatedBookingTime: 'Today 14:00',
    messages: customerConversations[0].messages
  },
  {
    id: 'conv-amy',
    participantName: 'Amy Lim',
    participantRole: 'customer',
    avatarInitials: 'AL',
    lastMessage: 'See you at 4pm.',
    unreadCount: 0,
    relatedBookingTime: 'Today 16:00',
    messages: [
      { id: 'a1', author: 'them', body: 'See you at 4pm.', sentAt: '10:08' },
      { id: 'a2', author: 'me', body: 'Confirmed. Thank you.', sentAt: '10:09' }
    ]
  }
];
```

- [ ] **Step 4: Add mock session helper**

Create `src/domain/session.ts`:

```ts
import type { UserRole } from './nail';

export function homePathForRole(role: UserRole): string {
  return role === 'customer' ? '/customer/home' : '/merchant/calendar';
}

export function isCustomerPath(pathname: string): boolean {
  return pathname.startsWith('/customer');
}

export function isMerchantPath(pathname: string): boolean {
  return pathname.startsWith('/merchant');
}
```

- [ ] **Step 5: Verify typecheck through build and tests**

Run:

```bash
npm run build
npm test
```

Expected: build succeeds and pricing tests pass.

- [ ] **Step 6: Commit mock data**

Run:

```bash
git add src/domain/session.ts src/mock/styles.ts src/mock/pricing.ts src/mock/bookings.ts src/mock/conversations.ts src/mock/ai.ts
git commit -m "feat: add frontend mock data"
```

## Task 4: Build Shared Mobile Layout And UI Components

**Files:**
- Create: `src/components/layout/MobileLayout.tsx`
- Create: `src/components/layout/TopBar.tsx`
- Create: `src/components/layout/BottomTabBar.tsx`
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/ChipButton.tsx`
- Create: `src/components/ui/BottomSheet.tsx`
- Create: `src/components/ui/Toast.tsx`
- Create: `src/components/ui/ImageUploader.tsx`
- Create: `src/components/ui/EmptyState.tsx`
- Create: `src/components/ui/LoadingState.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add shared UI components**

Create `src/components/ui/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
};

export function Button({ children, className = '', variant = 'primary', ...props }: ButtonProps) {
  return (
    <button className={`button button-${variant} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
```

Create `src/components/ui/ChipButton.tsx`:

```tsx
type ChipButtonProps = {
  label: string;
  selected: boolean;
  onClick: () => void;
};

export function ChipButton({ label, selected, onClick }: ChipButtonProps) {
  return (
    <button className={selected ? 'chip chip-selected' : 'chip'} type="button" onClick={onClick}>
      {label}
    </button>
  );
}
```

Create `src/components/ui/EmptyState.tsx`:

```tsx
export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <section className="empty-state">
      <strong>{title}</strong>
      <p>{body}</p>
    </section>
  );
}
```

Create `src/components/ui/LoadingState.tsx`:

```tsx
export function LoadingState({ title, body }: { title: string; body: string }) {
  return (
    <section className="loading-state" aria-live="polite">
      <span className="loading-dot" />
      <strong>{title}</strong>
      <p>{body}</p>
    </section>
  );
}
```

- [ ] **Step 2: Add overlay and upload components**

Create `src/components/ui/BottomSheet.tsx`:

```tsx
import type { ReactNode } from 'react';

type BottomSheetProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
};

export function BottomSheet({ open, title, children, onClose }: BottomSheetProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="sheet-backdrop" role="presentation">
      <section className="bottom-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-header">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </section>
    </div>
  );
}
```

Create `src/components/ui/Toast.tsx`:

```tsx
export function Toast({ message }: { message: string }) {
  if (!message) {
    return null;
  }

  return (
    <div className="toast" role="status">
      {message}
    </div>
  );
}
```

Create `src/components/ui/ImageUploader.tsx`:

```tsx
import { Upload } from 'lucide-react';

type ImageUploaderProps = {
  imageUrl: string;
  onMockUpload: () => void;
};

export function ImageUploader({ imageUrl, onMockUpload }: ImageUploaderProps) {
  return (
    <section className="image-uploader">
      {imageUrl ? <img src={imageUrl} alt="Uploaded nail reference" /> : <Upload aria-hidden="true" />}
      <button type="button" onClick={onMockUpload}>
        {imageUrl ? 'Change reference' : 'Upload or take photo'}
      </button>
    </section>
  );
}
```

- [ ] **Step 3: Add layout components**

Create `src/components/layout/TopBar.tsx`:

```tsx
import Link from 'next/link';

export function TopBar({ title = 'Nailed-it' }: { title?: string }) {
  return (
    <header className="top-bar">
      <Link className="top-brand" href="/">
        {title}
      </Link>
    </header>
  );
}
```

Create `src/components/layout/BottomTabBar.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { CalendarDays, Home, MessageCircle, Settings, UserRound, WandSparkles } from 'lucide-react';
import { usePathname } from 'next/navigation';
import type { UserRole } from '@/domain/nail';

const customerTabs = [
  { href: '/customer/home', label: 'Home', icon: Home },
  { href: '/customer/booking', label: 'Book', icon: WandSparkles },
  { href: '/customer/messages', label: 'Messages', icon: MessageCircle },
  { href: '/customer/profile', label: 'Me', icon: UserRound }
];

const merchantTabs = [
  { href: '/merchant/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/merchant/manage', label: 'Manage', icon: Settings },
  { href: '/merchant/messages', label: 'Messages', icon: MessageCircle },
  { href: '/merchant/profile', label: 'Me', icon: UserRound }
];

export function BottomTabBar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const tabs = role === 'customer' ? customerTabs : merchantTabs;

  return (
    <nav className="bottom-tab-bar" aria-label={`${role} navigation`}>
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link key={href} className={active ? 'tab-item tab-item-active' : 'tab-item'} href={href}>
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

Create `src/components/layout/MobileLayout.tsx`:

```tsx
import type { ReactNode } from 'react';
import type { UserRole } from '@/domain/nail';
import { BottomTabBar } from './BottomTabBar';
import { TopBar } from './TopBar';

type MobileLayoutProps = {
  role: UserRole;
  children: ReactNode;
};

export function MobileLayout({ role, children }: MobileLayoutProps) {
  return (
    <div className="mobile-shell">
      <TopBar />
      <main className="mobile-content">{children}</main>
      <BottomTabBar role={role} />
    </div>
  );
}
```

- [ ] **Step 4: Extend global styles for shell and UI**

Append to `src/app/globals.css`:

```css
.mobile-shell {
  min-height: 100vh;
  max-width: 430px;
  margin: 0 auto;
  background: var(--color-bg);
}

.top-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: grid;
  height: 56px;
  place-items: center;
  border-bottom: 1px solid var(--color-border);
  background: rgba(255, 250, 250, 0.92);
  backdrop-filter: blur(12px);
}

.top-brand {
  font-weight: 800;
}

.mobile-content {
  min-height: calc(100vh - 120px);
  padding: 16px 16px 92px;
}

.bottom-tab-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 20;
  display: grid;
  max-width: 430px;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  margin: 0 auto;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
  padding: 8px 10px max(8px, env(safe-area-inset-bottom));
}

.tab-item {
  display: grid;
  justify-items: center;
  gap: 3px;
  color: var(--color-muted);
  font-size: 11px;
}

.tab-item-active {
  color: var(--color-accent-strong);
  font-weight: 700;
}

.button {
  min-height: 44px;
  border: 0;
  border-radius: 8px;
  padding: 0 16px;
  font-weight: 700;
}

.button-primary {
  background: var(--color-accent);
  color: white;
}

.button-secondary {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
}

.button-ghost {
  background: transparent;
  color: var(--color-accent-strong);
}

.chip {
  min-height: 36px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  padding: 0 14px;
  color: var(--color-muted);
}

.chip-selected {
  border-color: var(--color-accent);
  background: #fbe8ef;
  color: var(--color-accent-strong);
  font-weight: 700;
}

.sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  align-items: end;
  background: rgba(34, 25, 28, 0.26);
}

.bottom-sheet {
  max-height: 82vh;
  overflow: hidden;
  border-radius: 18px 18px 0 0;
  background: var(--color-surface);
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--color-border);
  padding: 14px 16px;
}

.sheet-header h2 {
  margin: 0;
  font-size: 18px;
}

.sheet-body {
  max-height: calc(82vh - 58px);
  overflow-y: auto;
  padding: 16px;
}

.toast {
  position: fixed;
  right: 16px;
  bottom: 88px;
  left: 16px;
  z-index: 50;
  max-width: 398px;
  margin: 0 auto;
  border-radius: 8px;
  background: var(--color-text);
  color: white;
  padding: 12px 14px;
  text-align: center;
}

.image-uploader,
.empty-state,
.loading-state {
  display: grid;
  justify-items: center;
  gap: 12px;
  border: 1px dashed var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  padding: 20px;
  text-align: center;
}

.image-uploader img {
  width: 100%;
  max-height: 260px;
  border-radius: 8px;
  object-fit: cover;
}

.loading-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--color-accent);
  animation: pulse 1s infinite ease-in-out;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.35;
  }
  50% {
    opacity: 1;
  }
}
```

- [ ] **Step 5: Verify shared UI compiles**

Run:

```bash
npm run build
npm test
```

Expected: build succeeds and pricing tests pass.

- [ ] **Step 6: Commit shared UI**

Run:

```bash
git add src/components src/app/globals.css
git commit -m "feat: add mobile UI shell"
```

## Task 5: Implement Customer Discovery And Style Detail

**Files:**
- Create: `src/features/customer/StyleCard.tsx`
- Create: `src/features/customer/StyleWaterfallGrid.tsx`
- Create: `src/features/customer/StyleDetailPanel.tsx`
- Create: `src/app/customer/home/page.tsx`
- Create: `src/app/customer/style/[id]/page.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add style card and grid components**

Create `src/features/customer/StyleCard.tsx`:

```tsx
import Link from 'next/link';
import type { NailStyleCard } from '@/domain/nail';

export function StyleCard({ style }: { style: NailStyleCard }) {
  return (
    <Link className="style-card" href={`/customer/style/${style.id}`}>
      <img src={style.imageUrl} alt={style.title} />
      <div className="style-card-body">
        <h2>{style.title}</h2>
        <div className="tag-row">
          {style.tags.slice(0, 3).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <p>
          SGD {style.estimatedPrice} · {style.estimatedDuration} min
        </p>
      </div>
    </Link>
  );
}
```

Create `src/features/customer/StyleWaterfallGrid.tsx`:

```tsx
import type { NailStyleCard } from '@/domain/nail';
import { StyleCard } from './StyleCard';

export function StyleWaterfallGrid({ styles }: { styles: NailStyleCard[] }) {
  return (
    <section className="style-grid" aria-label="Trending nail styles">
      {styles.map((style) => (
        <StyleCard key={style.id} style={style} />
      ))}
    </section>
  );
}
```

- [ ] **Step 2: Add customer home route**

Create `src/app/customer/home/page.tsx`:

```tsx
import { MobileLayout } from '@/components/layout/MobileLayout';
import { StyleWaterfallGrid } from '@/features/customer/StyleWaterfallGrid';
import { trendingStyles } from '@/mock/styles';

export default function CustomerHomePage() {
  return (
    <MobileLayout role="customer">
      <section className="page-heading">
        <p>Trending now</p>
        <h1>Find your next nail look</h1>
      </section>
      <StyleWaterfallGrid styles={trendingStyles} />
    </MobileLayout>
  );
}
```

- [ ] **Step 3: Add style detail component and route**

Create `src/features/customer/StyleDetailPanel.tsx`:

```tsx
import Link from 'next/link';
import type { NailStyleCard } from '@/domain/nail';

export function StyleDetailPanel({ style }: { style: NailStyleCard }) {
  return (
    <article className="style-detail">
      <img src={style.imageUrl} alt={style.title} />
      <div className="style-detail-body">
        <h1>{style.title}</h1>
        <div className="tag-row">
          {style.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <section className="estimate-card">
          <strong>AI breakdown preview</strong>
          <p>Reference estimate: SGD {style.estimatedPrice}</p>
          <p>Estimated time: {style.estimatedDuration} min</p>
        </section>
        <Link className="button-link-primary" href="/customer/booking">
          Use this style to book
        </Link>
        <Link className="button-link-secondary" href="/customer/messages">
          Ask merchant
        </Link>
      </div>
    </article>
  );
}
```

Create `src/app/customer/style/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { StyleDetailPanel } from '@/features/customer/StyleDetailPanel';
import { findStyleById } from '@/mock/styles';

export default function CustomerStyleDetailPage({ params }: { params: { id: string } }) {
  const style = findStyleById(params.id);

  if (!style) {
    notFound();
  }

  return (
    <MobileLayout role="customer">
      <StyleDetailPanel style={style} />
    </MobileLayout>
  );
}
```

- [ ] **Step 4: Add customer discovery styles**

Append to `src/app/globals.css`:

```css
.page-heading {
  display: grid;
  gap: 4px;
  margin-bottom: 16px;
}

.page-heading p,
.page-heading h1 {
  margin: 0;
}

.page-heading p {
  color: var(--color-accent-strong);
  font-size: 13px;
  font-weight: 700;
}

.page-heading h1 {
  font-size: 28px;
}

.style-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.style-card {
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  box-shadow: var(--shadow-soft);
}

.style-card img {
  width: 100%;
  aspect-ratio: 1 / 1.2;
  object-fit: cover;
}

.style-card-body,
.style-detail-body {
  display: grid;
  gap: 10px;
  padding: 12px;
}

.style-card h2,
.style-detail h1 {
  margin: 0;
}

.style-card h2 {
  font-size: 15px;
}

.style-card p,
.style-detail p {
  margin: 0;
  color: var(--color-muted);
  font-size: 13px;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-row span {
  border-radius: 999px;
  background: var(--color-surface-muted);
  color: var(--color-accent-strong);
  padding: 4px 8px;
  font-size: 11px;
}

.style-detail {
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
}

.style-detail > img {
  width: 100%;
  max-height: 360px;
  object-fit: cover;
}

.estimate-card {
  border-radius: 8px;
  background: var(--color-surface-muted);
  padding: 12px;
}

.button-link-primary,
.button-link-secondary {
  display: grid;
  min-height: 44px;
  place-items: center;
  border-radius: 8px;
  font-weight: 800;
}

.button-link-primary {
  background: var(--color-accent);
  color: white;
}

.button-link-secondary {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}
```

- [ ] **Step 5: Verify customer discovery**

Run:

```bash
npm run build
npm test
```

Expected: build succeeds and pricing tests pass.

- [ ] **Step 6: Commit customer discovery**

Run:

```bash
git add src/features/customer/StyleCard.tsx src/features/customer/StyleWaterfallGrid.tsx src/features/customer/StyleDetailPanel.tsx src/app/customer src/app/globals.css
git commit -m "feat: add customer style discovery"
```

## Task 6: Implement Customer Booking And Confirmation Flow

**Files:**
- Create: `src/features/customer/NailAttributeEditor.tsx`
- Create: `src/features/customer/PriceEstimateBar.tsx`
- Create: `src/features/customer/BookingTimeSelector.tsx`
- Create: `src/app/customer/booking/page.tsx`
- Create: `src/app/customer/booking/confirm/page.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add recognition editor component**

Create `src/features/customer/NailAttributeEditor.tsx`:

```tsx
'use client';

import type { AIRecognitionResult, NailShape } from '@/domain/nail';
import { ChipButton } from '@/components/ui/ChipButton';

const shapeOptions: NailShape[] = ['round', 'square', 'squoval', 'oval', 'almond', 'coffin', 'stiletto'];
const styleOptions = ['solid', 'french', 'catEye', 'gradient', 'handPainted', 'rhinestone', 'metallic'];

type NailAttributeEditorProps = {
  value: AIRecognitionResult;
  onChange: (nextValue: AIRecognitionResult) => void;
};

export function NailAttributeEditor({ value, onChange }: NailAttributeEditorProps) {
  function toggleBoolean(key: 'removal' | 'extension' | 'builderGel') {
    onChange({ ...value, [key]: !value[key] });
  }

  function toggleStyle(styleName: string) {
    const selected = value.styles.includes(styleName);
    onChange({
      ...value,
      styles: selected ? value.styles.filter((item) => item !== styleName) : [...value.styles, styleName]
    });
  }

  return (
    <div className="attribute-editor">
      <section>
        <h3>Base services</h3>
        <div className="chip-row">
          <ChipButton label="Removal" selected={value.removal} onClick={() => toggleBoolean('removal')} />
          <ChipButton label="Extension" selected={value.extension} onClick={() => toggleBoolean('extension')} />
          <ChipButton label="Builder gel" selected={value.builderGel} onClick={() => toggleBoolean('builderGel')} />
        </div>
      </section>

      <section>
        <h3>Nail shape</h3>
        <div className="chip-row">
          {shapeOptions.map((shape) => (
            <ChipButton key={shape} label={shape} selected={value.nailShape === shape} onClick={() => onChange({ ...value, nailShape: shape })} />
          ))}
        </div>
      </section>

      <section>
        <h3>Style details</h3>
        <div className="chip-row">
          {styleOptions.map((styleName) => (
            <ChipButton key={styleName} label={styleName} selected={value.styles.includes(styleName)} onClick={() => toggleStyle(styleName)} />
          ))}
        </div>
      </section>

      <label className="field">
        Other notes
        <textarea value={value.otherNotes} onChange={(event) => onChange({ ...value, otherNotes: event.target.value })} />
      </label>
    </div>
  );
}
```

- [ ] **Step 2: Add estimate bar and time selector**

Create `src/features/customer/PriceEstimateBar.tsx`:

```tsx
import Link from 'next/link';

export function PriceEstimateBar({ price, duration }: { price: number; duration: number }) {
  return (
    <aside className="estimate-bar">
      <div>
        <strong>SGD {price}</strong>
        <span>{duration} min</span>
      </div>
      <Link href="/customer/booking/confirm">Next: choose time</Link>
    </aside>
  );
}
```

Create `src/features/customer/BookingTimeSelector.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { availableSlots } from '@/mock/bookings';

export function BookingTimeSelector() {
  const [selectedSlot, setSelectedSlot] = useState('2026-05-23 14:00');

  return (
    <section className="time-selector">
      {availableSlots.map((day) => (
        <div key={day.date}>
          <h2>{day.label}</h2>
          <div className="chip-row">
            {day.slots.map((slot) => {
              const value = `${day.date} ${slot}`;
              return (
                <button key={value} className={selectedSlot === value ? 'chip chip-selected' : 'chip'} type="button" onClick={() => setSelectedSlot(value)}>
                  {slot}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 3: Add booking route**

Create `src/app/customer/booking/page.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { ImageUploader } from '@/components/ui/ImageUploader';
import { LoadingState } from '@/components/ui/LoadingState';
import { calculateEstimate } from '@/domain/pricing';
import { NailAttributeEditor } from '@/features/customer/NailAttributeEditor';
import { PriceEstimateBar } from '@/features/customer/PriceEstimateBar';
import { mockAIResult } from '@/mock/ai';
import { defaultPricingRules } from '@/mock/pricing';

export default function CustomerBookingPage() {
  const [imageUrl, setImageUrl] = useState('');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [recognition, setRecognition] = useState(mockAIResult);
  const estimate = useMemo(() => calculateEstimate(recognition, defaultPricingRules), [recognition]);

  function startRecognition() {
    setIsRecognizing(true);
    window.setTimeout(() => {
      setIsRecognizing(false);
      setSheetOpen(true);
    }, 700);
  }

  return (
    <MobileLayout role="customer">
      <section className="page-heading">
        <p>AI estimate</p>
        <h1>Upload your nail reference</h1>
      </section>
      <ImageUploader imageUrl={imageUrl} onMockUpload={() => setImageUrl(mockAIResult.styles.includes('catEye') ? 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=900&q=80' : '')} />
      {isRecognizing ? (
        <LoadingState title="AI is recognizing the style" body="Breaking down removal, extension, builder gel, shape, and design details." />
      ) : (
        <Button disabled={!imageUrl} onClick={startRecognition}>
          Smart recognition
        </Button>
      )}
      <BottomSheet open={sheetOpen} title="AI recognition result" onClose={() => setSheetOpen(false)}>
        <p className="helper-copy">Review and edit the breakdown. Price and time update automatically.</p>
        <NailAttributeEditor value={recognition} onChange={setRecognition} />
      </BottomSheet>
      {sheetOpen || imageUrl ? <PriceEstimateBar price={estimate.price} duration={estimate.duration} /> : null}
    </MobileLayout>
  );
}
```

- [ ] **Step 4: Add booking confirmation route**

Create `src/app/customer/booking/confirm/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { BookingTimeSelector } from '@/features/customer/BookingTimeSelector';
import { mockAIResult } from '@/mock/ai';

export default function CustomerBookingConfirmPage() {
  const [toast, setToast] = useState('');

  return (
    <MobileLayout role="customer">
      <section className="page-heading">
        <p>Confirm booking</p>
        <h1>Choose your appointment time</h1>
      </section>
      <section className="summary-card">
        <strong>Rose Cat Eye Shine</strong>
        <p>{mockAIResult.otherNotes}</p>
        <p>Estimated: SGD {mockAIResult.estimatedPrice} · {mockAIResult.estimatedDuration} min</p>
      </section>
      <BookingTimeSelector />
      <label className="field">
        Notes
        <textarea defaultValue="Prefer a softer pink tone." />
      </label>
      <Button onClick={() => setToast('Booking request sent to merchant.')}>Confirm appointment</Button>
      <Toast message={toast} />
    </MobileLayout>
  );
}
```

- [ ] **Step 5: Add booking styles**

Append to `src/app/globals.css`:

```css
.attribute-editor,
.time-selector {
  display: grid;
  gap: 18px;
}

.attribute-editor h3,
.time-selector h2 {
  margin: 0 0 8px;
  font-size: 15px;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.field {
  display: grid;
  gap: 8px;
  color: var(--color-muted);
  font-size: 13px;
  font-weight: 700;
}

.field textarea {
  min-height: 92px;
  resize: vertical;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px;
}

.helper-copy {
  margin: 0 0 16px;
  color: var(--color-muted);
}

.estimate-bar {
  position: fixed;
  right: 0;
  bottom: 68px;
  left: 0;
  z-index: 18;
  display: flex;
  max-width: 430px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 auto;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
  padding: 12px 16px;
}

.estimate-bar div {
  display: grid;
  gap: 2px;
}

.estimate-bar span {
  color: var(--color-muted);
  font-size: 12px;
}

.estimate-bar a {
  border-radius: 8px;
  background: var(--color-accent);
  color: white;
  padding: 12px 14px;
  font-weight: 800;
}

.summary-card {
  display: grid;
  gap: 8px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  padding: 14px;
}

.summary-card p {
  margin: 0;
  color: var(--color-muted);
}
```

- [ ] **Step 6: Verify booking flow**

Run:

```bash
npm run build
npm test
```

Expected: build succeeds and pricing tests pass.

- [ ] **Step 7: Commit customer booking**

Run:

```bash
git add src/features/customer/NailAttributeEditor.tsx src/features/customer/PriceEstimateBar.tsx src/features/customer/BookingTimeSelector.tsx src/app/customer/booking src/app/globals.css
git commit -m "feat: add customer booking flow"
```

## Task 7: Implement Merchant Calendar, Booking Detail, And Pricing Management

**Files:**
- Create: `src/features/merchant/MonthlyCalendar.tsx`
- Create: `src/features/merchant/BookingDaySheet.tsx`
- Create: `src/features/merchant/BookingListCard.tsx`
- Create: `src/features/merchant/PricingRuleCard.tsx`
- Create: `src/app/merchant/calendar/page.tsx`
- Create: `src/app/merchant/booking/[id]/page.tsx`
- Create: `src/app/merchant/manage/page.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add merchant booking card and day sheet**

Create `src/features/merchant/BookingListCard.tsx`:

```tsx
import Link from 'next/link';
import type { Booking } from '@/domain/nail';

export function BookingListCard({ booking }: { booking: Booking }) {
  return (
    <Link className="booking-card" href={`/merchant/booking/${booking.id}`}>
      <strong>{booking.time} · {booking.customerName}</strong>
      <span>{booking.styleTitle} · {booking.duration} min</span>
      <small>{booking.status}</small>
    </Link>
  );
}
```

Create `src/features/merchant/BookingDaySheet.tsx`:

```tsx
import type { Booking } from '@/domain/nail';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { BookingListCard } from './BookingListCard';

type BookingDaySheetProps = {
  date: string;
  bookings: Booking[];
  open: boolean;
  onClose: () => void;
};

export function BookingDaySheet({ date, bookings, open, onClose }: BookingDaySheetProps) {
  return (
    <BottomSheet open={open} title={date} onClose={onClose}>
      {bookings.length === 0 ? (
        <EmptyState title="No bookings" body="This day has no scheduled appointments." />
      ) : (
        <div className="booking-list">
          {bookings.map((booking) => (
            <BookingListCard key={booking.id} booking={booking} />
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
```

- [ ] **Step 2: Add monthly calendar**

Create `src/features/merchant/MonthlyCalendar.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import type { Booking } from '@/domain/nail';
import { BookingDaySheet } from './BookingDaySheet';

type MonthlyCalendarProps = {
  bookings: Booking[];
};

const days = Array.from({ length: 31 }, (_, index) => index + 1);

export function MonthlyCalendar({ bookings }: MonthlyCalendarProps) {
  const [selectedDate, setSelectedDate] = useState('2026-05-23');
  const [sheetOpen, setSheetOpen] = useState(false);
  const bookingsByDate = useMemo(() => {
    return bookings.reduce<Record<string, Booking[]>>((grouped, booking) => {
      grouped[booking.date] = [...(grouped[booking.date] ?? []), booking];
      return grouped;
    }, {});
  }, [bookings]);
  const selectedBookings = bookingsByDate[selectedDate] ?? [];

  return (
    <>
      <section className="calendar-grid" aria-label="May 2026 bookings">
        {days.map((day) => {
          const date = `2026-05-${String(day).padStart(2, '0')}`;
          const count = bookingsByDate[date]?.length ?? 0;
          return (
            <button
              key={date}
              className="calendar-day"
              type="button"
              onClick={() => {
                setSelectedDate(date);
                setSheetOpen(true);
              }}
            >
              <strong>{day}</strong>
              <span>{count ? `${count} bookings` : 'Open'}</span>
            </button>
          );
        })}
      </section>
      <BookingDaySheet date={selectedDate} bookings={selectedBookings} open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}
```

- [ ] **Step 3: Add merchant calendar and booking detail routes**

Create `src/app/merchant/calendar/page.tsx`:

```tsx
import { MobileLayout } from '@/components/layout/MobileLayout';
import { MonthlyCalendar } from '@/features/merchant/MonthlyCalendar';
import { mockBookings } from '@/mock/bookings';

export default function MerchantCalendarPage() {
  return (
    <MobileLayout role="merchant">
      <section className="page-heading">
        <p>May 2026</p>
        <h1>Appointment calendar</h1>
      </section>
      <MonthlyCalendar bookings={mockBookings} />
    </MobileLayout>
  );
}
```

Create `src/app/merchant/booking/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/Button';
import { mockBookings } from '@/mock/bookings';

export default function MerchantBookingDetailPage({ params }: { params: { id: string } }) {
  const booking = mockBookings.find((item) => item.id === params.id);

  if (!booking) {
    notFound();
  }

  return (
    <MobileLayout role="merchant">
      <section className="booking-detail">
        <img src={booking.styleImageUrl} alt={booking.styleTitle} />
        <h1>{booking.customerName}</h1>
        <p>{booking.date} · {booking.time} · {booking.duration} min</p>
        <p>SGD {booking.price}</p>
        <p>{booking.notes}</p>
        <div className="chip-row">
          {(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'] as const).map((status) => (
            <span key={status} className={booking.status === status ? 'chip chip-selected' : 'chip'}>
              {status}
            </span>
          ))}
        </div>
        <Button>Contact customer</Button>
      </section>
    </MobileLayout>
  );
}
```

- [ ] **Step 4: Add pricing rule card and manage route**

Create `src/features/merchant/PricingRuleCard.tsx`:

```tsx
'use client';

import type { PricingItem } from '@/domain/nail';

type PricingRuleCardProps = {
  item: PricingItem;
  onChange: (item: PricingItem) => void;
};

export function PricingRuleCard({ item, onChange }: PricingRuleCardProps) {
  return (
    <article className="pricing-card">
      <label>
        <span>{item.name}</span>
        <input type="checkbox" checked={item.enabled} onChange={(event) => onChange({ ...item, enabled: event.target.checked })} />
      </label>
      <div className="pricing-fields">
        <label>
          SGD
          <input type="number" min="0" value={item.price} onChange={(event) => onChange({ ...item, price: Number(event.target.value) })} />
        </label>
        <label>
          Min
          <input type="range" min="0" max="180" value={item.duration} onChange={(event) => onChange({ ...item, duration: Number(event.target.value) })} />
          <strong>{item.duration}</strong>
        </label>
      </div>
    </article>
  );
}
```

Create `src/app/merchant/manage/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import type { PricingItem } from '@/domain/nail';
import { PricingRuleCard } from '@/features/merchant/PricingRuleCard';
import { defaultPricingRules } from '@/mock/pricing';

const categoryLabels: Record<PricingItem['category'], string> = {
  base: 'Base services',
  shape: 'Nail shapes',
  style: 'Style types',
  addon: 'Add-ons'
};

export default function MerchantManagePage() {
  const [rules, setRules] = useState(defaultPricingRules);
  const [toast, setToast] = useState('');

  function updateRule(nextRule: PricingItem) {
    setRules((currentRules) => currentRules.map((rule) => (rule.id === nextRule.id ? nextRule : rule)));
  }

  return (
    <MobileLayout role="merchant">
      <section className="page-heading">
        <p>Price list</p>
        <h1>Configure estimate rules</h1>
      </section>
      {(Object.keys(categoryLabels) as PricingItem['category'][]).map((category) => (
        <section className="pricing-section" key={category}>
          <h2>{categoryLabels[category]}</h2>
          {rules
            .filter((rule) => rule.category === category)
            .map((rule) => (
              <PricingRuleCard key={rule.id} item={rule} onChange={updateRule} />
            ))}
        </section>
      ))}
      <Button onClick={() => setToast('Price list updated for customer estimates.')}>Save price list</Button>
      <Toast message={toast} />
    </MobileLayout>
  );
}
```

- [ ] **Step 5: Add merchant styles**

Append to `src/app/globals.css`:

```css
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
}

.calendar-day {
  display: grid;
  min-height: 62px;
  align-content: start;
  gap: 4px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  padding: 8px 4px;
  text-align: left;
}

.calendar-day span {
  color: var(--color-muted);
  font-size: 10px;
}

.booking-list {
  display: grid;
  gap: 10px;
}

.booking-card,
.pricing-card,
.booking-detail {
  display: grid;
  gap: 8px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  padding: 12px;
}

.booking-card span,
.booking-card small,
.booking-detail p {
  margin: 0;
  color: var(--color-muted);
}

.booking-detail img {
  width: 100%;
  max-height: 260px;
  border-radius: 8px;
  object-fit: cover;
}

.pricing-section {
  display: grid;
  gap: 10px;
  margin-bottom: 18px;
}

.pricing-section h2 {
  margin: 0;
  font-size: 18px;
}

.pricing-card > label,
.pricing-fields {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.pricing-fields label {
  display: grid;
  flex: 1;
  gap: 6px;
  color: var(--color-muted);
  font-size: 12px;
}

.pricing-fields input[type='number'] {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 9px;
}
```

- [ ] **Step 6: Verify merchant flow**

Run:

```bash
npm run build
npm test
```

Expected: build succeeds and pricing tests pass.

- [ ] **Step 7: Commit merchant core**

Run:

```bash
git add src/features/merchant src/app/merchant src/app/globals.css
git commit -m "feat: add merchant booking management"
```

## Task 8: Implement Messages, Profiles, And Remaining P1 Screens

**Files:**
- Create: `src/features/messages/ConversationListItem.tsx`
- Create: `src/features/messages/ChatRoom.tsx`
- Create: `src/features/customer/BookingHistoryCard.tsx`
- Create: `src/features/merchant/MerchantAnalyticsCard.tsx`
- Create: `src/app/customer/messages/page.tsx`
- Create: `src/app/customer/messages/[conversationId]/page.tsx`
- Create: `src/app/customer/profile/page.tsx`
- Create: `src/app/merchant/messages/page.tsx`
- Create: `src/app/merchant/messages/[conversationId]/page.tsx`
- Create: `src/app/merchant/profile/page.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add shared message components**

Create `src/features/messages/ConversationListItem.tsx`:

```tsx
import Link from 'next/link';
import type { Conversation, UserRole } from '@/domain/nail';

export function ConversationListItem({ conversation, role }: { conversation: Conversation; role: UserRole }) {
  const basePath = role === 'customer' ? '/customer/messages' : '/merchant/messages';

  return (
    <Link className="conversation-item" href={`${basePath}/${conversation.id}`}>
      <div className="avatar">{conversation.avatarInitials}</div>
      <div>
        <strong>{conversation.participantName}</strong>
        <p>{conversation.lastMessage}</p>
        {conversation.relatedBookingTime ? <small>{conversation.relatedBookingTime}</small> : null}
      </div>
      {conversation.unreadCount ? <span>{conversation.unreadCount}</span> : null}
    </Link>
  );
}
```

Create `src/features/messages/ChatRoom.tsx`:

```tsx
import type { Conversation } from '@/domain/nail';

export function ChatRoom({ conversation }: { conversation: Conversation }) {
  return (
    <section className="chat-room">
      <h1>{conversation.participantName}</h1>
      <div className="message-stack">
        {conversation.messages.map((message) => (
          <article key={message.id} className={`message-bubble message-${message.author}`}>
            <p>{message.body}</p>
            <span>{message.sentAt}</span>
          </article>
        ))}
      </div>
      <form className="chat-input">
        <input aria-label="Message" />
        <button type="button">Send</button>
      </form>
    </section>
  );
}
```

- [ ] **Step 2: Add customer messages routes**

Create `src/app/customer/messages/page.tsx`:

```tsx
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ConversationListItem } from '@/features/messages/ConversationListItem';
import { customerConversations } from '@/mock/conversations';

export default function CustomerMessagesPage() {
  return (
    <MobileLayout role="customer">
      <section className="page-heading">
        <p>Messages</p>
        <h1>Chat with your studio</h1>
      </section>
      <div className="conversation-list">
        {customerConversations.map((conversation) => (
          <ConversationListItem key={conversation.id} conversation={conversation} role="customer" />
        ))}
      </div>
    </MobileLayout>
  );
}
```

Create `src/app/customer/messages/[conversationId]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ChatRoom } from '@/features/messages/ChatRoom';
import { customerConversations } from '@/mock/conversations';

export default function CustomerChatPage({ params }: { params: { conversationId: string } }) {
  const conversation = customerConversations.find((item) => item.id === params.conversationId);

  if (!conversation) {
    notFound();
  }

  return (
    <MobileLayout role="customer">
      <ChatRoom conversation={conversation} />
    </MobileLayout>
  );
}
```

- [ ] **Step 3: Add merchant messages routes**

Create `src/app/merchant/messages/page.tsx`:

```tsx
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ConversationListItem } from '@/features/messages/ConversationListItem';
import { merchantConversations } from '@/mock/conversations';

export default function MerchantMessagesPage() {
  return (
    <MobileLayout role="merchant">
      <section className="page-heading">
        <p>Messages</p>
        <h1>Customer conversations</h1>
      </section>
      <div className="conversation-list">
        {merchantConversations.map((conversation) => (
          <ConversationListItem key={conversation.id} conversation={conversation} role="merchant" />
        ))}
      </div>
    </MobileLayout>
  );
}
```

Create `src/app/merchant/messages/[conversationId]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/Button';
import { ChatRoom } from '@/features/messages/ChatRoom';
import { merchantConversations } from '@/mock/conversations';

export default function MerchantChatPage({ params }: { params: { conversationId: string } }) {
  const conversation = merchantConversations.find((item) => item.id === params.conversationId);

  if (!conversation) {
    notFound();
  }

  return (
    <MobileLayout role="merchant">
      <div className="quick-actions">
        <Button variant="secondary">Send quote</Button>
        <Button variant="secondary">Confirm booking</Button>
      </div>
      <ChatRoom conversation={conversation} />
    </MobileLayout>
  );
}
```

- [ ] **Step 4: Add profile components and routes**

Create `src/features/customer/BookingHistoryCard.tsx`:

```tsx
import type { Booking } from '@/domain/nail';

export function BookingHistoryCard({ booking }: { booking: Booking }) {
  return (
    <article className="history-card">
      <img src={booking.styleImageUrl} alt={booking.styleTitle} />
      <div>
        <strong>{booking.styleTitle}</strong>
        <p>{booking.date} · {booking.time}</p>
        <p>SGD {booking.price} · {booking.status}</p>
      </div>
    </article>
  );
}
```

Create `src/features/merchant/MerchantAnalyticsCard.tsx`:

```tsx
export function MerchantAnalyticsCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="analytics-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
```

Create `src/app/customer/profile/page.tsx`:

```tsx
import { MobileLayout } from '@/components/layout/MobileLayout';
import { BookingHistoryCard } from '@/features/customer/BookingHistoryCard';
import { mockBookings } from '@/mock/bookings';

const preferences = ['Weekday evening', 'Weekend morning', 'Weekend afternoon'];

export default function CustomerProfilePage() {
  return (
    <MobileLayout role="customer">
      <section className="profile-header">
        <div className="avatar">MT</div>
        <div>
          <h1>Melissa Tan</h1>
          <p>melissa@example.com</p>
        </div>
      </section>
      <section className="profile-section">
        <h2>Preferred times</h2>
        <div className="chip-row">
          {preferences.map((preference) => (
            <span className="chip chip-selected" key={preference}>{preference}</span>
          ))}
        </div>
      </section>
      <section className="profile-section">
        <h2>Booking history</h2>
        {mockBookings.map((booking) => (
          <BookingHistoryCard key={booking.id} booking={booking} />
        ))}
      </section>
    </MobileLayout>
  );
}
```

Create `src/app/merchant/profile/page.tsx`:

```tsx
import { MobileLayout } from '@/components/layout/MobileLayout';
import { MerchantAnalyticsCard } from '@/features/merchant/MerchantAnalyticsCard';

export default function MerchantProfilePage() {
  return (
    <MobileLayout role="merchant">
      <section className="profile-header">
        <div className="avatar">NS</div>
        <div>
          <h1>Nailed-it Studio</h1>
          <p>merchant@example.com</p>
        </div>
      </section>
      <section className="analytics-grid">
        <MerchantAnalyticsCard label="Bookings this month" value="128" />
        <MerchantAnalyticsCard label="Projected revenue" value="SGD 9,860" />
        <MerchantAnalyticsCard label="Top styles" value="Cat eye / French" />
      </section>
      <section className="summary-card">
        <strong>Monthly booking trend</strong>
        <p>Chart preview reserved for future BI data.</p>
      </section>
    </MobileLayout>
  );
}
```

- [ ] **Step 5: Add message and profile styles**

Append to `src/app/globals.css`:

```css
.conversation-list,
.message-stack,
.profile-section,
.analytics-grid {
  display: grid;
  gap: 12px;
}

.conversation-item,
.history-card,
.profile-header,
.analytics-card {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  padding: 12px;
}

.conversation-item > div:nth-child(2),
.history-card > div,
.profile-header > div:nth-child(2) {
  min-width: 0;
  flex: 1;
}

.conversation-item p,
.conversation-item small,
.history-card p,
.profile-header p {
  margin: 3px 0 0;
  overflow: hidden;
  color: var(--color-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.avatar {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  background: var(--color-text);
  color: white;
  font-weight: 800;
}

.conversation-item > span {
  display: grid;
  min-width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 999px;
  background: var(--color-accent);
  color: white;
  font-size: 12px;
  font-weight: 800;
}

.chat-room {
  display: grid;
  gap: 16px;
}

.chat-room h1 {
  margin: 0;
}

.message-bubble {
  max-width: 82%;
  border-radius: 8px;
  padding: 10px 12px;
}

.message-bubble p {
  margin: 0;
}

.message-bubble span {
  display: block;
  margin-top: 4px;
  color: var(--color-muted);
  font-size: 11px;
}

.message-me {
  justify-self: end;
  background: #fbe8ef;
}

.message-them,
.message-system {
  justify-self: start;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.chat-input {
  display: flex;
  gap: 8px;
}

.chat-input input {
  min-width: 0;
  flex: 1;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px;
}

.chat-input button {
  border: 0;
  border-radius: 8px;
  background: var(--color-accent);
  color: white;
  padding: 0 14px;
  font-weight: 800;
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.history-card img {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  object-fit: cover;
}

.profile-header h1,
.profile-section h2 {
  margin: 0;
}

.profile-section h2 {
  font-size: 18px;
}

.analytics-card {
  display: grid;
  align-items: start;
}

.analytics-card span {
  color: var(--color-muted);
  font-size: 13px;
}

.analytics-card strong {
  font-size: 22px;
}
```

- [ ] **Step 6: Verify remaining screens**

Run:

```bash
npm run build
npm test
```

Expected: build succeeds and pricing tests pass.

- [ ] **Step 7: Commit P1 screens**

Run:

```bash
git add src/features/messages src/features/customer/BookingHistoryCard.tsx src/features/merchant/MerchantAnalyticsCard.tsx src/app/customer/messages src/app/customer/profile src/app/merchant/messages src/app/merchant/profile src/app/globals.css
git commit -m "feat: add messages and profile screens"
```

## Task 9: Add Route Smoke Tests For Key User Paths

**Files:**
- Create: `src/app/page.test.tsx`
- Create: `src/features/customer/NailAttributeEditor.test.tsx`

- [ ] **Step 1: Add landing smoke test**

Create `src/app/page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LandingPage from './page';

describe('LandingPage', () => {
  it('renders customer and merchant role entries', () => {
    render(<LandingPage />);

    expect(screen.getByRole('link', { name: /customer find styles and book/i })).toHaveAttribute('href', '/customer/home');
    expect(screen.getByRole('link', { name: /merchant manage prices and bookings/i })).toHaveAttribute('href', '/merchant/calendar');
  });
});
```

- [ ] **Step 2: Add editor interaction test**

Create `src/features/customer/NailAttributeEditor.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AIRecognitionResult } from '@/domain/nail';
import { NailAttributeEditor } from './NailAttributeEditor';

const recognition: AIRecognitionResult = {
  removal: false,
  extension: true,
  builderGel: true,
  nailShape: 'almond',
  styles: ['catEye'],
  otherNotes: '',
  confidence: 0.86,
  estimatedPrice: 98,
  estimatedDuration: 135
};

describe('NailAttributeEditor', () => {
  it('emits updated recognition when a base service is toggled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<NailAttributeEditor value={recognition} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /removal/i }));

    expect(onChange).toHaveBeenCalledWith({
      ...recognition,
      removal: true
    });
  });
});
```

- [ ] **Step 3: Run smoke tests**

Run:

```bash
npm test
```

Expected: pricing tests, landing smoke test, and editor interaction test pass.

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit smoke tests**

Run:

```bash
git add src/app/page.test.tsx src/features/customer/NailAttributeEditor.test.tsx
git commit -m "test: add frontend smoke coverage"
```

## Task 10: Update Architecture And Implementation Documentation

**Files:**
- Modify: `docs/architecture/current-state.md`
- Modify: `docs/changes/implementation-log.md`

- [ ] **Step 1: Update architecture current state**

Replace `docs/architecture/current-state.md` with:

```md
# Architecture: Current State

Last updated: 2026-05-23

Nailed-it is a mobile-first Next.js frontend scaffold for a B2B2C nail booking product. The active product surface is frontend-only and uses centralized mock data while preserving clear backend integration boundaries.

## Pipeline

Current frontend workflow:

1. Landing page selects a mock role.
2. Customer pages support style discovery, style detail, image upload, mock AI recognition, editable nail attribute decomposition, live price/time calculation, booking confirmation, messages, and profile history.
3. Merchant pages support monthly booking calendar, booking detail, pricing/time rule management, messages, and profile analytics preview.
4. Domain functions calculate estimates from `AIRecognitionResult` and `PricingItem[]`.

No real backend, authentication, persistence, or AI service is implemented yet.

## Key modules

- `src/app`: Next.js App Router pages for landing, customer, and merchant routes.
- `src/components`: Shared mobile layout and UI primitives.
- `src/features`: Role-specific customer, merchant, and message components.
- `src/domain`: Shared product contracts and pricing calculation.
- `src/mock`: Centralized mock styles, AI recognition result, pricing rules, bookings, and conversations.
- `docs/superpowers/specs/2026-05-23-nailed-it-frontend-design.md`: Approved frontend design spec.
- `docs/superpowers/plans/2026-05-23-nailed-it-frontend.md`: Implementation plan.
- `scripts/graphify_maintenance.py`: Hook-safe Graphify change classifier and updater.

## LLM integration

No product LLM integration exists yet. AI recognition is represented by `src/mock/ai.ts` and the route/service boundary is reserved for `POST /api/ai/recognize-nail-style`.
```

- [ ] **Step 2: Append implementation log entry**

Append this entry to `docs/changes/implementation-log.md`:

```md
## 2026-05-23 - Mobile Frontend MVP

**Context:** The repository previously had no runtime product code. The approved frontend spec defines a mobile-first Nailed-it web product for customer AI quote flow and merchant booking management.

**Changes (frontend architecture):**
- Added a Next.js App Router frontend with customer and merchant route groups.
- Added shared mobile layout/UI components, role-specific feature components, centralized domain contracts, mock data, and pure pricing logic.
- Added tests for estimate calculation and smoke coverage for key UI behavior.
- Preserved backend integration boundaries for styles, AI recognition, pricing rules, bookings, and conversations.

**Verification:**
- `npm test`
- `npm run build`
- Manual mobile-width navigation through landing, customer booking, merchant calendar, merchant management, messages, and profile pages.

**Must remain true:** Mock data remains centralized; pricing rules and AI recognition contracts remain in the domain/mock boundary until real backend services replace them.
```

- [ ] **Step 3: Verify docs and app**

Run:

```bash
npm test
npm run build
```

Expected: tests pass and build succeeds.

- [ ] **Step 4: Commit docs**

Run:

```bash
git add docs/architecture/current-state.md docs/changes/implementation-log.md
git commit -m "docs: record frontend architecture"
```

## Task 11: Manual Mobile QA And Final Verification

**Files:**
- Modify only files with defects found during QA.

- [ ] **Step 1: Start dev server**

Run:

```bash
npm run dev
```

Expected: Next.js starts and prints a local URL such as `http://localhost:3000`.

- [ ] **Step 2: Verify mobile routes manually**

Open the local URL in the in-app Browser at mobile width and verify:

```text
/
/customer/home
/customer/style/rose-cat-eye
/customer/booking
/customer/booking/confirm
/customer/messages
/customer/messages/conv-merchant
/customer/profile
/merchant/calendar
/merchant/booking/booking-001
/merchant/manage
/merchant/messages
/merchant/messages/conv-melissa
/merchant/profile
```

Expected:

- No route returns 404 except intentionally invalid IDs.
- Bottom tab navigation is visible on role pages.
- Fixed estimate bar does not cover booking controls.
- Bottom sheet content scrolls.
- Text does not overflow cards, buttons, tabs, or chat bubbles.
- Merchant calendar day tap opens appointment list.
- Merchant pricing page allows visible edit interactions and save toast.

- [ ] **Step 3: Run final automated verification**

Run:

```bash
npm test
npm run build
```

Expected: tests pass and build succeeds.

- [ ] **Step 4: Commit QA fixes if any files changed**

If QA required changes, run:

```bash
git add src docs
git commit -m "fix: polish mobile frontend QA"
```

If QA found no changes, do not create an empty commit.

- [ ] **Step 5: Report completion**

Final report should include:

```text
- Implementation branch name.
- Commit range or latest commit.
- Verification commands and outcomes.
- Local dev URL if the server is still running.
- Any known limitations: mock auth, mock AI, mock backend, in-memory state.
```

## Self-Review

Spec coverage:

- Landing and role entry: Task 1.
- Customer style discovery and detail: Task 5.
- Customer AI quote and booking confirmation: Task 6.
- Merchant calendar, booking detail, pricing management: Task 7.
- Messages and profiles: Task 8.
- Central data contracts and mock data: Tasks 2 and 3.
- Error, empty, loading, toast states: Tasks 4, 6, 7, and 8.
- Testing: Tasks 2 and 9.
- Documentation updates: Task 10.
- Mobile QA: Task 11.

No unsupported backend work is included. All data remains centralized in `src/mock` or `src/domain`, and the plan avoids localStorage persistence.
