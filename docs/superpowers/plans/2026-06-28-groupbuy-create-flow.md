# Groupbuy Create Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a two-step local groupbuy creation flow inside the merchant manage page, backed by a domain model and local repository.

**Architecture:** Keep `GroupbuyPanel` as the list/create mode owner, move the form into a focused `GroupbuyWizard`, and put persistence and price math behind small helpers. The local repository writes to `localStorage` now, while exposing a shape that can later be replaced by server actions.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Testing Library, CSS

---

## File Map

- `src/domain/groupbuy.ts`
  - New groupbuy types, default draft factory, validation helpers, and constants for form defaults.
- `src/domain/groupbuy-pricing.ts`
  - New pure price calculation helper for selected catalog items and merchant price-list settings.
- `src/domain/groupbuy-pricing.test.ts`
  - Unit tests for pricing-unit behavior and disabled/missing-price items.
- `src/lib/repositories/local/groupbuy-repository.ts`
  - New local-storage repository with list/save draft/publish operations.
- `src/lib/repositories/local/groupbuy-repository.test.ts`
  - Unit tests for repository serialization and local draft/publish behavior.
- `src/features/merchant/GroupbuyWizard.tsx`
  - New two-step create form UI.
- `src/features/merchant/GroupbuyPanel.tsx`
  - Modify to switch between list and create modes, load local deals, and pass price-list context into the wizard.
- `src/app/merchant/manage/page.tsx`
  - Modify the `GroupbuyPanel` call to pass `settingsById` and `currency`.
- `src/app/merchant/manage/page.test.tsx`
  - Extend with interaction tests for add flow, draft save, publish, validation, and back confirmation.
- `src/app/globals.css`
  - Add scoped groupbuy wizard styles beside the existing groupbuy/manage styles.

Do not create git commits unless the user explicitly asks for commits.

## Task 1: Lock Groupbuy Pricing Behavior

**Files:**
- Create: `src/domain/groupbuy-pricing.test.ts`
- Create: `src/domain/groupbuy-pricing.ts`
- Verify against: `src/domain/catalog.ts`
- Verify against: `src/data/glossary-settings-store.ts`

- [ ] **Step 1: Write failing pricing tests**

Create `src/domain/groupbuy-pricing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { GlossaryEntrySettings } from '@/data/glossary-settings-store';
import { calculateGroupbuyOriginalPrice } from './groupbuy-pricing';

const settings = (rows: GlossaryEntrySettings[]) => new Map(rows.map((row) => [row.id, row]));

describe('calculateGroupbuyOriginalPrice', () => {
  it('counts per-set and fixed services once', () => {
    const result = calculateGroupbuyOriginalPrice({
      selections: [
        { catalogItemId: 'basic_manicure_service', enabled: true, quantity: 8 },
        { catalogItemId: 'removal_extension', enabled: true, quantity: 4 },
      ],
      settingsById: settings([
        { id: 'basic_manicure_service', price: 28, duration: 50, enabled: true, unit: 'per_set' },
        { id: 'removal_extension', price: 20, duration: 30, enabled: true, unit: 'fixed' },
      ]),
    });

    expect(result.total).toBe(48);
    expect(result.lines).toEqual([
      expect.objectContaining({ catalogItemId: 'basic_manicure_service', linePrice: 28, quantity: 1 }),
      expect.objectContaining({ catalogItemId: 'removal_extension', linePrice: 20, quantity: 1 }),
    ]);
  });

  it('multiplies per-finger and per-piece services by quantity', () => {
    const result = calculateGroupbuyOriginalPrice({
      selections: [
        { catalogItemId: 'gradient', enabled: true, quantity: 3 },
        { catalogItemId: 'rhinestone_small', enabled: true, quantity: 12 },
      ],
      settingsById: settings([
        { id: 'gradient', price: 5, duration: 20, enabled: true, unit: 'per_finger' },
        { id: 'rhinestone_small', price: 1.5, duration: 2, enabled: true, unit: 'per_piece' },
      ]),
    });

    expect(result.total).toBe(33);
    expect(result.lines).toEqual([
      expect.objectContaining({ catalogItemId: 'gradient', linePrice: 15, quantity: 3 }),
      expect.objectContaining({ catalogItemId: 'rhinestone_small', linePrice: 18, quantity: 12 }),
    ]);
  });

  it('skips disabled, unselected, and zero-price rows', () => {
    const result = calculateGroupbuyOriginalPrice({
      selections: [
        { catalogItemId: 'cat_eye', enabled: false, quantity: 1 },
        { catalogItemId: 'glitter', enabled: true, quantity: 1 },
        { catalogItemId: 'missing_item', enabled: true, quantity: 1 },
      ],
      settingsById: settings([
        { id: 'cat_eye', price: 10, duration: 20, enabled: true, unit: 'per_set' },
        { id: 'glitter', price: 0, duration: 10, enabled: true, unit: 'per_set' },
      ]),
    });

    expect(result.total).toBe(0);
    expect(result.lines).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the pricing test and verify it fails**

Run: `pnpm exec vitest run src/domain/groupbuy-pricing.test.ts`

Expected: FAIL with an import error because `src/domain/groupbuy-pricing.ts` does not exist.

- [ ] **Step 3: Implement the pricing helper**

Create `src/domain/groupbuy-pricing.ts`:

```ts
import type { GlossaryEntrySettings } from '@/data/glossary-settings-store';

