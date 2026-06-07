import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LanguageProvider } from '@/i18n/context';
import { OpsBotThread } from './OpsBotThread';

vi.mock('@/lib/actions/insights-actions', () => {
  const style = (styleId: string, title: string, tryOns: number, bookings: number, conversionRate: number | null) => ({
    styleId, title, impressions: tryOns * 4, clicks: tryOns * 2, saves: 1, tryOns, bookings, conversionRate,
  });
  const insights = (tryOns: number, bookings: number) => ({
    snapshot: { rangeDays: 7, impressions: 241, clicks: 106, detailViews: 53, saves: 5, tryOns, bookings, searches: 31, activeCustomers: 6 },
    demandTrends: [{ label: '金属感', category: 'texture', current: 53, previous: 27, delta: 26, direction: 'up' as const }],
    designPerformance: {
      styles: [style('s-low', '鎏金奢华', 29, 1, 0.03), style('s-top', '极光法式碎钻', 9, 7, 0.78)],
      highInterestLowConversion: [style('s-low', '鎏金奢华', 29, 1, 0.03)],
    },
    catalogGaps: [{ label: '暗黑', category: 'style', searchCount: 21, matchingActiveStyles: 1 }],
  });
  return {
    getMerchantInsightsAction: vi.fn(async (days: number) => (days === 1 ? insights(6, 1) : insights(35, 8))),
    getInsightsDailySeriesAction: vi.fn(async () =>
      Array.from({ length: 14 }, (_, i) => ({ date: `2026-05-${25 + i}`, tryOns: i, bookings: i % 3, searches: i }))
    ),
    summarizeInsightsAction: vi.fn(async () => ({ headline: '本周转化故事', insights: [], actions: [], source: 'fallback' as const })),
  };
});

function renderThread() {
  return render(
    <LanguageProvider role="merchant">
      <OpsBotThread />
    </LanguageProvider>
  );
}

describe('OpsBotThread report cards', () => {
  it('renders the daily pulse with today metrics and sparklines', async () => {
    const { container } = renderThread();
    // today (days=1) → 6 try-ons, 1 booking
    expect(await screen.findByText('试戴 6 · 预约 1 · 活跃顾客 6')).toBeInTheDocument();
    expect(container.querySelectorAll('svg.sparkline').length).toBe(2);
  });

  it('renders the weekly digest: funnel + trend + gap + conversion + action deep-link', async () => {
    renderThread();
    expect(await screen.findByText('曝光')).toBeInTheDocument();
    expect(screen.getByText('金属感')).toBeInTheDocument();
    expect(screen.getByText('顾客想要「暗黑」')).toBeInTheDocument();
    expect(screen.getByText('转化最高')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /复查「鎏金奢华」/ });
    expect(link).toHaveAttribute('href', '/merchant/styles/s-low/review');
  });
});
