import { describe, expect, it } from 'vitest';
import { createDefaultGroupbuyDraft } from './groupbuy';
import { validateGroupbuyDeal } from './groupbuy-validation';

const base = () => ({ ...createDefaultGroupbuyDraft(), originalPrice: 158, dealPrice: 128 });

describe('validateGroupbuyDeal', () => {
  it('passes a well-formed deal', () => {
    expect(validateGroupbuyDeal(base()).ok).toBe(true);
  });

  it('rejects a discount above the original price', () => {
    const r = validateGroupbuyDeal({ ...base(), dealPrice: 200 });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('deal_price_above_original');
  });

  it('rejects a date-range validity that ends before it starts', () => {
    const r = validateGroupbuyDeal({ ...base(), validity: { type: 'dateRange', start: '2026-08-01', end: '2026-07-01' } });
    expect(r.errors).toContain('validity_end_before_start');
  });

  it('rejects a low-peak availability window with no real time range', () => {
    const r = validateGroupbuyDeal({ ...base(), availability: { type: 'limited', windows: [{ day: '周一', startTime: '17:00', endTime: '12:00' }] } });
    expect(r.errors).toContain('availability_end_before_start');
  });

  it('requires a title + a service only when publishable', () => {
    const draft = { ...base(), title: '', serviceSelections: [] };
    expect(validateGroupbuyDeal(draft, false).ok).toBe(true); // draft is lenient
    const pub = validateGroupbuyDeal(draft, true);
    expect(pub.ok).toBe(false);
    expect(pub.errors).toEqual(expect.arrayContaining(['title_required', 'at_least_one_service_required']));
  });
});
