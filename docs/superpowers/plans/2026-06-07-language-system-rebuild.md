# Language System Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete bilingual language system for the app that defaults to Simplified Chinese, stores language preferences independently for customer and merchant, localizes booking/style/manage first, and keeps landing-page code untouched.

**Architecture:** Introduce a shared app-localization runtime with role-aware persistence, UI message dictionaries, localized domain-content selectors, and unified money/date/unit/status formatters. Upgrade business-facing content contracts to bilingual fields, batch-generate English copy for review before wiring it into the first-wave screens, and make AI-generated visible text explicitly language-aware.

**Tech Stack:** Next.js App Router, React 19 client/server components, TypeScript, Vitest, Testing Library

---

## File Structure

### New Files

- `src/i18n/types.ts`
  Defines `AppLanguage`, `LocalizedText`, message-dictionary types, and narrow formatter contracts.
- `src/i18n/messages/ui/zh-CN.ts`
  Chinese UI copy for app-shell, booking, style, manage, shared status text, and accessibility strings.
- `src/i18n/messages/ui/en.ts`
  English UI copy for the same scope as `zh-CN.ts`.
- `src/i18n/format.ts`
  Role-independent formatters for money, dates, units, and stable enum/status labels.
- `src/i18n/localized.ts`
  Helpers such as `pickLocalizedText`, missing-translation assertions, and bilingual record normalization.
- `src/i18n/storage.ts`
  Role-scoped language persistence helpers for `customer-language` and `merchant-language`.
- `src/i18n/context.tsx`
  Client provider and hook exposing `language`, `setLanguage`, `t`, and formatter helpers.
- `src/i18n/server.ts`
  Server-safe message lookup and formatting entry points for async page components.
- `src/features/shared/LanguageSwitcher.tsx`
  Reusable profile-page language toggle UI.
- `src/i18n/__tests__/format.test.ts`
  Formatter tests for money, date, unit, and fallback behavior.
- `src/i18n/__tests__/storage.test.ts`
  Persistence tests for role-separated language keys.
- `src/i18n/__tests__/context.test.tsx`
  Provider and hook tests for runtime switching.
- `docs/localization/phase-1-ui-review.md`
  Review sheet for first-wave UI strings.
- `docs/localization/phase-1-domain-review.md`
  Review sheet for first-wave bilingual business content.
- `docs/localization/phase-1-ai-review.md`
  Review sheet for first-wave AI output contracts and generated English copy.

### Modified Files

- `src/app/customer/layout.tsx`
  Wrap customer routes with the localization provider using customer-scoped persistence.
- `src/app/layout.tsx`
  Add any shared localization-safe setup needed by both app roles without touching landing routes.
- `src/components/layout/MobileLayout.tsx`
  Replace hardcoded top-bar/profile text with translated strings and formatter helpers.
- `src/components/layout/BottomTabBar.tsx`
  Localize tab labels and accessibility text.
- `src/app/customer/profile/page.tsx`
  Add customer language switcher and localized stats/history copy.
- `src/app/merchant/profile/page.tsx`
  Add merchant language switcher and localized profile analytics copy.
- `src/domain/catalog.ts`
  Upgrade `CatalogItem` to bilingual name/notes fields and add shared localized display helpers.
- `src/data/glossary.ts`
  Carry bilingual glossary names/type labels derived from catalog contracts.
- `src/mock/catalog.ts`
  Add generated English names/notes for all catalog items.
- `src/mock/styles.ts`
  Add bilingual style names/descriptions used in customer style flows.
- `src/mock/merchant-styles.ts`
  Add bilingual merchant-style names/descriptions where applicable.
- `src/lib/services/merchant-pricing-service.ts`
  Return localized pricing display records instead of Chinese-only labels.
- `src/lib/services/quote-service.ts`
  Return localized line labels and localized unit-display data.
- `src/features/customer/ComponentBreakdownPanel.tsx`
  Replace Chinese-only breakdown labels with localized data + translated UI chrome.
- `src/features/customer/StyleDetailPanel.tsx`
  Localize style detail headers, badges, and breakdown labels.
- `src/app/customer/style/[id]/page.tsx`
  Read current language server-side and pass localized display data into the detail panel.
- `src/app/customer/booking/booking-content.tsx`
  Replace hardcoded booking-step and result copy with translation keys and formatters.
- `src/app/customer/booking/confirm/page.tsx`
  Localize confirm copy, summaries, and prices.
- `src/app/merchant/manage/page.tsx`
  Replace hardcoded manage labels, panel titles, helper copy, aria labels, and unit displays with localized helpers.
- `src/features/merchant/ManageServiceRow.tsx`
  Consume localized glossary/catalog data and localized unit/status copy.
- `src/features/merchant/MerchantStyleReviewWorkspace.tsx`
  Localize AI assistant copy, labels, search placeholders, and bilingual style names/descriptions.
