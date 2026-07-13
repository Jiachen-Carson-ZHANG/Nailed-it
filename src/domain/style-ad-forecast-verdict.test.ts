import { describe, expect, it } from 'vitest';
import { forecastVerdict, type CampaignHypothesis } from './style-ad';

const hyp = (lo: number, hi: number): CampaignHypothesis => ({ expectedBookings: [lo, hi], expectedCacCents: null });

describe('forecastVerdict', () => {
  it('flags the 打脸: delivered below the forecast band', () => {
    // the finals-a story: forecast 4.8–7.1, reality 3
    expect(forecastVerdict(hyp(4.8, 7.1), 3)).toBe('below');
  });
  it('on-forecast: delivered inside the band (inclusive edges)', () => {
    expect(forecastVerdict(hyp(4.8, 7.1), 5)).toBe('within');
    expect(forecastVerdict(hyp(4.8, 7.1), 4.8)).toBe('within');
    expect(forecastVerdict(hyp(4.8, 7.1), 7.1)).toBe('within');
  });
  it('over-delivered: above the band', () => {
    expect(forecastVerdict(hyp(4.8, 7.1), 9)).toBe('above');
  });
});
