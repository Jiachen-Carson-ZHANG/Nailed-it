# Booking Quote CTA Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the "View my quote" button during Booking AI analysis and only show it after a quote result exists.

**Architecture:** Keep the change local to the customer Booking flow. Reuse the existing `breakdowns.glossary` state in `CustomerBookingContent` as the single source of truth for whether a quote result exists, so the CTA stays hidden during loading and error states without changing `ComponentBreakdownPanel`'s public API.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Testing Library

---

### Task 1: Lock the desired CTA visibility in tests

**Files:**
- Modify: `src/app/customer/booking/page.test.tsx`
- Verify against: `src/app/customer/booking/booking-content.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('keeps the quote CTA hidden until a quote result exists', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        recognition: {
          selection: { baseServices: [], nailShape: 'oval', styles: ['french'], addons: [], otherNotes: 'Sample look.' },
          meta: { confidence: 0.9, aiSuggestedQuote: { source: 'ai_suggestion', price: 0, duration: 0 } }
        }
      }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    )
  );

  renderBookingContent(<CustomerBookingContent />);

  const file = new File(['fake image bytes'], 'ref.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText('选择美甲参考图'), { target: { files: [file] } });

  await waitFor(() => expect(screen.getByRole('button', { name: 'AI智能识别' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'AI智能识别' }));

  await screen.findByRole('heading', { name: '款式识别结果' });
  expect(screen.queryByRole('button', { name: /查看我的报价/i })).not.toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByRole('button', { name: /查看我的报价/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the targeted test to confirm the current behavior fails**

Run: `pnpm vitest src/app/customer/booking/page.test.tsx -t "keeps the quote CTA hidden until a quote result exists"`
Expected: FAIL because the CTA is rendered immediately in the result step.

- [ ] **Step 3: Keep the existing flow test aligned with the new behavior**

```tsx
await screen.findByRole('heading', { name: '款式识别结果' });

await waitFor(() => {
  expect(screen.getByRole('button', { name: /查看我的报价/i })).toBeInTheDocument();
});

fireEvent.click(screen.getByRole('button', { name: /查看我的报价/i }));
```

- [ ] **Step 4: Run the full booking page test file before implementation**

Run: `pnpm vitest src/app/customer/booking/page.test.tsx`
Expected: At least the new CTA-visibility assertion fails before code changes.

### Task 2: Gate the CTA on quote availability

**Files:**
- Modify: `src/app/customer/booking/booking-content.tsx`
- Test: `src/app/customer/booking/page.test.tsx`

- [ ] **Step 1: Add a focused derived flag near the result handlers**

```tsx
const hasQuoteResult = Boolean(breakdowns.glossary);
```

- [ ] **Step 2: Render the quote CTA only when a quote result exists**

```tsx
<div className="booking-step-actions">
  <Button block variant="secondary" onClick={() => setStep('upload')}>
    ← {t('booking.upload.changePhoto')}
  </Button>
  {hasQuoteResult ? (
    <Button block onClick={() => setStep('quote')}>
      {t('booking.result.quoteCta')} →
    </Button>
  ) : null}
</div>
```

- [ ] **Step 3: Keep the behavior comments accurate**

```tsx
// 中文注释：只有拿到 breakdown 报价结果后，结果页才显示“查看我的报价”，
// 这样分析中和失败态都会继续隐藏这个入口。
const hasQuoteResult = Boolean(breakdowns.glossary);
```

- [ ] **Step 4: Run the targeted booking tests**

Run: `pnpm vitest src/app/customer/booking/page.test.tsx`
Expected: PASS for the new CTA visibility behavior and the existing three-step flow.

### Task 3: Verify the edited files are clean

**Files:**
- Verify: `src/app/customer/booking/booking-content.tsx`
- Verify: `src/app/customer/booking/page.test.tsx`

- [ ] **Step 1: Check editor diagnostics for the touched files**

Run: Use workspace diagnostics on:
- `src/app/customer/booking/booking-content.tsx`
- `src/app/customer/booking/page.test.tsx`

Expected: No new TypeScript or lint errors introduced by the change.

- [ ] **Step 2: Commit the focused change**

```bash
git add src/app/customer/booking/booking-content.tsx src/app/customer/booking/page.test.tsx docs/superpowers/plans/2026-06-08-booking-quote-cta-visibility.md
git commit -m "fix: delay booking quote cta until quote exists"
```