- `src/nail-ai/nail-recognition.ts`
  Make visible AI notes language-aware.
- `src/nail-ai/style-config-recognition.ts`
  Generate bilingual style names/descriptions rather than Chinese-only output.
- `src/nail-ai/breakdown.ts`
  Make validation errors and visible AI output language-aware.
- `src/app/api/ai/recognize-nail-style/route.ts`
  Pass requested language to AI recognition.
- `src/app/api/ai/breakdown/route.ts`
  Pass requested language to AI breakdown.
- `src/app/customer/booking/page.test.tsx`
  Add localized booking expectations.
- `src/app/customer/style/[id]/page.test.tsx`
  Add localized style expectations.
- `src/app/merchant/manage/page.test.tsx`
  Add localized manage expectations.
- `src/app/customer/profile/page.test.tsx`
  Add customer language-switch coverage.
- `src/app/merchant/profile/page.test.tsx`
  Add merchant language-switch coverage.
- `src/components/layout/BottomTabBar.test.tsx`
  Update tab-label assertions for localized output.
- `src/components/layout/MobileLayout.test.tsx`
  Update top-bar/profile CTA assertions for localized output.

## Task 1: Build Localization Types and Formatters

**Files:**
- Create: `src/i18n/types.ts`
- Create: `src/i18n/format.ts`
- Create: `src/i18n/localized.ts`
- Test: `src/i18n/__tests__/format.test.ts`

- [ ] **Step 1: Write the failing formatter tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  formatCurrency,
  formatDuration,
  formatPricingUnitLabel,
  formatStatusLabel,
} from '@/i18n/format';

describe('formatCurrency', () => {
  it('formats CNY for zh-CN with yen symbol style output', () => {
    expect(formatCurrency({ cents: 12345, language: 'zh-CN' })).toBe('¥123.45');
  });

  it('formats SGD for en with dollar symbol style output', () => {
    expect(formatCurrency({ cents: 12345, language: 'en' })).toBe('$123.45');
  });
});

describe('formatDuration', () => {
  it('formats zh-CN durations', () => {
    expect(formatDuration({ minutes: 45, language: 'zh-CN' })).toBe('45 分钟');
  });

  it('formats English durations', () => {
    expect(formatDuration({ minutes: 45, language: 'en' })).toBe('45 min');
  });
});

describe('formatPricingUnitLabel', () => {
  it('localizes per_finger for zh-CN and en', () => {
    expect(formatPricingUnitLabel({ unit: 'per_finger', language: 'zh-CN' })).toBe('每指');
    expect(formatPricingUnitLabel({ unit: 'per_finger', language: 'en' })).toBe('per finger');
  });
});

