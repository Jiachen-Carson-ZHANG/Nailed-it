import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LanguageProvider } from '@/i18n/context';
import type { CatalogGap, DemandTrend, StylePerformance } from '@/domain/intelligence';
import { FunnelChart } from './FunnelChart';
import { TrendBars } from './TrendBars';
import { GapBar } from './GapBar';
import { StyleConversionBars } from './StyleConversionBars';
import { ActionCard } from './ActionCard';
import { Sparkline } from './Sparkline';

function wrap(ui: React.ReactNode) {
  return render(<LanguageProvider role="merchant">{ui}</LanguageProvider>);
}

describe('insights chart components', () => {
  it('FunnelChart renders stages and flags the biggest drop step', () => {
    wrap(
      <FunnelChart
        stages={[
          { label: '曝光', count: 241 },
          { label: '点击', count: 106 },
          { label: '试戴', count: 35 },
          { label: '预约', count: 8 },
        ]}
      />
    );
    expect(screen.getByText('曝光')).toBeInTheDocument();
    expect(screen.getByText('241')).toBeInTheDocument();
    // 106 → 35 is the biggest proportional drop → flagged.
    expect(screen.getByText('最大流失')).toBeInTheDocument();
  });

  it('TrendBars caps to the limit and shows direction', () => {
    const rows: DemandTrend[] = [
      { label: '裸色', category: 'color', current: 54, previous: 13, delta: 41, direction: 'up' },
      { label: '金属感', category: 'texture', current: 53, previous: 27, delta: 26, direction: 'up' },
    ];
    wrap(<TrendBars rows={rows} limit={1} />);
    expect(screen.getByText('裸色')).toBeInTheDocument();
    expect(screen.queryByText('金属感')).not.toBeInTheDocument();
    expect(screen.getByText('上期 13')).toBeInTheDocument();
  });

  it('GapBar shows demand vs supply', () => {
    const gap: CatalogGap = { label: '暗黑', category: 'style', searchCount: 21, matchingActiveStyles: 1 };
    wrap(<GapBar gap={gap} />);
    expect(screen.getByText('顾客想要「暗黑」')).toBeInTheDocument();
    expect(screen.getByText('21 次搜索')).toBeInTheDocument();
    expect(screen.getByText('1 款')).toBeInTheDocument();
  });

  it('StyleConversionBars gates low-sample conversion and flags winner/leak', () => {
    const styles: StylePerformance[] = [
      { styleId: 's1', title: '鎏金奢华', impressions: 130, clicks: 70, saves: 0, tryOns: 29, bookings: 1, conversionRate: 0.03 },
      { styleId: 's2', title: '极光法式碎钻', impressions: 40, clicks: 20, saves: 1, tryOns: 9, bookings: 7, conversionRate: 0.78 },
      { styleId: 's3', title: '清冷冰蓝冷光甲', impressions: 20, clicks: 9, saves: 1, tryOns: 1, bookings: 1, conversionRate: 1 },
    ];
    wrap(<StyleConversionBars styles={styles} winnerId="s2" leakIds={['s1']} />);
    expect(screen.getByText('转化最高')).toBeInTheDocument();
    expect(screen.getByText('高意向 · 低转化')).toBeInTheDocument();
    expect(screen.getByText('78%')).toBeInTheDocument();
    // s3 has 1 try-on → below the min sample → no misleading 100%.
    expect(screen.getByText('样本不足')).toBeInTheDocument();
    expect(screen.queryByText('100%')).not.toBeInTheDocument();
  });

  it('Sparkline renders an accessible svg path', () => {
    const { container } = wrap(<Sparkline points={[0, 2, 1, 5, 3]} label="试戴 近 14 天" />);
    expect(screen.getByLabelText('试戴 近 14 天')).toBeInTheDocument();
    expect(container.querySelector('path.sparkline-line')).toBeTruthy();
  });

  it('ActionCard renders a deep link with evidence', () => {
    wrap(<ActionCard text="复查鎏金奢华定价" evidence="试戴 29 · 预约 1" href="/merchant/styles/s1/review" cta="去编辑" />);
    const link = screen.getByRole('link', { name: /复查鎏金奢华定价/ });
    expect(link).toHaveAttribute('href', '/merchant/styles/s1/review');
    expect(screen.getByText('试戴 29 · 预约 1')).toBeInTheDocument();
  });
});