export type GroupbuyPriceSelection = {
  catalogItemId: string;
  enabled: boolean;
  quantity: number;
};

export type GroupbuyPriceLine = {
  catalogItemId: string;
  unitPrice: number;
  quantity: number;
  linePrice: number;
  pricingUnit: string;
};

export type CalculateGroupbuyOriginalPriceInput = {
  selections: GroupbuyPriceSelection[];
  settingsById: Map<string, GlossaryEntrySettings>;
};

function unitScalesWithQuantity(unit: string | undefined): boolean {
  return unit === 'per_finger' || unit === 'per_piece';
}

function normalizedQuantity(quantity: number, unit: string | undefined): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return 1;
  const whole = Math.floor(quantity);
  if (unit === 'per_finger') return Math.min(10, whole);
  if (unit === 'per_piece') return Math.min(99, whole);
  return 1;
}

export function calculateGroupbuyOriginalPrice({
  selections,
  settingsById,
}: CalculateGroupbuyOriginalPriceInput): { total: number; lines: GroupbuyPriceLine[] } {
  const lines = selections.flatMap((selection): GroupbuyPriceLine[] => {
    if (!selection.enabled) return [];
    const setting = settingsById.get(selection.catalogItemId);
    if (!setting || !setting.enabled || setting.price <= 0) return [];

    const quantity = normalizedQuantity(selection.quantity, setting.unit);
    const pricingQuantity = unitScalesWithQuantity(setting.unit) ? quantity : 1;
    const linePrice = setting.price * pricingQuantity;

    return [{
      catalogItemId: selection.catalogItemId,
      unitPrice: setting.price,
      quantity,
      linePrice,
      pricingUnit: setting.unit ?? 'per_set',
    }];
  });

  return {
    lines,
    total: lines.reduce((sum, line) => sum + line.linePrice, 0),
  };
}
```

- [ ] **Step 4: Run the pricing test and verify it passes**

Run: `pnpm exec vitest run src/domain/groupbuy-pricing.test.ts`

Expected: PASS.

## Task 2: Add Groupbuy Domain and Local Repository

**Files:**
- Create: `src/domain/groupbuy.ts`
- Create: `src/lib/repositories/local/groupbuy-repository.ts`
- Create: `src/lib/repositories/local/groupbuy-repository.test.ts`
- Verify against: `src/lib/browser-storage.ts`

- [ ] **Step 1: Write failing repository tests**

Create `src/lib/repositories/local/groupbuy-repository.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultGroupbuyDraft } from '@/domain/groupbuy';
import {
  clearGroupbuyDealsForTests,
  listGroupbuyDeals,
  publishGroupbuyDeal,
  saveGroupbuyDraft,
} from './groupbuy-repository';

describe('local groupbuy repository', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearGroupbuyDealsForTests();
  });

  it('saves and lists a draft deal', () => {
    const draft = createDefaultGroupbuyDraft();
    const saved = saveGroupbuyDraft({
      ...draft,
      title: '猫眼通勤团购',
      serviceSelections: [{ catalogItemId: 'basic_manicure_service', enabled: true, quantity: 1 }],
      originalPrice: 28,
    });

    expect(saved.status).toBe('draft');
    expect(listGroupbuyDeals()[0]).toEqual(saved);
  });

  it('publishes a deal with status published', () => {
    const draft = createDefaultGroupbuyDraft();
    const published = publishGroupbuyDeal({
      ...draft,
      title: '猫眼通勤团购',
      serviceSelections: [{ catalogItemId: 'basic_manicure_service', enabled: true, quantity: 1 }],
      originalPrice: 28,
      dealPrice: 20,
    });

    expect(published.status).toBe('published');
    expect(listGroupbuyDeals()[0]?.status).toBe('published');
  });
});
```

- [ ] **Step 2: Run the repository test and verify it fails**

Run: `pnpm exec vitest run src/lib/repositories/local/groupbuy-repository.test.ts`

Expected: FAIL because `src/domain/groupbuy.ts` and the repository module do not exist.

- [ ] **Step 3: Create the domain model**

Create `src/domain/groupbuy.ts`:

```ts
export type GroupbuyStatus = 'draft' | 'published';

export type GroupbuyServiceSelection = {
  catalogItemId: string;
  enabled: boolean;
  quantity: number;
};

export type GroupbuyAvailability =
  | { type: 'all' }
  | { type: 'limited'; windows: Array<{ day: string; startTime: string; endTime: string }> };

export type GroupbuyDeal = {
  id: string;
  title: string;
  status: GroupbuyStatus;
  serviceSelections: GroupbuyServiceSelection[];
  originalPrice: number;
  dealPrice: number | null;
  saleStart: { type: 'afterApproval' } | { type: 'scheduled'; value: string };
  saleEnd: { type: 'autoExtend' } | { type: 'scheduled'; value: string };
  validity: { type: 'days'; days: number } | { type: 'dateRange'; start: string; end: string };
  saleChannel: 'unlimited' | 'followersOnly';
  availability: GroupbuyAvailability;
  benefitSharing: 'notStackable' | 'stackableAll' | 'stackablePartial';
  purchaseLimit: { type: 'none' } | { type: 'perUser'; quantity: number };
  createdAt: string;
  updatedAt: string;
};