describe('formatStatusLabel', () => {
  it('localizes booking statuses from stable ids', () => {
    expect(formatStatusLabel({ status: 'pending_review', language: 'zh-CN' })).toBe('待确认');
    expect(formatStatusLabel({ status: 'pending_review', language: 'en' })).toBe('Pending review');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/i18n/__tests__/format.test.ts`
Expected: FAIL with module-not-found errors for `@/i18n/format`

- [ ] **Step 3: Write minimal localization types and formatters**

```ts
// src/i18n/types.ts
export type AppLanguage = 'zh-CN' | 'en';

export type LocalizedText = {
  zh: string;
  en: string;
};

// src/i18n/localized.ts
import type { AppLanguage, LocalizedText } from './types';

export function pickLocalizedText(value: LocalizedText, language: AppLanguage): string {
  return language === 'zh-CN' ? value.zh : value.en;
}

// src/i18n/format.ts
import type { AppLanguage } from './types';

const statusLabels = {
  pending_review: { zh: '待确认', en: 'Pending review' },
  confirmed: { zh: '已确认', en: 'Confirmed' },
  cancelled: { zh: '已取消', en: 'Cancelled' },
} as const;

export function formatCurrency({ cents, language }: { cents: number; language: AppLanguage }) {
  const amount = (cents / 100).toFixed(2);
  return language === 'zh-CN' ? `¥${amount}` : `$${amount}`;
}

export function formatDuration({ minutes, language }: { minutes: number; language: AppLanguage }) {
  return language === 'zh-CN' ? `${minutes} 分钟` : `${minutes} min`;
}

export function formatPricingUnitLabel({
  unit,
  language,
}: {
  unit: 'fixed' | 'included' | 'per_finger' | 'per_level' | 'per_piece' | 'per_set' | 'tag_only';
  language: AppLanguage;
}) {
  const labels = {
    fixed: { zh: '固定价', en: 'fixed' },
    included: { zh: '已含', en: 'included' },
    per_finger: { zh: '每指', en: 'per finger' },
    per_level: { zh: '每级', en: 'per level' },
    per_piece: { zh: '每件', en: 'per piece' },
    per_set: { zh: '每套', en: 'per set' },
    tag_only: { zh: '仅标签', en: 'tag only' },
  } as const;
  return language === 'zh-CN' ? labels[unit].zh : labels[unit].en;
}

export function formatStatusLabel({
  status,
  language,
}: {
  status: keyof typeof statusLabels;
  language: AppLanguage;
}) {
  return language === 'zh-CN' ? statusLabels[status].zh : statusLabels[status].en;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/i18n/__tests__/format.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/i18n/types.ts src/i18n/localized.ts src/i18n/format.ts src/i18n/__tests__/format.test.ts
git commit -m "feat: add localization formatter foundation"
```

## Task 2: Add Role-Aware Language Persistence and Provider

**Files:**
- Create: `src/i18n/storage.ts`
- Create: `src/i18n/context.tsx`
- Create: `src/i18n/server.ts`
- Test: `src/i18n/__tests__/storage.test.ts`
- Test: `src/i18n/__tests__/context.test.tsx`

- [ ] **Step 1: Write the failing storage and provider tests**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LanguageProvider, useLanguage } from '@/i18n/context';
import { loadLanguage, saveLanguage } from '@/i18n/storage';

describe('language storage', () => {
  it('stores customer and merchant languages separately', () => {
    saveLanguage('customer', 'en');
    saveLanguage('merchant', 'zh-CN');

    expect(loadLanguage('customer')).toBe('en');
    expect(loadLanguage('merchant')).toBe('zh-CN');
  });
});

function Example() {
  const { language, setLanguage } = useLanguage();
  return (
    <>
      <span>{language}</span>
      <button type="button" onClick={() => setLanguage('en')}>
        switch
      </button>
    </>
  );
}

describe('LanguageProvider', () => {
  it('updates the active language immediately', async () => {
    const user = userEvent.setup();

    render(
      <LanguageProvider role="customer">
        <Example />
      </LanguageProvider>,
    );

    expect(screen.getByText('zh-CN')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'switch' }));
    expect(screen.getByText('en')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/i18n/__tests__/storage.test.ts src/i18n/__tests__/context.test.tsx`
Expected: FAIL with module-not-found errors for `@/i18n/storage` and `@/i18n/context`

- [ ] **Step 3: Implement role-aware storage and provider**

```tsx
// src/i18n/storage.ts
import type { AppLanguage } from './types';
import type { UserRole } from '@/domain/nail';

const STORAGE_KEYS: Record<UserRole, string> = {
  customer: 'customer-language',
  merchant: 'merchant-language',
};

export function loadLanguage(role: UserRole): AppLanguage {
  if (typeof window === 'undefined') return 'zh-CN';
  const raw = window.localStorage.getItem(STORAGE_KEYS[role]);
  return raw === 'en' ? 'en' : 'zh-CN';
}

export function saveLanguage(role: UserRole, language: AppLanguage) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEYS[role], language);
}

// src/i18n/context.tsx
'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { UserRole } from '@/domain/nail';
import type { AppLanguage } from './types';
import { loadLanguage, saveLanguage } from './storage';

type LanguageContextValue = {
  language: AppLanguage;
  role: UserRole;
  setLanguage: (language: AppLanguage) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children, role }: { children: ReactNode; role: UserRole }) {
  const [language, updateLanguage] = useState<AppLanguage>(() => loadLanguage(role));

  const value = useMemo(
    () => ({
      language,
      role,
      setLanguage(next: AppLanguage) {
        saveLanguage(role, next);
        updateLanguage(next);
      },
    }),
    [language, role],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used within LanguageProvider');
  return value;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/i18n/__tests__/storage.test.ts src/i18n/__tests__/context.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/i18n/storage.ts src/i18n/context.tsx src/i18n/server.ts src/i18n/__tests__/storage.test.ts src/i18n/__tests__/context.test.tsx
git commit -m "feat: add role-based language persistence"
```

## Task 3: Add UI Message Dictionaries and Shared Translation API

**Files:**
- Create: `src/i18n/messages/ui/zh-CN.ts`
- Create: `src/i18n/messages/ui/en.ts`
- Modify: `src/i18n/context.tsx`
- Modify: `src/i18n/server.ts`
- Test: `src/i18n/__tests__/context.test.tsx`

- [ ] **Step 1: Extend tests to require translated strings**

```tsx
it('resolves translated UI strings from the active language', async () => {
  const user = userEvent.setup();

  function Example() {
    const { language, setLanguage, t } = useLanguage();
    return (
      <>
        <span>{language}</span>
        <p>{t('profile.language.switch')}</p>
        <button type="button" onClick={() => setLanguage('en')}>
          switch
        </button>
      </>
    );
  }

  render(
    <LanguageProvider role="customer">
      <Example />
    </LanguageProvider>,
  );

  expect(screen.getByText('切换语言')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'switch' }));
  expect(screen.getByText('Language')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/i18n/__tests__/context.test.tsx`
Expected: FAIL with `t is not a function` or missing translation errors

- [ ] **Step 3: Implement dictionaries and message lookup**

```ts
// src/i18n/messages/ui/zh-CN.ts
export const zhCNMessages = {
  'profile.language.switch': '切换语言',
  'profile.language.zh': '中文',
  'profile.language.en': 'English',
  'layout.openProfile': '打开个人页',
  'layout.newNailDesign': '＋ 新建美甲方案',
} as const;

// src/i18n/messages/ui/en.ts
export const enMessages = {
  'profile.language.switch': 'Language',
  'profile.language.zh': 'Chinese',
  'profile.language.en': 'English',
  'layout.openProfile': 'Open profile',
  'layout.newNailDesign': '+ New Nail Design',
} as const;

// src/i18n/server.ts
import { enMessages } from './messages/ui/en';
import { zhCNMessages } from './messages/ui/zh-CN';
import type { AppLanguage } from './types';

const messageTable = {
  'zh-CN': zhCNMessages,
  en: enMessages,
} as const;

export function getMessage(language: AppLanguage, key: keyof typeof zhCNMessages): string {
  return messageTable[language][key];
}

// src/i18n/context.tsx
import { getMessage } from './server';

type LanguageContextValue = {
  language: AppLanguage;
  role: UserRole;
  setLanguage: (language: AppLanguage) => void;
  t: (key: keyof typeof zhCNMessages) => string;
};

// inside provider value
t(key) {
  return getMessage(language, key);
},
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/i18n/__tests__/context.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/i18n/messages/ui/zh-CN.ts src/i18n/messages/ui/en.ts src/i18n/context.tsx src/i18n/server.ts src/i18n/__tests__/context.test.tsx
git commit -m "feat: add localization message dictionaries"
```

## Task 4: Wire Customer and Merchant Layouts, Mobile Shell, and Profile Switchers

**Files:**
- Modify: `src/app/customer/layout.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/components/layout/MobileLayout.tsx`
- Modify: `src/components/layout/BottomTabBar.tsx`
- Create: `src/features/shared/LanguageSwitcher.tsx`
- Modify: `src/app/customer/profile/page.tsx`
- Modify: `src/app/merchant/profile/page.tsx`
- Test: `src/app/customer/profile/page.test.tsx`
- Test: `src/app/merchant/profile/page.test.tsx`
- Test: `src/components/layout/MobileLayout.test.tsx`
- Test: `src/components/layout/BottomTabBar.test.tsx`

- [ ] **Step 1: Write the failing layout/profile tests**

```tsx
it('renders a customer language switcher and switches language labels', async () => {
  const user = userEvent.setup();
  render(<CustomerProfilePage />);

  expect(screen.getByRole('button', { name: '中文' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'English' }));
  expect(screen.getByText('Booking history')).toBeInTheDocument();
});

it('renders localized mobile-layout CTA text', () => {
  render(
    <LanguageProvider role="customer">
      <MobileLayout role="customer" title="Nailed-it">
        <div>body</div>
      </MobileLayout>
    </LanguageProvider>,
  );

  expect(screen.getByRole('link', { name: '打开个人页' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '＋ 新建美甲方案' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/app/customer/profile/page.test.tsx src/app/merchant/profile/page.test.tsx src/components/layout/MobileLayout.test.tsx src/components/layout/BottomTabBar.test.tsx`
Expected: FAIL because switch controls and localized shell strings do not exist

- [ ] **Step 3: Implement provider wiring and switch UI**

```tsx
// src/app/customer/layout.tsx
import { SavedStylesProvider } from '@/features/customer/SavedStylesContext';
import { LanguageProvider } from '@/i18n/context';

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider role="customer">
      <SavedStylesProvider>{children}</SavedStylesProvider>
    </LanguageProvider>
  );
}

// src/features/shared/LanguageSwitcher.tsx
'use client';

import { useLanguage } from '@/i18n/context';

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <section className="profile-section" aria-label={t('profile.language.switch')}>
      <h2>{t('profile.language.switch')}</h2>
      <div className="chip-row">
        <button type="button" aria-pressed={language === 'zh-CN'} onClick={() => setLanguage('zh-CN')}>
          {t('profile.language.zh')}
        </button>
        <button type="button" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>
          {t('profile.language.en')}
        </button>
      </div>
    </section>
  );
}

// src/components/layout/MobileLayout.tsx
import { useLanguage } from '@/i18n/context';

const { t } = useLanguage();

<ResetLink className="top-bar-cta" href={getCustomerBookingPath()}>
  {t('layout.newNailDesign')}
</ResetLink>

<Link aria-label={t('layout.openProfile')} className="top-bar-avatar" href={profilePath}>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/app/customer/profile/page.test.tsx src/app/merchant/profile/page.test.tsx src/components/layout/MobileLayout.test.tsx src/components/layout/BottomTabBar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/customer/layout.tsx src/app/layout.tsx src/components/layout/MobileLayout.tsx src/components/layout/BottomTabBar.tsx src/features/shared/LanguageSwitcher.tsx src/app/customer/profile/page.tsx src/app/merchant/profile/page.tsx src/app/customer/profile/page.test.tsx src/app/merchant/profile/page.test.tsx src/components/layout/MobileLayout.test.tsx src/components/layout/BottomTabBar.test.tsx
git commit -m "feat: wire localized app shell and profile switchers"
```

## Task 5: Upgrade Catalog and Glossary Contracts to Bilingual Fields

**Files:**
- Modify: `src/domain/catalog.ts`
- Modify: `src/mock/catalog.ts`
- Modify: `src/data/glossary.ts`
- Modify: `src/domain/merchant.ts`
- Modify: `src/lib/services/merchant-pricing-service.ts`
- Test: `src/mock/catalog.test.ts`
- Test: `src/domain/recognition-catalog.test.ts`

- [ ] **Step 1: Write failing tests for bilingual catalog/glossary contracts**

```ts
import { describe, expect, it } from 'vitest';
import { catalogItems } from '@/mock/catalog';
import { glossaryById } from '@/data/glossary';

describe('catalog bilingual content', () => {
  it('contains zh and en names for every catalog item', () => {
    for (const item of catalogItems) {
      expect(item.name.zh).not.toBe('');
      expect(item.name.en).not.toBe('');
    }
  });
});

describe('glossary bilingual content', () => {
  it('derives localized names and type labels', () => {
    const basic = glossaryById.get('basic_manicure_service');
    expect(basic?.name.zh).toBe('基础护理服务');
    expect(basic?.name.en).toBe('Basic manicure service');
    expect(basic?.typeLabel.en).toBe('Service module');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/mock/catalog.test.ts src/domain/recognition-catalog.test.ts`
Expected: FAIL because `name` and `typeLabel` bilingual fields do not exist

- [ ] **Step 3: Implement bilingual data contracts**

```ts
// src/domain/catalog.ts
import type { LocalizedText } from '@/i18n/types';

export type CatalogItem = {
  id: string;
  name: LocalizedText;
  type: CatalogItemType;
  category: string;
  parentId: string | null;
  // ...
  notes: LocalizedText;
};

// src/data/glossary.ts
const typeLabelByType: Record<GlossaryType, LocalizedText> = {
  service_module: { zh: '服务模块', en: 'Service module' },
  procedure: { zh: '工序', en: 'Procedure' },
  billable_component: { zh: '收费组件', en: 'Billable component' },
  visual_attribute: { zh: '视觉属性', en: 'Visual attribute' },
  complexity_level: { zh: '复杂度', en: 'Complexity level' },
  style_tag: { zh: '风格标签', en: 'Style tag' },
};

function toGlossaryEntry(item: CatalogItem): GlossaryEntry {
  return {
    id: item.id,
    name: item.name,
    typeLabel: typeLabelByType[item.type],
    // preserve existing mechanical fields
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/mock/catalog.test.ts src/domain/recognition-catalog.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/catalog.ts src/mock/catalog.ts src/data/glossary.ts src/domain/merchant.ts src/lib/services/merchant-pricing-service.ts src/mock/catalog.test.ts src/domain/recognition-catalog.test.ts
git commit -m "feat: upgrade catalog and glossary to bilingual contracts"
```

## Task 6: Generate and Save First-Wave Translation Review Sheets

**Files:**
- Create: `docs/localization/phase-1-ui-review.md`
- Create: `docs/localization/phase-1-domain-review.md`
- Create: `docs/localization/phase-1-ai-review.md`
- Modify: `src/mock/catalog.ts`
- Modify: `src/mock/styles.ts`
- Modify: `src/mock/merchant-styles.ts`

- [ ] **Step 1: Extract first-wave UI and business strings into review documents**

```md
<!-- docs/localization/phase-1-ui-review.md -->
# Phase 1 UI Review

| Key | zh-CN | en |
| --- | --- | --- |
| booking.upload.title | 上传你的美甲参考图 | Upload your nail reference |
| booking.result.title | 款式识别结果 | Style detected |
| manage.panel.basic | 基础服务 | Basic services |
| profile.language.switch | 切换语言 | Language |
```

```md
<!-- docs/localization/phase-1-domain-review.md -->
# Phase 1 Domain Review

| ID | Type | zh-CN | en |
| --- | --- | --- | --- |
| basic_manicure_service | catalog_item | 基础护理服务 | Basic manicure service |
| cat_eye | catalog_item | 猫眼色 | Cat-eye color |
| rose-cat-eye | style_name | 玫瑰猫眼 | Rose cat-eye |
```

```md
<!-- docs/localization/phase-1-ai-review.md -->
# Phase 1 AI Review

| Field | zh-CN | en |
| --- | --- | --- |
| recognizeStyleName.name | 奶油法式 | Creamy French |
| recognizeStyleName.description | 奶白底配细法式边，整体温柔干净。 | Soft milky base with a fine French edge and a clean, gentle finish. |
| nailValidation.invalidInput | 请上传一张美甲照片。 | Please upload a nail-style photo. |
```

- [ ] **Step 2: Run verification by checking no empty English cells remain**

Run: `rg -n "\|[[:space:]]*$|\|[[:space:]]*\|" docs/localization/phase-1-*.md`
Expected: no output showing blank review entries

- [ ] **Step 3: Add generated bilingual values into first-wave mock data**

```ts
// src/mock/styles.ts
{
  id: 'rose-cat-eye',
  name: { zh: '玫瑰猫眼', en: 'Rose cat-eye' },
  description: {
    zh: '圆润玫瑰色猫眼，带柔和珠光反射。',
    en: 'Rounded rose-toned cat-eye nails with a soft pearly reflection.',
  },
}
```

- [ ] **Step 4: Run a focused data test to verify bilingual content is non-empty**

Run: `npm test -- src/mock/catalog.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/localization/phase-1-ui-review.md docs/localization/phase-1-domain-review.md docs/localization/phase-1-ai-review.md src/mock/catalog.ts src/mock/styles.ts src/mock/merchant-styles.ts
git commit -m "docs: add first-wave localization review sheets"
```

## Task 7: Localize Customer Booking Flow

**Files:**
- Modify: `src/app/customer/booking/booking-content.tsx`
- Modify: `src/app/customer/booking/confirm/page.tsx`
- Modify: `src/features/customer/ComponentBreakdownPanel.tsx`
- Modify: `src/features/customer/PriceEstimateBar.tsx`
- Modify: `src/lib/services/quote-service.ts`
- Test: `src/app/customer/booking/page.test.tsx`
- Test: `src/app/customer/booking/confirm/page.test.tsx`

- [ ] **Step 1: Write failing booking-flow tests for both languages**

```tsx
it('renders booking step labels in Chinese by default', async () => {
  render(<CustomerBookingContent />);
  expect(screen.getByText('上传图片')).toBeInTheDocument();
  expect(screen.getByText('款式结果')).toBeInTheDocument();
  expect(screen.getByText('报价')).toBeInTheDocument();
});

it('renders booking copy in English after switching language', async () => {
  window.localStorage.setItem('customer-language', 'en');
  render(<CustomerBookingContent />);
  expect(screen.getByText('Upload')).toBeInTheDocument();
  expect(screen.getByText('Style result')).toBeInTheDocument();
  expect(screen.getByText('Quote')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/app/customer/booking/page.test.tsx src/app/customer/booking/confirm/page.test.tsx`
Expected: FAIL because hardcoded strings do not follow language selection

- [ ] **Step 3: Implement localized booking copy and formatted prices**

```tsx
// src/app/customer/booking/booking-content.tsx
import { useLanguage } from '@/i18n/context';

const { t, language } = useLanguage();

const bookingSteps = [
  t('booking.steps.upload'),
  t('booking.steps.result'),
  t('booking.steps.quote'),
] as const;

<div className="booking-steps" aria-label={t('booking.progress')}>
  {bookingSteps.map((label, index) => (
    <span key={label}>{label}</span>
  ))}
</div>

<p className="section-eyebrow">{t('booking.step1')}</p>
<h1>{t('booking.upload.title')}</h1>

// src/features/customer/PriceEstimateBar.tsx
import { useLanguage } from '@/i18n/context';
import { formatCurrency, formatDuration } from '@/i18n/format';

const { language } = useLanguage();
<strong>{formatCurrency({ cents: estimate.price, language })}</strong>
<span>{formatDuration({ minutes: estimate.duration, language })}</span>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/app/customer/booking/page.test.tsx src/app/customer/booking/confirm/page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/customer/booking/booking-content.tsx src/app/customer/booking/confirm/page.tsx src/features/customer/ComponentBreakdownPanel.tsx src/features/customer/PriceEstimateBar.tsx src/lib/services/quote-service.ts src/app/customer/booking/page.test.tsx src/app/customer/booking/confirm/page.test.tsx
git commit -m "feat: localize customer booking flow"
```

## Task 8: Localize Customer Style Detail Flow

**Files:**
- Modify: `src/app/customer/style/[id]/page.tsx`
- Modify: `src/features/customer/StyleDetailPanel.tsx`
- Modify: `src/mock/styles.ts`
- Test: `src/app/customer/style/[id]/page.test.tsx`

- [ ] **Step 1: Write the failing style-detail localization tests**

```tsx
it('renders localized style name and description in English', async () => {
  window.localStorage.setItem('customer-language', 'en');
  render(await StyleDetailPage({ params: Promise.resolve({ id: 'rose-cat-eye' }) }));
  expect(screen.getByText('Rose cat-eye')).toBeInTheDocument();
  expect(screen.getByText(/soft pearly reflection/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/customer/style/[id]/page.test.tsx`
Expected: FAIL because style data and panel labels are Chinese-only

- [ ] **Step 3: Implement localized style-detail rendering**

```tsx
// src/app/customer/style/[id]/page.tsx
import { getServerLanguage } from '@/i18n/server';

const language = await getServerLanguage('customer');

<StyleDetailPanel
  language={language}
  recognition={style.recognition}
  style={style}
  quoteLines={quoteLines}
/>

// src/features/customer/StyleDetailPanel.tsx
import { pickLocalizedText } from '@/i18n/localized';
import { getMessage } from '@/i18n/server';

const title = pickLocalizedText(style.name, language);
const brief = pickLocalizedText(style.description, language);
const typeLabel = language === 'zh-CN' ? layer.typeLabel.zh : layer.typeLabel.en;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/customer/style/[id]/page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/customer/style/[id]/page.tsx src/features/customer/StyleDetailPanel.tsx src/mock/styles.ts src/app/customer/style/[id]/page.test.tsx
git commit -m "feat: localize customer style detail flow"
```

## Task 9: Localize Merchant Manage Flow

**Files:**
- Modify: `src/app/merchant/manage/page.tsx`
- Modify: `src/features/merchant/ManageServiceRow.tsx`
- Modify: `src/features/merchant/GlossaryEntryCard.tsx`
- Modify: `src/lib/services/merchant-pricing-service.ts`
- Test: `src/app/merchant/manage/page.test.tsx`

- [ ] **Step 1: Write the failing merchant-manage localization tests**

```tsx
it('renders manage page in English when merchant language is en', async () => {
  window.localStorage.setItem('merchant-language', 'en');
  render(<MerchantManagePage />);
  expect(screen.getByText('Basic services')).toBeInTheDocument();
  expect(screen.getByText('Preview')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/merchant/manage/page.test.tsx`
Expected: FAIL because manage panels and labels are hardcoded Chinese

- [ ] **Step 3: Implement localized manage UI and glossary labels**

```tsx
// src/app/merchant/manage/page.tsx
import { useLanguage } from '@/i18n/context';
import { pickLocalizedText } from '@/i18n/localized';
import { formatDuration, formatPricingUnitLabel } from '@/i18n/format';

const { language, t } = useLanguage();

const PANELS = [
  { id: 'basic', labelKey: 'manage.panels.basic' },
  { id: 'removal', labelKey: 'manage.panels.removal' },
  { id: 'extension', labelKey: 'manage.panels.extension' },
  { id: 'effects', labelKey: 'manage.panels.effects' },
  { id: 'preview', labelKey: 'manage.panels.preview' },
] as const;

<h2 className="manage-panel-title">{t('manage.basic.title')}</h2>
<span className="manage-module-label">{pickLocalizedText(moduleEntry.name, language)}</span>
<div className="manage-total-duration">
  {t('manage.totalDuration')}：<strong>{formatDuration({ minutes: totalDuration, language })}</strong>
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/merchant/manage/page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/merchant/manage/page.tsx src/features/merchant/ManageServiceRow.tsx src/features/merchant/GlossaryEntryCard.tsx src/lib/services/merchant-pricing-service.ts src/app/merchant/manage/page.test.tsx
git commit -m "feat: localize merchant manage flow"
```

## Task 10: Make AI Recognition and Style Naming Language-Aware

**Files:**
- Modify: `src/nail-ai/nail-recognition.ts`
- Modify: `src/nail-ai/style-config-recognition.ts`
- Modify: `src/nail-ai/breakdown.ts`
- Modify: `src/app/api/ai/recognize-nail-style/route.ts`
- Modify: `src/app/api/ai/breakdown/route.ts`
- Test: `src/lib/actions/merchant-style-actions.test.ts`
- Test: `src/lib/actions/booking-actions.test.ts`

- [ ] **Step 1: Write failing AI-language tests**

```ts
import { describe, expect, it } from 'vitest';
import { normalizeNailRecognition } from '@/nail-ai/nail-recognition';

describe('AI-visible localization', () => {
  it('keeps bilingual visible notes when English output is requested', () => {
    const result = normalizeNailRecognition({
      baseServices: [],
      nailShape: 'round',
      styles: [],
      addons: [],
      otherNotes: {
        zh: '奶白底，珠光反射明显。',
        en: 'Milky base with a visible pearly reflection.',
      },
      confidence: 0.8,
    });

    expect(result.selection.otherNotes.en).toContain('Milky base');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/actions/merchant-style-actions.test.ts src/lib/actions/booking-actions.test.ts`
Expected: FAIL because AI output contracts are single-language strings

- [ ] **Step 3: Implement bilingual AI-output contracts**

```ts
// src/nail-ai/style-config-recognition.ts
export type StyleAiConfig = {
  catalogSelections: CatalogSelection[];
  discoveryFacets: StyleDiscoveryFacet[];
  name: LocalizedText;
  description: LocalizedText;
};

const NAME_PROMPT = (language: 'zh-CN' | 'en') => [
  `Return the name and description in ${language === 'zh-CN' ? 'Simplified Chinese' : 'English'}.`,
  '{ "name": string, "description": string }',
].join('\n');

// src/nail-ai/breakdown.ts
const nailValidationPrompt = (language: 'zh-CN' | 'en') =>
  language === 'zh-CN'
    ? '返回 {"valid":false,"error":"请上传一张美甲照片。"}'
    : 'Return {"valid":false,"error":"Please upload a nail-style photo."}';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/actions/merchant-style-actions.test.ts src/lib/actions/booking-actions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/nail-ai/nail-recognition.ts src/nail-ai/style-config-recognition.ts src/nail-ai/breakdown.ts src/app/api/ai/recognize-nail-style/route.ts src/app/api/ai/breakdown/route.ts src/lib/actions/merchant-style-actions.test.ts src/lib/actions/booking-actions.test.ts
git commit -m "feat: localize visible AI outputs"
```

## Task 11: Run First-Wave Regression and Completeness Checks

**Files:**
- Modify: `src/app/customer/booking/page.test.tsx`
- Modify: `src/app/customer/style/[id]/page.test.tsx`
- Modify: `src/app/merchant/manage/page.test.tsx`
- Modify: `src/app/customer/profile/page.test.tsx`
- Modify: `src/app/merchant/profile/page.test.tsx`

- [ ] **Step 1: Add missing-translation regression assertions**

```tsx
it('does not render raw missing-translation tokens in booking/style/manage first-wave pages', async () => {
  render(<CustomerBookingContent />);
  expect(screen.queryByText(/missing translation/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/\[\[.+\]\]/)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the first-wave regression suite**

Run: `npm test -- src/app/customer/booking/page.test.tsx src/app/customer/booking/confirm/page.test.tsx src/app/customer/style/[id]/page.test.tsx src/app/merchant/manage/page.test.tsx src/app/customer/profile/page.test.tsx src/app/merchant/profile/page.test.tsx src/components/layout/MobileLayout.test.tsx src/components/layout/BottomTabBar.test.tsx`
Expected: PASS

- [ ] **Step 3: Run the full targeted localization suite**

Run: `npm test -- src/i18n/__tests__/format.test.ts src/i18n/__tests__/storage.test.ts src/i18n/__tests__/context.test.tsx src/mock/catalog.test.ts src/domain/recognition-catalog.test.ts src/lib/actions/booking-actions.test.ts src/lib/actions/merchant-style-actions.test.ts`
Expected: PASS

- [ ] **Step 4: Inspect git diff to confirm no landing-page files changed**

Run: `git diff --name-only HEAD~1..HEAD`
Expected: no paths under `src/components/landing` or `src/app/page.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/app/customer/booking/page.test.tsx src/app/customer/style/[id]/page.test.tsx src/app/merchant/manage/page.test.tsx src/app/customer/profile/page.test.tsx src/app/merchant/profile/page.test.tsx
git commit -m "test: add localization regression coverage"
```

## Self-Review

### Spec Coverage

- Shared runtime, persistence, provider, and profile switching are covered by Tasks 1 to 4.
- Bilingual domain-content contracts and first-wave translation review are covered by Tasks 5 and 6.
- First implementation wave for booking/style/manage is covered by Tasks 7 to 9.
- AI language-aware output is covered by Task 10.
- Formatting, regression, missing-translation checks, and landing-page guardrails are covered by Tasks 1 and 11.
- Messages and profile second-wave implementation is intentionally out of this first execution plan and should be written as a follow-up plan after first-wave review and stabilization.

### Placeholder Scan

- No `TBD`, `TODO`, or “similar to previous task” placeholders remain.
- Every task includes exact file paths, concrete commands, and concrete code snippets.

### Type Consistency

- `AppLanguage` is consistently `zh-CN | en`.
- Bilingual content is consistently modeled as `LocalizedText` with `zh` and `en`.
- Role-scoped persistence uses only `customer-language` and `merchant-language`.

