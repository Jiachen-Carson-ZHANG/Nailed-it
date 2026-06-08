# Booking Result Breakdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the shared booking result breakdown panel so extension results seed the right structure chips, the shape block is simplified, base color moves into color effects, and effect buckets stay independently open.

**Architecture:** Keep the patch local to the shared `ComponentBreakdownPanel` and its copy helpers. Add one state-seeding regression test for structure dependencies and one focused rendering test file for the simplified section layout and multi-open effect behavior, then implement the minimum panel changes needed to satisfy those tests.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Testing Library

---

### Task 1: Lock the requested breakdown behavior in tests

**Files:**
- Modify: `src/features/customer/component-breakdown-config.test.ts`
- Create: `src/features/customer/ComponentBreakdownPanel.test.tsx`
- Verify against: `src/features/customer/ComponentBreakdownPanel.tsx`
- Verify against: `src/features/customer/breakdown-panel-copy.ts`

- [ ] **Step 1: Add a failing seeding regression for extension dependencies**

```ts
it('seeds builder gel and half cover tip when extension is present in the breakdown', () => {
  const settingsById = new Map(getDefaultSettings().map((s) => [s.id, s]));
  const stored = buildBreakdownResult(
    null,
    new Set(['nail_tip_full_cover']),
    null,
    null,
    null,
    new Set(),
    new Set(),
    new Set(),
    new Set(),
    new Map(),
    settingsById,
  );

  const chip = seedStateFromBreakdown(stored);
  expect(chip.structureIds.has('nail_tip_full_cover')).toBe(true);
  expect(chip.structureIds.has('builder_gel')).toBe(true);
  expect(chip.structureIds.has('nail_tip_half_cover')).toBe(true);
});
```

- [ ] **Step 2: Create a focused panel rendering test file**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LanguageProvider } from '@/i18n/context';
import type { BreakdownResult } from '@/domain/nail';
import { ComponentBreakdownPanel, buildBreakdownResult } from './ComponentBreakdownPanel';
import { getDefaultSettings } from '@/data/glossary-settings-store';

function renderPanel(cachedResult: BreakdownResult) {
  return render(
    <LanguageProvider initialLanguage="zh-CN" role="customer">
      <ComponentBreakdownPanel
        image={null}
        cachedResult={cachedResult}
        autoAnalyze={false}
      />
    </LanguageProvider>
  );
}
```

- [ ] **Step 3: Add a failing layout test for the simplified shape section**

```tsx
it('renders the simplified nail shape section without texture or base color rows', () => {
  const settingsById = new Map(getDefaultSettings().map((s) => [s.id, s]));
  const cachedResult = buildBreakdownResult(
    null,
    new Set(),
    'almond',
    'medium_length',
    'matte_top',
    new Set(['solid_color']),
    new Set(),
    new Set(),
    new Set(),
    new Map(),
    settingsById,
  );

  const { container } = renderPanel(cachedResult);

  const section = screen.getByRole('heading', { name: '甲型' }).closest('.analyze-section');
  expect(section).not.toBeNull();
  expect(container.querySelector('.analyze-subrow-label')?.textContent).toBeTruthy();
  expect(screen.getByText('甲长')).toBeInTheDocument();
  expect(screen.queryByText('质感')).not.toBeInTheDocument();
  expect(screen.queryByText('底色（可多选）')).not.toBeInTheDocument();
});
```

- [ ] **Step 4: Add a failing interaction test for moved base color and independent effect toggles**

```tsx
it('keeps color and art effects open together and shows base color inside color effects', () => {
  const settingsById = new Map(getDefaultSettings().map((s) => [s.id, s]));
  const cachedResult = buildBreakdownResult(
    null,
    new Set(),
    'almond',
    'medium_length',
    null,
    new Set(['solid_color']),
    new Set(['cat_eye']),
    new Set(['french_tip_basic']),
    new Set(),
    new Map(),
    settingsById,
  );

  renderPanel(cachedResult);

  fireEvent.click(screen.getByRole('button', { name: /颜色效果/i }));
  fireEvent.click(screen.getByRole('button', { name: /艺术效果/i }));

  expect(screen.getByText('底色（可多选）')).toBeInTheDocument();
  expect(screen.getByText('纯色')).toBeInTheDocument();
  expect(screen.getByText('猫眼')).toBeInTheDocument();
  expect(screen.getByText('法式')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /颜色效果/i }));
  expect(screen.queryByText('底色（可多选）')).not.toBeInTheDocument();
  expect(screen.getByText('法式')).toBeInTheDocument();
});
```

- [ ] **Step 5: Run the targeted tests to confirm current behavior fails**

Run: `pnpm vitest src/features/customer/component-breakdown-config.test.ts src/features/customer/ComponentBreakdownPanel.test.tsx`
Expected: FAIL because the current panel does not seed the dependency chips, still renders the old shape/color grouping, and closes one effect bucket when another opens.

### Task 2: Implement the shared panel behavior changes

**Files:**
- Modify: `src/features/customer/ComponentBreakdownPanel.tsx`
- Modify: `src/features/customer/breakdown-panel-copy.ts`
- Test: `src/features/customer/component-breakdown-config.test.ts`
- Test: `src/features/customer/ComponentBreakdownPanel.test.tsx`

- [ ] **Step 1: Add a structure dependency helper in the panel module**

```ts
const EXTENSION_DEPENDENCY_IDS = ['builder_gel', 'nail_tip_half_cover'] as const;