export function createDefaultGroupbuyDraft(now = new Date()): GroupbuyDeal {
  const timestamp = now.toISOString();
  return {
    id: `groupbuy-${now.getTime()}`,
    title: '',
    status: 'draft',
    serviceSelections: [],
    originalPrice: 0,
    dealPrice: null,
    saleStart: { type: 'afterApproval' },
    saleEnd: { type: 'autoExtend' },
    validity: { type: 'days', days: 90 },
    saleChannel: 'unlimited',
    availability: { type: 'all' },
    benefitSharing: 'notStackable',
    purchaseLimit: { type: 'none' },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function isValidGroupbuyDeal(value: unknown): value is GroupbuyDeal {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<GroupbuyDeal>;
  return (
    typeof row.id === 'string' &&
    typeof row.title === 'string' &&
    (row.status === 'draft' || row.status === 'published') &&
    Array.isArray(row.serviceSelections) &&
    typeof row.originalPrice === 'number' &&
    (typeof row.dealPrice === 'number' || row.dealPrice === null)
  );
}
```

- [ ] **Step 4: Create the local repository**

Create `src/lib/repositories/local/groupbuy-repository.ts`:

```ts
import type { GroupbuyDeal } from '@/domain/groupbuy';
import { isValidGroupbuyDeal } from '@/domain/groupbuy';
import { getBrowserStorage } from '@/lib/browser-storage';

const STORAGE_KEY = 'nailed-it.groupbuy-deals.v1';

function readStoredDeals(): GroupbuyDeal[] {
  const storage = getBrowserStorage('local');
  if (!storage) return [];

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidGroupbuyDeal);
  } catch {
    return [];
  }
}

function writeStoredDeals(deals: GroupbuyDeal[]): void {
  const storage = getBrowserStorage('local');
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(deals));
}

function upsertDeal(next: GroupbuyDeal): GroupbuyDeal {
  const updated: GroupbuyDeal = { ...next, updatedAt: new Date().toISOString() };
  const existing = readStoredDeals().filter((deal) => deal.id !== updated.id);
  writeStoredDeals([updated, ...existing]);
  return updated;
}

export function listGroupbuyDeals(): GroupbuyDeal[] {
  return readStoredDeals();
}

export function saveGroupbuyDraft(input: GroupbuyDeal): GroupbuyDeal {
  return upsertDeal({ ...input, status: 'draft' });
}

export function publishGroupbuyDeal(input: GroupbuyDeal): GroupbuyDeal {
  return upsertDeal({ ...input, status: 'published' });
}

