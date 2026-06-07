'use client';

import { useEffect, useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { EmptyState } from '@/components/ui/EmptyState';
import { MerchantAnalyticsCard } from '@/features/merchant/MerchantAnalyticsCard';
import { getMerchantInsightsAction, summarizeInsightsAction } from '@/lib/actions/insights-actions';
import type { MerchantInsights } from '@/domain/intelligence';
import type { AISummary } from '@/nail-ai/insights-summary';

function arrow(direction: 'up' | 'down' | 'flat'): string {
  return direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→';
}

export default function MerchantInsightsPage() {
  const [insights, setInsights] = useState<MerchantInsights | null>(null);
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getMerchantInsightsAction()
      .then((data) => active && setInsights(data))
      .catch(() => active && setInsights(null))
      .finally(() => active && setLoading(false));
    // AI summary loads independently so a slow/absent model never blocks the numbers.
    summarizeInsightsAction()
      .then((data) => active && setSummary(data))
      .catch(() => {/* card just stays in its loading state */});
    return () => {
      active = false;
    };
  }, []);

  const s = insights?.snapshot;
  const isEmpty =
    !!insights &&
    s!.tryOns + s!.bookings + s!.searches + s!.clicks === 0 &&
    insights.demandTrends.length === 0;

  const topConverter = insights?.designPerformance.styles
    .filter((x) => x.conversionRate !== null)
    .sort((a, b) => (b.conversionRate ?? 0) - (a.conversionRate ?? 0))[0];
  const lowConversion = insights?.designPerformance.highInterestLowConversion[0];

  return (
    <MobileLayout role="merchant" title="Nailed-it">
      <section className="profile-hero">
        <p className="section-eyebrow">Nailed AI · 需求洞察</p>
        <h1>经营洞察</h1>
        <p className="section-copy">顾客行为实时计算 —— 趋势、缺口、转化全部来自真实埋点。</p>
      </section>

      {loading ? (
        <p className="helper-copy">正在计算洞察…</p>
      ) : !insights || isEmpty ? (
        <EmptyState
          title="暂无足够数据"
          body="顾客开始浏览、试戴和预订后，这里会实时显示需求趋势、品类缺口与转化表现。"
        />
      ) : (
        <>
          {/* AI summary — hero card */}
          <article className="detail-surface insights-ai-card" aria-label="AI 洞察摘要">
            <div className="detail-surface-header">
              <h2>AI 摘要</h2>
              {summary ? (
                <span className="insights-badge">{summary.source === 'ai' ? 'AI 生成' : '规则生成'}</span>
              ) : null}
            </div>
            {summary ? (
              <>
                <p className="insights-ai-headline">{summary.headline}</p>
                {summary.insights.length > 0 ? (
                  <ul className="insights-ai-list">
                    {summary.insights.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : null}
                {summary.actions.length > 0 ? (
                  <div className="insights-ai-actions">
                    {summary.actions.map((line) => (
                      <span key={line} className="insights-action-chip">→ {line}</span>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="helper-copy">AI 摘要生成中…</p>
            )}
          </article>

          {/* Snapshot */}
          <section className="analytics-grid" aria-label="本周快照">
            <MerchantAnalyticsCard title="搜索" value={String(s!.searches)} detail="本周搜索/筛选次数" />
            <MerchantAnalyticsCard title="试戴" value={String(s!.tryOns)} detail="本周虚拟试戴次数" />
            <MerchantAnalyticsCard title="预订" value={String(s!.bookings)} detail="本周确认预订数" />
            <MerchantAnalyticsCard title="活跃顾客" value={String(s!.activeCustomers)} detail="本周有行为的顾客" />
          </section>

          {/* Demand trends */}
          {insights.demandTrends.length > 0 ? (
            <section className="detail-surface" aria-labelledby="insights-trends-title">
              <div className="detail-surface-header">
                <h2 id="insights-trends-title">需求趋势</h2>
                <span className="helper-copy">本周 vs 上周</span>
              </div>
              <div className="insights-trend-list">
                {insights.demandTrends.slice(0, 6).map((t) => (
                  <div key={t.label} className="insights-trend-row">
                    <span className="insights-trend-label">{t.label}</span>
                    <span className={`insights-trend-delta insights-trend-${t.direction}`}>
                      {arrow(t.direction)} {t.current}
                    </span>
                    <span className="insights-trend-prev">上周 {t.previous}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Catalog gaps */}
          {insights.catalogGaps.length > 0 ? (
            <section className="detail-surface" aria-labelledby="insights-gap-title">
              <div className="detail-surface-header">
                <h2 id="insights-gap-title">品类缺口</h2>
              </div>
              {insights.catalogGaps.map((gap) => (
                <div key={gap.label} className="insights-gap-card">
                  <p className="insights-gap-head">
                    顾客想要「<strong>{gap.label}</strong>」
                  </p>
                  <p className="insights-gap-meta">
                    {gap.searchCount} 次搜索 · 在售仅 <strong>{gap.matchingActiveStyles}</strong> 款
                  </p>
                  <p className="helper-copy">上架更多此风格即可承接这部分需求。</p>
                </div>
              ))}
            </section>
          ) : null}

          {/* Design performance */}
          {(lowConversion || topConverter) ? (
            <section className="detail-surface" aria-labelledby="insights-perf-title">
              <div className="detail-surface-header">
                <h2 id="insights-perf-title">设计表现</h2>
              </div>
              {lowConversion ? (
                <div className="insights-perf-row">
                  <div>
                    <span className="insights-badge insights-badge-warn">高意向 · 低转化</span>
                    <p className="insights-perf-title">{lowConversion.title}</p>
                  </div>
                  <p className="insights-perf-meta">试戴 {lowConversion.tryOns} · 预订 {lowConversion.bookings}</p>
                </div>
              ) : null}
              {topConverter ? (
                <div className="insights-perf-row">
                  <div>
                    <span className="insights-badge insights-badge-good">转化最高</span>
                    <p className="insights-perf-title">{topConverter.title}</p>
                  </div>
                  <p className="insights-perf-meta">
                    转化率 {Math.round((topConverter.conversionRate ?? 0) * 100)}% · 预订 {topConverter.bookings}
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </MobileLayout>
  );
}
