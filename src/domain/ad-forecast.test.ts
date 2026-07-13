import { describe, expect, it } from 'vitest';
import { forecastAd, deriveAdAudience, forecastRoi, AD_AUDIENCES } from './ad-forecast';
import { DEFAULT_CUSTOM_AUDIENCE } from './style-ad';

// This math must stay identical to the agent sandbox's forecast() (sandbox.py) — the whole point of the
// port is that the merchant editor and the 投广 Agent read the same promise from the same priors.

describe('forecastAd', () => {
  it('matches the sandbox pipeline: budget → clicks → impressions → fatigue-CVR → bookings', () => {
    // saved_or_viewed: cpc 95, ctr 0.032, intent 0.80, size 1200. Budget ¥60 = 6000 cents, cvr 0.06.
    const f = forecastAd({ audience: 'saved_or_viewed', totalBudgetCents: 6000, durationDays: 5, styleCvr: 0.06 });
    // clicks = 6000/95 = 63.16; impressions = 63.16/0.032 = 1973.7; freq 1.64 → fatigue 1.0
    // cvr = 0.06*0.80*1.0 = 0.048; bookings = 63.16*0.048 = 3.03 → band [2.4, 3.6]
    expect(f.expectedBookings).toEqual([2.4, 3.6]);
    // cac = 6000/3.03 = 1979 → ±20% band
    expect(f.expectedCacCents).toEqual([1583, 2375]);
    expect(f.saturation).toBe('medium'); // freq 1.64
  });

  it('flags an infeasible plan: under ~1 booking → warning + no CAC point trust', () => {
    // broad, tiny budget → well under 1 booking
    const f = forecastAd({ audience: 'broad_local_interest', totalBudgetCents: 800, durationDays: 1, styleCvr: 0.06 });
    expect(f.expectedBookings[1]).toBeLessThan(1);
    const codes = f.warnings.map((w) => w['zh-CN']);
    expect(codes.some((c) => c.includes('不足 1 个预约'))).toBe(true);
    expect(codes.some((c) => c.includes('投放期过短'))).toBe(true);
  });

  it('penalizes saturation: piling budget into the small high-intent pool worsens CAC + confidence', () => {
    const f = forecastAd({ audience: 'try_on_no_booking', totalBudgetCents: 40000, durationDays: 5, styleCvr: 0.06 });
    expect(f.saturation).toBe('high');
    expect(f.confidence).toBe(0.55);
    expect(f.warnings.some((w) => w['zh-CN'].includes('饱和'))).toBe(true);
  });

  it('ranks intent correctly: high-intent pool books more per click than broad', () => {
    const broad = forecastAd({ audience: 'broad_local_interest', totalBudgetCents: 10000, durationDays: 5 });
    const retarget = forecastAd({ audience: 'try_on_no_booking', totalBudgetCents: 10000, durationDays: 5 });
    expect(retarget.expectedBookings[1]).toBeGreaterThan(broad.expectedBookings[1]);
  });

  it('narrowing demographic reach raises saturation at the same budget (CVR unchanged)', () => {
    const wide = forecastAd({ audience: 'saved_or_viewed', totalBudgetCents: 20000, durationDays: 5, audienceSizeMultiplier: 1 });
    const narrow = forecastAd({ audience: 'saved_or_viewed', totalBudgetCents: 20000, durationDays: 5, audienceSizeMultiplier: 0.2 });
    const order = { low: 0, medium: 1, high: 2 };
    expect(order[narrow.saturation]).toBeGreaterThanOrEqual(order[wide.saturation]);
    // fewer reachable people → fatigue drags bookings down for the same spend
    expect(narrow.expectedBookings[1]).toBeLessThanOrEqual(wide.expectedBookings[1]);
  });

  it('exposes the three sandbox audiences with bilingual labels', () => {
    expect(Object.keys(AD_AUDIENCES)).toEqual(['broad_local_interest', 'saved_or_viewed', 'try_on_no_booking']);
    expect(AD_AUDIENCES.try_on_no_booking.label['zh-CN']).toBe('试戴未预约');
  });
});

describe('deriveAdAudience (audience UI → sandbox forecast inputs)', () => {
  it('smart mode = the engaged pool at full reach (platform auto-selects likely bookers)', () => {
    expect(deriveAdAudience('smart')).toEqual({ pool: 'saved_or_viewed', reachMultiplier: 1 });
  });
  it('purchase-intent signals lift the behavioral pool; a wide filter keeps reach ~full', () => {
    const highSpend = deriveAdAudience('custom', { ...DEFAULT_CUSTOM_AUDIENCE, ageMin: 18, ageMax: 60, unitPrice: 'high' });
    expect(highSpend.pool).toBe('try_on_no_booking');
    const plain = deriveAdAudience('custom', { ...DEFAULT_CUSTOM_AUDIENCE, ageMin: 18, ageMax: 60, preferenceTags: [], visitFrequency: null, unitPrice: null });
    expect(plain.pool).toBe('broad_local_interest');
  });
  it('tighter demographics shrink reach below 1', () => {
    const narrow = deriveAdAudience('custom', { ...DEFAULT_CUSTOM_AUDIENCE, ageMin: 24, ageMax: 30, preferenceTags: ['french', 'cat_eye'] });
    expect(narrow.reachMultiplier).toBeLessThan(1);
  });
});

describe('forecastRoi', () => {
  it('ROI = booking value × bookings ÷ spend', () => {
    const f = forecastAd({ audience: 'saved_or_viewed', totalBudgetCents: 6000, durationDays: 5, styleCvr: 0.06 });
    // bookings 2.4–3.6, value ¥120 (12000c), spend 6000c → 4.8–7.2×
    expect(forecastRoi(f, 12000, 6000)).toEqual([4.8, 7.2]);
    expect(forecastRoi(f, 0, 6000)).toBeNull(); // unpriced style
  });
});