function applyStructureDependencies(structureIds: Set<string>): Set<string> {
  const next = new Set(structureIds);
  if (next.has('nail_tip_full_cover')) {
    for (const id of EXTENSION_DEPENDENCY_IDS) {
      next.add(id);
    }
  }
  return next;
}
```

- [ ] **Step 2: Apply the dependency helper during seeded-state hydration only**

```ts
export function seedStateFromBreakdown(result: BreakdownResult) {
  const structureIds = new Set<string>();
  // existing parsing logic...

  return {
    removalId,
    structureIds: applyStructureDependencies(structureIds),
    nailShape,
    nailLength,
    texture,
    colorIds,
    colorEffectIds,
    artIds,
    decoIds,
    quantities,
  };
}
```

- [ ] **Step 3: Rename the section copy key and remove the old combined title**

```ts
shapeSection: '甲型',
nailShape: '甲型',
nailLength: '甲长',
texture: '质感',
baseColor: '底色（可多选）',
```

```ts
shapeSection: 'Shape',
nailShape: 'Shape',
nailLength: 'Length',
texture: 'Finish',
baseColor: 'Base colour (multi-select)',
```

- [ ] **Step 4: Simplify the main panel layout to keep only shape and length in the shape section**

```tsx
<div className="analyze-section">
  <h3 className="analyze-section-title">{copy.shapeSection}</h3>
  <div className="analyze-subrow">
    <div className="analyze-subrow-label">{copy.nailShape}</div>
    <ChipGroup
      ids={SHAPE_IDS}
      activeIds={nailShape}
      mode="single"
      onToggle={(id) => toggleSingle(nailShape, setNailShape, id)}
      showAdd
      language={language}
      copy={copy}
    />
  </div>
  <div className="analyze-subrow">
    <div className="analyze-subrow-label">{copy.nailLength}</div>
    <ChipGroup
      ids={LENGTH_IDS}
      activeIds={nailLength}
      mode="single"
      onToggle={(id) => toggleSingle(nailLength, setNailLength, id)}
      showAdd
      language={language}
      copy={copy}
    />
  </div>
