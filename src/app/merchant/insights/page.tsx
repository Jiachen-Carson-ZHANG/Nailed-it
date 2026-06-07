'use client';

import { useEffect, useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { EmptyState } from '@/components/ui/EmptyState';
import { MerchantAnalyticsCard } from '@/features/merchant/MerchantAnalyticsCard';
import { getMerchantInsightsAction, summarizeInsightsAction } from '@/lib/actions/insights-actions';
import { isGenericTag } from '@/domain/catalog-tags';
import type { MerchantInsights, StylePerformance } from '@/domain/intelligence';
import type { AISummary } from '@/nail-ai/insights-summary';

// Min try-on sample before a conversion rate is trustworthy (a 1-try/1-book style is not "100%").
const MIN_CONVERSION_SAMPLE = 3;

function arrow(direction: 'up' | 'down' | 'flat'): string {
  return direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→';
}
function pct(rate: number | null): string {
  return rate == null ? '—' : `${Math.round(rate * 100)}%`;
}
function hasSample(s: StylePerformance): boolean {
  return s.tryOns >= MIN_CONVERSION_SAMPLE && s.conversionRate != null;
}

export default function MerchantInsightsPage() {
  const [rangeDays, setRangeDays] = useState<1 | 7>(7);
  const [insights, setInsights] = useState<MerchantInsights | null>(null);
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [perfOpen, setPerfOpen] = useState(false);
  const [perfSort, setPerfSort] = useState<'conversion' | 'tryOns'>('conversion');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setSummary(null);
    getMerchantInsightsAction(rangeDays)
      .then((data) => active && setInsights(data))
      .catch(() => active && setInsights(null))
      .finally(() => active && setLoading(false));
    summarizeInsightsAction(rangeDays)
      .then((data) => active && setSummary(data))
      .catch(() => {/* card stays in its loading state */});
    return () => {
      active = false;
    };
  }, [rangeDays]);

  const s = insights?.snapshot;
  const isEmpty = !!insights && s!.tryOns + s!.bookings + s!.searches + s!.clicks === 0 && insights.demandTrends.length === 0;

  const perf = insights?.designPerformance.styles ?? [];
  const lowConversion = insights?.designPerformance.highInterestLowConversion[0];
  const topConverter = [...perf].filter(hasSample).sort((a, b) => b.conversionRate! - a.conversionRate!)[0];
  const sortedPerf = [...perf].sort((a, b) => {
    if (perfSort === 'conversion') {
      const av = hasSample(a) ? a.conversionRate! : -1;
      const bv = hasSample(b) ? b.conversionRate! : -1;
      return bv - av || b.tryOns - a.tryOns;
    }
    return b.tryOns - a.tryOns || b.bookings - a.bookings;
  });
  const maxSearch = Math.max(1, ...(insights?.catalogGaps.map((g) => g.searchCount) ?? [1]));

  return (
    <MobileLayout role="merchant" title="Nailed-it">
      <section className="profile-hero">
        <p className="section-eyebrow">Nailed AI · 需求洞察</p>
        <h1>经营洞察</h1>
        <p className="section-copy">顾客行为实时计算 —— 趋势、缺口、转化全部来自真实埋点。</p>
      </section>

      <div className="insights-range-toggle" role="tablist" aria-label="时间范围">
        {([[1, '今日'], [7, '本周']] as const).map(([days, label]) => (
          <button
            key={days}
            role="tab"
            type="button"
            aria-selected={rangeDays === days}
            className={`insights-range-tab${rangeDays === days ? ' insights-range-tab-on' : ''}`}
            onClick={() => setRangeDays(days)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="helper-copy">正在计算洞察…</p>
      ) : !insights || isEmpty ? (
        <EmptyState title="暂无足够数据" body="顾客开始浏览、试戴和预订后，这里会实时显示需求趋势、品类缺口与转化表现。" />
      ) : (
        <>
          <article className="detail-surface insights-ai-card" aria-label="AI 洞察摘要">
            <div className="detail-surface-header">
              <h2>AI 摘要</h2>
              {summary ? <span className="insights-badge">{summary.source === 'ai' ? 'AI 生成' : '规则生成'}</span> : null}
            </div>
            {summary ? (
              <>
                <p className="insights-ai-headline">{summary.headline}</p>
                {summary.insights.length > 0 ? (
                  <ul className="insights-ai-list">{summary.insights.map((line) => <li key={line}>{line}</li>)}</ul>
                ) : null}
                {summary.actions.length > 0 ? (
                  <div className="insights-ai-actions">
                    {summary.actions.map((line) => <span key={line} className="insights-action-chip">→ {line}</span>)}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="helper-copy">AI 摘要生成中…</p>
            )}
          </article>

          <section className="analytics-grid" aria-label="快照">
            <MerchantAnalyticsCard title="搜索" value={String(s!.searches)} detail="搜索/筛选次数" />
            <MerchantAnalyticsCard title="试戴" value={String(s!.tryOns)} detail="虚拟试戴次数" />
            <MerchantAnalyticsCard title="预订" value={String(s!.bookings)} detail="确认预订数" />
            <MerchantAnalyticsCard title="活跃顾客" value={String(s!.activeCustomers)} detail="有行为的顾客" />
          </section>

          {insights.demandTrends.length > 0 ? (
            <section className="detail-surface" aria-labelledby="insights-trends-title">
              <div className="detail-surface-header">
                <h2 id="insights-trends-title">需求趋势</h2>
                <span className="helper-copy">本期 vs 上期</span>
              </div>
              <div className="insights-trend-list">
                {insights.demandTrends.filter((t) => !isGenericTag(t.label)).slice(0, 6).map((t) => (
                  <div key={t.label} className="insights-trend-row">
                    <span className="insights-trend-label">{t.label}</span>
                    <span className={`insights-trend-delta insights-trend-${t.direction}`}>{arrow(t.direction)} {t.current}</span>
                    <span className="insights-trend-prev">上期 {t.previous}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {insights.catalogGaps.length > 0 ? (
            <section className="detail-surface" aria-labelledby="insights-gap-title">
              <div className="detail-surface-header">
                <h2 id="insights-gap-title">品类缺口</h2>
              </div>
              {insights.catalogGaps.map((gap) => (
                <div key={gap.label} className="insights-gap-card">
                  <p className="insights-gap-head">顾客想要「<strong>{gap.label}</strong>」</p>
                  <div className="insights-bar-row">
                    <span className="insights-bar-label">需求</span>
                    <span className="insights-bar"><span className="insights-bar-fill insights-bar-demand" style={{ width: `${(gap.searchCount / maxSearch) * 100}%` }} /></span>
                    <span className="insights-bar-num">{gap.searchCount} 次搜索</span>
                  </div>
                  <div className="insights-bar-row">
                    <span className="insights-bar-label">在售</span>
                    <span className="insights-bar"><span className="insights-bar-fill insights-bar-supply" style={{ width: `${Math.max(2, (gap.matchingActiveStyles / Math.max(gap.searchCount, 1)) * 100)}%` }} /></span>
                    <span className="insights-bar-num">{gap.matchingActiveStyles} 款</span>
                  </div>
                  <p className="helper-copy">需求远超供给，上架更多此风格即可承接。</p>
                </div>
              ))}
            </section>
          ) : null}

          <section className="detail-surface" aria-labelledby="insights-perf-title">
            <div className="detail-surface-header">
              <h2 id="insights-perf-title">设计表现</h2>
            </div>
            {lowConversion ? (
              <div className="insights-perf-row">
                <div><span className="insights-badge insights-badge-warn">高意向 · 低转化</span><p className="insights-perf-title">{lowConversion.title}</p></div>
                <p className="insights-perf-meta">试戴 {lowConversion.tryOns} · 预订 {lowConversion.bookings}</p>
              </div>
            ) : null}
            {topConverter ? (
              <div className="insights-perf-row">
                <div><span className="insights-badge insights-badge-good">转化最高</span><p className="insights-perf-title">{topConverter.title}</p></div>
                <p className="insights-perf-meta">转化率 {pct(topConverter.conversionRate)} · 预订 {topConverter.bookings}</p>
              </div>
            ) : null}

            <button type="button" className="insights-collapse-toggle" aria-expanded={perfOpen} onClick={() => setPerfOpen((v) => !v)}>
              <span>全部款式表现（{perf.length}）</span>
              <span className={`feed-filter-summary-caret${perfOpen ? ' feed-filter-summary-caret-open' : ''}`} aria-hidden>▾</span>
            </button>

            {perfOpen ? (
              <>
                <div className="insights-sort-row">
                  <span className="helper-copy">排序</span>
                  {([['conversion', '转化率'], ['tryOns', '试戴量']] as const).map(([key, label]) => (
                    <button key={key} type="button" aria-pressed={perfSort === key} className={`insights-sort-chip${perfSort === key ? ' insights-sort-chip-on' : ''}`} onClick={() => setPerfSort(key)}>{label}</button>
                  ))}
                </div>
                <table className="insights-perf-table" aria-label="全部款式表现">
                  <thead>
                    <tr><th>款式</th><th>试戴</th><th>预订</th><th>转化率</th></tr>
                  </thead>
                  <tbody>
                    {sortedPerf.map((row) => (
                      <tr key={row.styleId}>
                        <td className="insights-perf-name">{row.title}</td>
                        <td>{row.tryOns}</td>
                        <td>{row.bookings}</td>
                        <td className={hasSample(row) ? 'insights-perf-rate' : 'insights-perf-rate-muted'}>
                          {hasSample(row) ? pct(row.conversionRate) : '样本不足'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : null}
          </section>
        </>
      )}
    </MobileLayout>
  );
}
