import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LanguageProvider } from '@/i18n/context';
import MerchantInsightsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/merchant/insights',
}));

// Seed-shaped read model: a monotonic funnel + the four narrative beats.
vi.mock('@/lib/actions/insights-actions', () => {
  const style = (styleId: string, title: string, tryOns: number, bookings: number, conversionRate: number | null) => ({
    styleId, title, impressions: tryOns * 4, clicks: tryOns * 2, saves: 1, tryOns, bookings, conversionRate,
  });
  const insights = {
    snapshot: { rangeDays: 7, impressions: 241, clicks: 106, detailViews: 53, saves: 5, tryOns: 35, bookings: 8, searches: 31, activeCustomers: 6 },
    demandTrends: [
      { label: '裸色', category: 'color', current: 54, previous: 13, delta: 41, direction: 'up' as const },
      { label: '金属感', category: 'texture', current: 53, previous: 27, delta: 26, direction: 'up' as const },
    ],
    designPerformance: {
      styles: [
        style('s-low', '鎏金奢华', 29, 1, 0.03),
        style('s-top', '极光法式碎钻', 9, 7, 0.78),
        style('s-thin', '清冷冰蓝冷光甲', 1, 1, 1),
      ],
      highInterestLowConversion: [style('s-low', '鎏金奢华', 29, 1, 0.03)],
    },
    catalogGaps: [{ label: '暗黑', category: 'style', searchCount: 21, matchingActiveStyles: 1 }],
  };
  return {
    getMerchantInsightsAction: vi.fn(async () => insights),
    summarizeInsightsAction: vi.fn(async () => ({
      headline: '本周 31 搜索 → 8 预约，最大流失在试戴→预约。',
      insights: [],
      actions: [],
      source: 'fallback' as const,
    })),
  };
});

function renderPage() {
  return render(
    <LanguageProvider role="merchant">
      <MerchantInsightsPage />
    </LanguageProvider>
  );
}

describe('MerchantInsightsPage data story', () => {
  it('renders the funnel spine with all five stages', async () => {
    renderPage();
    expect(await screen.findByText('曝光')).toBeInTheDocument();
    for (const label of ['点击', '详情', '试戴', '预约']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('241')).toBeInTheDocument();
    // 106 → 53 → 35 → 8: the 35 → 8 step is the biggest proportional drop.
    expect(screen.getByText('最大流失')).toBeInTheDocument();
  });

  it('renders demand trends, the catalog gap, and the conversion winner/leak', async () => {
    renderPage();
    expect(await screen.findByText('金属感')).toBeInTheDocument();
    expect(screen.getByText('顾客想要「暗黑」')).toBeInTheDocument();
    expect(screen.getByText('转化最高')).toBeInTheDocument();
    expect(screen.getByText('高意向 · 低转化')).toBeInTheDocument();
    expect(screen.getByText('78%')).toBeInTheDocument();
  });

  it('does NOT render the 建议行动 block (dropped — the agent team acts, it does not recommend)', async () => {
    renderPage();
    await screen.findByText('曝光'); // page rendered
    expect(screen.queryByText('建议行动')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /复查「鎏金奢华」/ })).not.toBeInTheDocument();
  });
});