</div>
```

- [ ] **Step 5: Move base color rendering into the color effects bucket**

```tsx
function EffectsSection({
  colorIds,
  colorEffectIds,
  artIds,
  decoIds,
  quantities,
  onColorToggle,
  onColorEffectToggle,
  onArtToggle,
  onDecoToggle,
  onQuantityChange,
  language,
  copy,
}: {
  colorIds: Set<string>;
  colorEffectIds: Set<string>;
  artIds: Set<string>;
  decoIds: Set<string>;
  quantities: Map<string, number>;
  onColorToggle: (id: string) => void;
  onColorEffectToggle: (id: string) => void;
  onArtToggle: (id: string) => void;
  onDecoToggle: (id: string) => void;
  onQuantityChange: (id: string, n: number) => void;
  language: AppLanguage;
  copy: BreakdownPanelCopy;
}) {
```

```tsx
{isSectionOpen('color') && (
  <div className="manage-accordion-body">
    <div className="analyze-accordion-subgroup">
      <div className="analyze-accordion-subgroup-label">{copy.baseColor}</div>
      <ChipGroup
        ids={COLOR_IDS}
        activeIds={colorIds}
        onToggle={onColorToggle}
        showAdd
        language={language}
        copy={copy}
      />
    </div>
    <ChipGroup
      ids={[...COLOR_EFFECT_IDS]}
      activeIds={colorEffectIds}
      onToggle={onColorEffectToggle}
      showAdd
      language={language}
      copy={copy}
    />
  </div>
)}
```

- [ ] **Step 6: Replace single-open accordion state with independent open-state tracking**

```tsx
const [openSections, setOpenSections] = useState<Set<'color' | 'art' | 'deco'>>(
  new Set(['color'])
);

function isSectionOpen(section: 'color' | 'art' | 'deco') {
  return openSections.has(section);
}

function toggleSection(section: 'color' | 'art' | 'deco') {
  setOpenSections((prev) => {
    const next = new Set(prev);
    if (next.has(section)) next.delete(section);
    else next.add(section);
    return next;
  });
}
```

- [ ] **Step 7: Pass the moved color state through the panel call site**

```tsx
<EffectsSection
  colorIds={colorIds}
  colorEffectIds={colorEffectIds}
  artIds={artIds}
  decoIds={decoIds}
  quantities={quantities}
  onColorToggle={(id) => toggleSet(setColorIds, id)}
  onColorEffectToggle={(id) => toggleSet(setColorEffectIds, id)}
  onArtToggle={(id) => toggleSet(setArtIds, id)}
  onDecoToggle={(id) => toggleSet(setDecoIds, id)}
  onQuantityChange={handleQuantityChange}
  language={language}
  copy={copy}
/>
```

- [ ] **Step 8: Remove dead shape-section constants only if they are now unused**

```ts
const SHAPE_IDS  = byCategory('nail_shape').map((e) => e.id);
const LENGTH_IDS = byCategory('nail_length').map((e) => e.id);
const COLOR_IDS  = byCategory('color').map((e) => e.id);
```

Run: `pnpm vitest src/features/customer/component-breakdown-config.test.ts src/features/customer/ComponentBreakdownPanel.test.tsx`
Expected: PASS for the new seeding and rendering behavior.

### Task 3: Verify shared-flow regressions stay clean

**Files:**
- Verify: `src/features/customer/ComponentBreakdownPanel.tsx`
- Verify: `src/features/customer/breakdown-panel-copy.ts`
- Verify: `src/features/customer/component-breakdown-config.test.ts`
- Verify: `src/features/customer/ComponentBreakdownPanel.test.tsx`
- Verify: `src/app/customer/booking/page.test.tsx`

- [ ] **Step 1: Run the broader booking and breakdown regression tests**

Run: `pnpm vitest src/features/customer/component-breakdown-config.test.ts src/features/customer/ComponentBreakdownPanel.test.tsx src/app/customer/booking/page.test.tsx`
Expected: PASS, confirming the shared panel still works in the booking flow.

- [ ] **Step 2: Check workspace diagnostics for touched files**

Run: Use workspace diagnostics on:
- `src/features/customer/ComponentBreakdownPanel.tsx`
- `src/features/customer/breakdown-panel-copy.ts`
- `src/features/customer/component-breakdown-config.test.ts`
- `src/features/customer/ComponentBreakdownPanel.test.tsx`

Expected: No new TypeScript or lint errors introduced by the patch.

- [ ] **Step 3: Commit the focused implementation**

```bash
git add \
  src/features/customer/ComponentBreakdownPanel.tsx \
  src/features/customer/breakdown-panel-copy.ts \
  src/features/customer/component-breakdown-config.test.ts \
  src/features/customer/ComponentBreakdownPanel.test.tsx \
  docs/superpowers/plans/2026-06-08-booking-result-breakdown.md
git commit -m "fix: refine booking result breakdown behavior"
```