export function clearGroupbuyDealsForTests(): void {
  const storage = getBrowserStorage('local');
  storage?.removeItem(STORAGE_KEY);
}
```

- [ ] **Step 5: Run the repository test and verify it passes**

Run: `pnpm exec vitest run src/lib/repositories/local/groupbuy-repository.test.ts`

Expected: PASS.

## Task 3: Build the Two-Step Wizard

**Files:**
- Create: `src/features/merchant/GroupbuyWizard.tsx`
- Modify: `src/app/merchant/manage/page.test.tsx`
- Verify against: `src/features/merchant/ManageServiceRow.tsx`
- Verify against: `src/components/ui/Button.tsx`
- Verify against: `src/components/ui/Dialog.tsx`

- [ ] **Step 1: Add failing manage-page wizard interaction tests**

Append focused tests to `src/app/merchant/manage/page.test.tsx`:

```ts
it('opens the add groupbuy wizard from the groupbuy panel', async () => {
  renderManagePage();

  fireEvent.click(screen.getByRole('button', { name: '团购管理' }));
  fireEvent.click(screen.getByRole('button', { name: '+ 添加团购' }));

  expect(screen.getByRole('button', { name: '返回' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: '团购内容' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tab', { name: '价格时间' })).toHaveAttribute('aria-selected', 'false');
  expect(screen.getByLabelText('团购名称')).toBeInTheDocument();
});

it('validates groupbuy name before moving to price and time', async () => {
  renderManagePage();

  fireEvent.click(screen.getByRole('button', { name: '团购管理' }));
  fireEvent.click(screen.getByRole('button', { name: '+ 添加团购' }));
  fireEvent.change(screen.getByLabelText('团购名称'), {
    target: { value: '超过二十个字的团购名称会被拦截因为太长' },
  });
  fireEvent.click(screen.getByRole('button', { name: '下一步' }));

  expect(screen.getByText('团购名称不能超过20个字')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: '团购内容' })).toHaveAttribute('aria-selected', 'true');
});
```

- [ ] **Step 2: Run the manage-page tests and verify they fail**

Run: `pnpm exec vitest run src/app/merchant/manage/page.test.tsx`

Expected: FAIL because the add link is still an anchor and no wizard exists.

- [ ] **Step 3: Create the wizard component shell**

Create `src/features/merchant/GroupbuyWizard.tsx` with this structure:

```tsx
'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import type { GlossaryEntrySettings } from '@/data/glossary-settings-store';
import { glossaryById } from '@/data/glossary';
import { calculateGroupbuyOriginalPrice } from '@/domain/groupbuy-pricing';
import type { GroupbuyDeal, GroupbuyServiceSelection } from '@/domain/groupbuy';
import { createDefaultGroupbuyDraft } from '@/domain/groupbuy';

type GroupbuyWizardProps = {
  language: 'zh-CN' | 'en';
  currency: string;
  settingsById: Map<string, GlossaryEntrySettings>;
  onCancel: () => void;
  onSaveDraft: (deal: GroupbuyDeal) => void;
  onPublish: (deal: GroupbuyDeal) => void;
};

const SERVICE_GROUPS = [
  { id: 'base', label: '基础服务', ids: ['basic_manicure_service'], quantity: false },
  { id: 'removal', label: '卸甲', ids: ['removal_basic_gel', 'removal_extension', 'removal_with_rhinestone'], quantity: false },
  { id: 'extension', label: '建构/延长', ids: ['nail_tip_full_cover', 'nail_tip_half_cover', 'nail_tip_shallow_cover', 'builder_gel'], quantity: false },
  { id: 'color', label: '颜色效果', ids: ['color_split', 'solid_color', 'gradient', 'aura_blush', 'ink_wash', 'jelly_translucent', 'cat_eye', 'glitter', 'matte_top', 'magnetic_special_effect'], quantity: true },
  { id: 'art', label: '艺术效果', ids: ['french_tip_basic', 'french_tip_special', 'hand_paint_simple', 'hand_paint_medium', 'hand_paint_complex', 'line_art', 'pattern_art', '3d_art'], quantity: true },
  { id: 'deco', label: '装饰效果', ids: ['sticker', 'rhinestone_small', 'rhinestone_large', 'rhinestone_heavy', 'pearl', 'metal_charm', 'bow_charm', 'chain_charm', 'shell_piece', 'foil_piece', 'chrome_powder', 'aurora_powder', 'pearl_powder'], quantity: true },
] as const;

function itemName(id: string, language: 'zh-CN' | 'en'): string {
  const entry = glossaryById.get(id);
  if (!entry) return id;
  return language === 'zh-CN' ? entry.name_zh : entry.name_en;
}

export function GroupbuyWizard({
  language,
  currency,
  settingsById,
  onCancel,
  onSaveDraft,
  onPublish,
}: GroupbuyWizardProps) {
  const [step, setStep] = useState<'content' | 'pricing'>('content');
  const [draft, setDraft] = useState<GroupbuyDeal>(() => createDefaultGroupbuyDraft());
  const [nameError, setNameError] = useState('');
  const [priceError, setPriceError] = useState('');
  const [confirmBack, setConfirmBack] = useState(false);
  const [dirty, setDirty] = useState(false);

  const price = useMemo(
    () => calculateGroupbuyOriginalPrice({ selections: draft.serviceSelections, settingsById }),
    [draft.serviceSelections, settingsById]
  );

  function updateDraft(next: GroupbuyDeal) {
    setDraft({ ...next, originalPrice: price.total });
    setDirty(true);
  }

  function validateName() {
    const trimmed = draft.title.trim();
    if (!trimmed) {
      setNameError('请输入团购名称');
      return false;
    }
    if (trimmed.length > 20) {
      setNameError('团购名称不能超过20个字');
      return false;
    }
    setNameError('');
    return true;
  }

  function toggleSelection(catalogItemId: string, enabled: boolean) {
    const existing = draft.serviceSelections.find((selection) => selection.catalogItemId === catalogItemId);
    const nextSelection: GroupbuyServiceSelection = {
      catalogItemId,
      enabled,
      quantity: existing?.quantity ?? 1,
    };
    const rest = draft.serviceSelections.filter((selection) => selection.catalogItemId !== catalogItemId);
    updateDraft({ ...draft, serviceSelections: [nextSelection, ...rest] });
  }

  function setQuantity(catalogItemId: string, quantity: number) {
    updateDraft({
      ...draft,
      serviceSelections: draft.serviceSelections.map((selection) =>
        selection.catalogItemId === catalogItemId
          ? { ...selection, quantity: Math.max(1, Math.floor(quantity) || 1) }
          : selection
      ),
    });
  }

  function handleNext() {
    if (!validateName()) return;
    setStep('pricing');
  }

  function handleSaveDraft() {
    onSaveDraft({ ...draft, originalPrice: price.total, status: 'draft' });
  }

  function handlePublish() {
    if (!validateName()) {
      setStep('content');
      return;
    }
    if (price.total <= 0) {
      setPriceError('请至少选择一个服务内容');
      return;
    }
    if (draft.dealPrice == null || draft.dealPrice <= 0 || draft.dealPrice >= price.total) {
      setPriceError('团购价格必须小于当前服务原价');
      return;
    }
    setPriceError('');
    onPublish({ ...draft, originalPrice: price.total, status: 'published' });
  }

  return (
    <div className="groupbuy-wizard">
      <div className="groupbuy-wizard-topbar">
        <button type="button" className="groupbuy-back-btn" onClick={() => (dirty ? setConfirmBack(true) : onCancel())}>
          返回
        </button>
        <div className="groupbuy-step-tabs" role="tablist" aria-label="添加团购步骤">
          <button type="button" role="tab" aria-selected={step === 'content'} onClick={() => setStep('content')}>
            团购内容
          </button>
          <button type="button" role="tab" aria-selected={step === 'pricing'} onClick={handleNext}>
            价格时间
          </button>
        </div>
      </div>

      {step === 'content' ? (
        <div className="groupbuy-step-panel">
          <label className="groupbuy-field">
            <span>团购名称</span>
            <input
              aria-label="团购名称"
              value={draft.title}
              maxLength={24}
              onChange={(event) => updateDraft({ ...draft, title: event.target.value })}
            />
          </label>
          {nameError ? <p className="groupbuy-error">{nameError}</p> : null}

          <div className="groupbuy-service-groups">
            {SERVICE_GROUPS.map((group) => (
              <section key={group.id} className="groupbuy-service-group">
                <h3>{group.label}</h3>
                {group.ids.map((id) => {
                  const selection = draft.serviceSelections.find((row) => row.catalogItemId === id);
                  const setting = settingsById.get(id);
                  const unavailable = !setting || !setting.enabled || setting.price <= 0;
                  return (
                    <div key={id} className="groupbuy-service-row">
                      <label>
                        <input
                          type="checkbox"
                          checked={selection?.enabled ?? false}
                          disabled={unavailable}
                          onChange={(event) => toggleSelection(id, event.target.checked)}
                        />
                        <span>{itemName(id, language)}</span>
                      </label>
                      <span>{unavailable ? '未定价' : `${setting.price} ${currency}`}</span>
                      {group.quantity && selection?.enabled ? (
                        <input
                          aria-label={`${itemName(id, language)} 数量`}
                          type="number"
                          min={1}
                          value={selection.quantity}
                          onChange={(event) => setQuantity(id, Number(event.target.value))}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </section>
            ))}
          </div>

          <div className="groupbuy-wizard-footer">
            <Button variant="secondary" onClick={handleSaveDraft}>保存</Button>
            <Button onClick={handleNext}>下一步</Button>
          </div>
        </div>
      ) : (
        <div className="groupbuy-step-panel">
          <p className="groupbuy-original-price">当前服务原价：{price.total.toFixed(2)} {currency}</p>
          <label className="groupbuy-field">
            <span>设置价格</span>
            <input
              aria-label="设置价格"
              type="number"
              min={0}
              value={draft.dealPrice ?? ''}
              onChange={(event) => updateDraft({ ...draft, dealPrice: Number(event.target.value) || null })}
            />
          </label>
          {priceError ? <p className="groupbuy-error">{priceError}</p> : null}

          <div className="groupbuy-form-section" aria-label="价格时间设置">
            <fieldset>
              <legend>售卖开始时间</legend>
              <label>
                <input
                  type="radio"
                  name="sale-start"
                  checked={draft.saleStart.type === 'afterApproval'}
                  onChange={() => updateDraft({ ...draft, saleStart: { type: 'afterApproval' } })}
                />
                审核通过立即售卖
              </label>
              <label>
                <input
                  type="radio"
                  name="sale-start"
                  checked={draft.saleStart.type === 'scheduled'}
                  onChange={() => updateDraft({ ...draft, saleStart: { type: 'scheduled', value: '' } })}
                />
                设置售卖开始时间
              </label>
              {draft.saleStart.type === 'scheduled' ? (
                <input
                  aria-label="售卖开始时间"
                  type="datetime-local"
                  value={draft.saleStart.value}
                  onChange={(event) => updateDraft({ ...draft, saleStart: { type: 'scheduled', value: event.target.value } })}
                />
              ) : null}
            </fieldset>

            <fieldset>
              <legend>售卖结束时间</legend>
              <label>
                <input
                  type="radio"
                  name="sale-end"
                  checked={draft.saleEnd.type === 'autoExtend'}
                  onChange={() => updateDraft({ ...draft, saleEnd: { type: 'autoExtend' } })}
                />
                自动延期保持售卖
              </label>
              <label>
                <input
                  type="radio"
                  name="sale-end"
                  checked={draft.saleEnd.type === 'scheduled'}
                  onChange={() => updateDraft({ ...draft, saleEnd: { type: 'scheduled', value: '' } })}
                />
                设置售卖结束时间
              </label>
              {draft.saleEnd.type === 'scheduled' ? (
                <input
                  aria-label="售卖结束时间"
                  type="datetime-local"
                  value={draft.saleEnd.value}
                  onChange={(event) => updateDraft({ ...draft, saleEnd: { type: 'scheduled', value: event.target.value } })}
                />
              ) : null}
            </fieldset>

            <fieldset>
              <legend>售卖渠道</legend>
              <label>
                <input
                  type="radio"
                  name="sale-channel"
                  checked={draft.saleChannel === 'unlimited'}
                  onChange={() => updateDraft({ ...draft, saleChannel: 'unlimited' })}
                />
                不限制
              </label>
              <label>
                <input
                  type="radio"
                  name="sale-channel"
                  checked={draft.saleChannel === 'followersOnly'}
                  onChange={() => updateDraft({ ...draft, saleChannel: 'followersOnly' })}
                />
                已关注我的粉丝
              </label>
            </fieldset>

            <fieldset>
              <legend>团购使用有效期</legend>
              <label>
                <input
                  type="radio"
                  name="validity"
                  checked={draft.validity.type === 'days'}
                  onChange={() => updateDraft({ ...draft, validity: { type: 'days', days: 90 } })}
                />
                指定天数内有效
              </label>
              {draft.validity.type === 'days' ? (
                <label>
                  用户购买
                  <input
                    aria-label="有效天数"
                    type="number"
                    min={1}
                    value={draft.validity.days}
                    onChange={(event) => updateDraft({ ...draft, validity: { type: 'days', days: Math.max(1, Number(event.target.value) || 1) } })}
                  />
                  天内有效
                </label>
              ) : null}
              <label>
                <input
                  type="radio"
                  name="validity"
                  checked={draft.validity.type === 'dateRange'}
                  onChange={() => updateDraft({ ...draft, validity: { type: 'dateRange', start: '', end: '' } })}
                />
                指定时间段内有效
              </label>
            </fieldset>

            <fieldset>
              <legend>可用时段</legend>
              <label>
                <input
                  type="radio"
                  name="availability"
                  checked={draft.availability.type === 'all'}
                  onChange={() => updateDraft({ ...draft, availability: { type: 'all' } })}
                />
                全部时间可用
              </label>
              <label>
                <input
                  type="radio"
                  name="availability"
                  checked={draft.availability.type === 'limited'}
                  onChange={() => updateDraft({ ...draft, availability: { type: 'limited', windows: [] } })}
                />
                限制时间
              </label>
            </fieldset>

            <fieldset>
              <legend>优惠同享信息</legend>
              <label>
                <input
                  type="radio"
                  name="benefit-sharing"
                  checked={draft.benefitSharing === 'notStackable'}
                  onChange={() => updateDraft({ ...draft, benefitSharing: 'notStackable' })}
                />
                团购不可与其他优惠同享
              </label>
              <label>
                <input
                  type="radio"
                  name="benefit-sharing"
                  checked={draft.benefitSharing === 'stackableAll'}
                  onChange={() => updateDraft({ ...draft, benefitSharing: 'stackableAll' })}
                />
                团购可与全部优惠同享
              </label>
              <label>
                <input
                  type="radio"
                  name="benefit-sharing"
                  checked={draft.benefitSharing === 'stackablePartial'}
                  onChange={() => updateDraft({ ...draft, benefitSharing: 'stackablePartial' })}
                />
                团购只可与部分优惠同享
              </label>
            </fieldset>

            <fieldset>
              <legend>单人购买量限制</legend>
              <label>
                <input
                  type="radio"
                  name="purchase-limit"
                  checked={draft.purchaseLimit.type === 'none'}
                  onChange={() => updateDraft({ ...draft, purchaseLimit: { type: 'none' } })}
                />
                不限制
              </label>
              <label>
                <input
                  type="radio"
                  name="purchase-limit"
                  checked={draft.purchaseLimit.type === 'perUser'}
                  onChange={() => updateDraft({ ...draft, purchaseLimit: { type: 'perUser', quantity: 1 } })}
                />
                设置单人购买数量上限
              </label>
              {draft.purchaseLimit.type === 'perUser' ? (
                <input
                  aria-label="单人购买数量上限"
                  type="number"
                  min={1}
                  value={draft.purchaseLimit.quantity}
                  onChange={(event) => updateDraft({ ...draft, purchaseLimit: { type: 'perUser', quantity: Math.max(1, Number(event.target.value) || 1) } })}
                />
              ) : null}
            </fieldset>
          </div>

          <div className="groupbuy-wizard-footer">
            <Button variant="secondary" onClick={() => setStep('content')}>上一步</Button>
            <Button variant="secondary" onClick={handleSaveDraft}>保存</Button>
            <Button onClick={handlePublish}>发布</Button>
          </div>
        </div>
      )}

      <Dialog open={confirmBack} onOpenChange={setConfirmBack} title="是否保存草稿？">
        <div className="groupbuy-back-dialog-actions">
          <Button onClick={handleSaveDraft}>保存草稿暂不发布</Button>
          <Button variant="secondary" onClick={onCancel}>放弃</Button>
          <Button variant="ghost" onClick={() => setConfirmBack(false)}>继续编辑</Button>
        </div>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 4: Run manage-page tests and keep the expected failure local to panel wiring**

Run: `pnpm exec vitest run src/app/merchant/manage/page.test.tsx`

Expected: FAIL because `GroupbuyPanel` has not rendered `GroupbuyWizard` yet.

## Task 4: Wire the Wizard Into GroupbuyPanel

**Files:**
- Modify: `src/features/merchant/GroupbuyPanel.tsx`
- Modify: `src/app/merchant/manage/page.tsx`
- Modify: `src/app/merchant/manage/page.test.tsx`
- Verify against: `src/lib/repositories/local/groupbuy-repository.ts`

- [ ] **Step 1: Change `GroupbuyPanel` props and mode state**

Modify `src/features/merchant/GroupbuyPanel.tsx` imports and props:

```tsx
import { useEffect, useState } from 'react';
import type { GlossaryEntrySettings } from '@/data/glossary-settings-store';
import type { GroupbuyDeal } from '@/domain/groupbuy';
import { GroupbuyWizard } from '@/features/merchant/GroupbuyWizard';
import {
  listGroupbuyDeals,
  publishGroupbuyDeal,
  saveGroupbuyDraft,
} from '@/lib/repositories/local/groupbuy-repository';

type GroupbuyPanelProps = {
  language: 'zh-CN' | 'en';
  currency: string;
  settingsById: Map<string, GlossaryEntrySettings>;
};
```

- [ ] **Step 2: Render list/create modes and local saved deals first**

Replace the component body shape in `GroupbuyPanel`:

```tsx
export function GroupbuyPanel({ language, currency, settingsById }: GroupbuyPanelProps) {
  const t = copy[language];
  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [localDeals, setLocalDeals] = useState<GroupbuyDeal[]>([]);

  useEffect(() => {
    setLocalDeals(listGroupbuyDeals());
  }, []);

  function refreshDeals() {
    setLocalDeals(listGroupbuyDeals());
    setMode('list');
  }

  if (mode === 'create') {
    return (
      <div className="manage-panel-content groupbuy-panel">
        <GroupbuyWizard
          language={language}
          currency={currency}
          settingsById={settingsById}
          onCancel={() => setMode('list')}
          onSaveDraft={(deal) => {
            saveGroupbuyDraft(deal);
            refreshDeals();
          }}
          onPublish={(deal) => {
            publishGroupbuyDeal(deal);
            refreshDeals();
          }}
        />
      </div>
    );
  }

  const savedDealCards = localDeals.map((deal) => ({
    id: deal.id,
    title: deal.title || '未命名团购草稿',
    elements: deal.serviceSelections.slice(0, 3).map((selection) => selection.catalogItemId),
    price: deal.dealPrice ?? 0,
    originalPrice: deal.originalPrice,
    purchaseCount: 0,
    redemptionCount: 0,
    status: deal.status,
  }));
  const deals = [...savedDealCards, ...mockDeals.map((deal) => ({ ...deal, status: 'published' as const }))];

  return (
    <div className="manage-panel-content groupbuy-panel">
      {/* keep existing AI assistant card */}
      <div className="manage-section-heading">{t.listHeader}</div>
      <div className="groupbuy-deal-list">
        {deals.map((deal) => (
          <div key={deal.id} className="groupbuy-deal-card">
            <div className="groupbuy-deal-body">
              <p className="groupbuy-deal-title">{deal.title}</p>
              {'status' in deal && deal.status === 'draft' ? <span className="groupbuy-status-pill">草稿</span> : null}
              {/* keep the existing element tags, price row, and meta row */}
            </div>
            <button type="button" className="button button-primary button-compact groupbuy-deal-cta">
              {t.viewBtn}
            </button>
          </div>
        ))}
        <button type="button" className="groupbuy-add-btn" onClick={() => setMode('create')}>
          {t.addBtn}
        </button>
      </div>
    </div>
  );
}
```

Keep the existing AI assistant JSX and deal-card JSX; convert interactive anchors with `href="#"` to buttons to avoid page jumps.

- [ ] **Step 3: Pass pricing context from manage page**

Modify `src/app/merchant/manage/page.tsx`:

```tsx
{activePanel === 'groupbuy'  && (
  <GroupbuyPanel language={language} currency={currency} settingsById={settingsById} />
)}
```

- [ ] **Step 4: Run manage-page tests and verify wizard opens**

Run: `pnpm exec vitest run src/app/merchant/manage/page.test.tsx`

Expected: PASS for the existing tests and the new wizard open/name validation tests.

## Task 5: Cover Save Draft, Publish, and Back Confirmation

**Files:**
- Modify: `src/app/merchant/manage/page.test.tsx`
- Modify: `src/features/merchant/GroupbuyWizard.tsx`
- Modify: `src/features/merchant/GroupbuyPanel.tsx`

- [ ] **Step 1: Add failing save/publish/back tests**

Append tests:

```ts
it('saves a local groupbuy draft and returns it to the list', async () => {
  renderManagePage();

  fireEvent.click(screen.getByRole('button', { name: '团购管理' }));
  fireEvent.click(screen.getByRole('button', { name: '+ 添加团购' }));
  fireEvent.change(screen.getByLabelText('团购名称'), { target: { value: '猫眼通勤团购' } });
  fireEvent.click(screen.getByLabelText(/基础护理服务/));
  fireEvent.click(screen.getByRole('button', { name: '保存' }));

  expect(await screen.findByText('猫眼通勤团购')).toBeInTheDocument();
  expect(screen.getByText('草稿')).toBeInTheDocument();
});

it('publishes a local groupbuy when price is lower than original price', async () => {
  renderManagePage();

  fireEvent.click(screen.getByRole('button', { name: '团购管理' }));
  fireEvent.click(screen.getByRole('button', { name: '+ 添加团购' }));
  fireEvent.change(screen.getByLabelText('团购名称'), { target: { value: '猫眼通勤团购' } });
  fireEvent.click(screen.getByLabelText(/基础护理服务/));
  fireEvent.click(screen.getByRole('button', { name: '下一步' }));
  fireEvent.change(screen.getByLabelText('设置价格'), { target: { value: '20' } });
  fireEvent.click(screen.getByRole('button', { name: '发布' }));

  expect(await screen.findByText('猫眼通勤团购')).toBeInTheDocument();
  expect(screen.queryByText('草稿')).not.toBeInTheDocument();
});

it('requires publish price to be lower than original price', async () => {
  renderManagePage();

  fireEvent.click(screen.getByRole('button', { name: '团购管理' }));
  fireEvent.click(screen.getByRole('button', { name: '+ 添加团购' }));
  fireEvent.change(screen.getByLabelText('团购名称'), { target: { value: '猫眼通勤团购' } });
  fireEvent.click(screen.getByLabelText(/基础护理服务/));
  fireEvent.click(screen.getByRole('button', { name: '下一步' }));
  fireEvent.change(screen.getByLabelText('设置价格'), { target: { value: '999' } });
  fireEvent.click(screen.getByRole('button', { name: '发布' }));

  expect(screen.getByText('团购价格必须小于当前服务原价')).toBeInTheDocument();
});

it('asks whether to save a dirty draft before returning', async () => {
  renderManagePage();

  fireEvent.click(screen.getByRole('button', { name: '团购管理' }));
  fireEvent.click(screen.getByRole('button', { name: '+ 添加团购' }));
  fireEvent.change(screen.getByLabelText('团购名称'), { target: { value: '猫眼通勤团购' } });
  fireEvent.click(screen.getByRole('button', { name: '返回' }));

  expect(screen.getByText('是否保存草稿？')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '保存草稿暂不发布' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '放弃' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '继续编辑' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the tests and capture current failures**

Run: `pnpm exec vitest run src/app/merchant/manage/page.test.tsx`

Expected: FAIL if save/publish/back behavior is incomplete.

- [ ] **Step 3: Fix draft original price updates**

In `GroupbuyWizard`, compute the next price from the next selections before saving:

```tsx
function withCurrentPrice(next: GroupbuyDeal): GroupbuyDeal {
  const nextPrice = calculateGroupbuyOriginalPrice({
    selections: next.serviceSelections,
    settingsById,
  });
  return { ...next, originalPrice: nextPrice.total };
}

function updateDraft(next: GroupbuyDeal) {
  setDraft(withCurrentPrice(next));
  setDirty(true);
}
```

- [ ] **Step 4: Ensure save and publish exit to the refreshed list**

In `GroupbuyPanel`, keep `refreshDeals()` as the only post-save path:

```tsx
function refreshDeals() {
  setLocalDeals(listGroupbuyDeals());
  setMode('list');
}
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `pnpm exec vitest run src/app/merchant/manage/page.test.tsx`

Expected: PASS.

## Task 6: Add Production UI Styling

**Files:**
- Modify: `src/app/globals.css`
- Verify against: `src/features/merchant/GroupbuyWizard.tsx`
- Verify against: `src/features/merchant/GroupbuyPanel.tsx`

- [ ] **Step 1: Add scoped wizard styles**

Add these styles near the existing groupbuy/manage styles in `src/app/globals.css`:

```css
.groupbuy-wizard {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  gap: var(--space-4);
}

.groupbuy-wizard-topbar {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  background: var(--color-bg);
}

.groupbuy-back-btn {
  border: 0;
  background: transparent;
  color: var(--color-accent-strong);
  font-weight: 700;
}

.groupbuy-step-tabs {
  display: inline-flex;
  padding: 0.2rem;
  border-radius: var(--radius-pill);
  background: rgba(236, 93, 123, 0.1);
}

.groupbuy-step-tabs button {
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-muted);
  font-size: var(--text-sm);
  font-weight: 700;
  padding: 0.45rem 0.75rem;
}

.groupbuy-step-tabs button[aria-selected='true'] {
  background: var(--color-surface-strong);
  color: var(--color-accent-strong);
  box-shadow: var(--shadow-soft);
}

.groupbuy-step-panel,
.groupbuy-service-group,
.groupbuy-form-section {
  display: grid;
  gap: var(--space-3);
}

.groupbuy-field {
  display: grid;
  gap: var(--space-2);
  color: var(--color-text);
  font-size: var(--text-sm);
  font-weight: 700;
}

.groupbuy-field input,
.groupbuy-service-row input[type='number'] {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-strong);
  color: var(--color-text);
  padding: 0.65rem 0.75rem;
}

.groupbuy-service-group {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  padding: var(--space-3);
}

.groupbuy-service-group h3 {
  margin: 0;
  font-size: var(--text-base);
}

.groupbuy-service-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
}

.groupbuy-service-row label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.groupbuy-error {
  margin: 0;
  color: var(--color-danger);
  font-size: var(--text-xs);
}

.groupbuy-original-price {
  margin: 0;
  border-radius: var(--radius-lg);
  background: var(--color-accent-soft);
  color: var(--color-accent-strong);
  font-weight: 800;
  padding: var(--space-3);
}

.groupbuy-wizard-footer,
.groupbuy-back-dialog-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
}

.groupbuy-status-pill {
  width: fit-content;
  border-radius: var(--radius-pill);
  background: rgba(217, 119, 6, 0.12);
  color: var(--color-warning);
  font-size: var(--text-xs);
  font-weight: 700;
  padding: 0.2rem 0.5rem;
}
```

- [ ] **Step 2: Run component tests after styling**

Run: `pnpm exec vitest run src/app/merchant/manage/page.test.tsx src/domain/groupbuy-pricing.test.ts src/lib/repositories/local/groupbuy-repository.test.ts`

Expected: PASS.

## Task 7: Final Verification

**Files:**
- Verify: all modified and created files

- [ ] **Step 1: Run TypeScript**

Run: `pnpm exec tsc --noEmit`

Expected: PASS.

- [ ] **Step 2: Run focused tests**

Run: `pnpm exec vitest run src/app/merchant/manage/page.test.tsx src/domain/groupbuy-pricing.test.ts src/lib/repositories/local/groupbuy-repository.test.ts`

Expected: PASS.

- [ ] **Step 3: Inspect changed files**

Run: `git diff -- src/domain/groupbuy.ts src/domain/groupbuy-pricing.ts src/domain/groupbuy-pricing.test.ts src/lib/repositories/local/groupbuy-repository.ts src/lib/repositories/local/groupbuy-repository.test.ts src/features/merchant/GroupbuyWizard.tsx src/features/merchant/GroupbuyPanel.tsx src/app/merchant/manage/page.tsx src/app/merchant/manage/page.test.tsx src/app/globals.css`

Expected: diff contains only the groupbuy create flow, local repository, focused tests, and scoped styles.

- [ ] **Step 4: Report verification**

Summarize:

- whether TypeScript passed
- whether focused tests passed
- any tests not run
- any implementation trade-offs kept for backend persistence later
