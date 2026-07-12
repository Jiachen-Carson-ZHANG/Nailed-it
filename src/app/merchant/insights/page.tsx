'use client';

import { useEffect, useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { EmptyState } from '@/components/ui/EmptyState';
import { FunnelChart, type FunnelStage } from '@/features/merchant/insights/FunnelChart';
import { TrendBars } from '@/features/merchant/insights/TrendBars';
import { GapBar } from '@/features/merchant/insights/GapBar';
import { StyleConversionBars } from '@/features/merchant/insights/StyleConversionBars';
import { ActionCard } from '@/features/merchant/insights/ActionCard';
import { getMerchantInsightsAction, summarizeInsightsAction } from '@/lib/actions/insights-actions';
import { isGenericTag } from '@/domain/catalog-tags';
import { useLanguage } from '@/i18n/context';
import type { AppLanguage } from '@/i18n/types';
import type { MerchantInsights, StylePerformance } from '@/domain/intelligence';
import { fallbackSummary, type AISummary } from '@/nail-ai/insights-fallback';

const insightsCopy = {
  'zh-CN': {
    eyebrow: 'Nailed AI · 需求洞察',
    title: '门店数据洞察',
    body: '基于真实顾客行为，完整呈现从曝光到预约的转化故事。',
    rangeAria: '时间范围',
    today: '今日',
    week: '本周',
    loading: '正在加载数据…',
    emptyTitle: '暂无足够数据',
    emptyBody: '顾客开始浏览、试戴和预约后，这里会显示完整的转化故事。',
    aiSummary: 'AI 摘要',
    aiGenerated: 'AI 生成',
    ruleGenerated: '规则生成',
    aiLoading: 'AI 摘要生成中…',
    funnelTitle: '客户旅程',
    stageImpressions: '曝光',
    stageClicks: '点击',
    stageDetails: '详情',
    stageTryOns: '试戴',
    stageBookings: '预约',
    context: (searches: number, customers: number) => `搜索 ${searches} · 活跃顾客 ${customers}`,
    demandTrends: '需求趋势',
    vsPrevious: '本期 vs 上期 · 触达次数',
    catalogGaps: '品类缺口',
    designPerformance: '款式表现',
    allStyles: (n: number) => `全部款式表现（${n}）`,
    sort: '排序',
    sortConversion: '转化率',
    sortTryOns: '试戴量',
    tableAria: '全部款式表现',
    colStyle: '款式',
    colTryOn: '试戴',
    colBook: '预约',
    colConversion: '转化率',
    insufficientSample: '样本不足',
    actionsTitle: '建议行动',
    actionFixPricing: (title: string) => `复查「${title}」定价或展示，提升转化`,
    actionAddStyles: (label: string) => `上架更多「${label}」风格，补足缺口`,
    ctaEdit: '去编辑',
    ctaUpload: '去上架',
  },
  en: {
    eyebrow: 'Nailed AI · Demand insights',
    title: 'Studio insights',
    body: 'The full conversion story, from impression to booking, all from real behaviour.',
    rangeAria: 'Time range',
    today: 'Today',
    week: 'This week',
    loading: 'Loading insights…',
    emptyTitle: 'Not enough data yet',
    emptyBody: 'Once customers browse, try on styles, and book, the full conversion story shows here.',
    aiSummary: 'AI summary',
    aiGenerated: 'AI generated',
    ruleGenerated: 'Rule based',
    aiLoading: 'Generating AI summary…',
    funnelTitle: 'Customer journey',
    stageImpressions: 'Impressions',
    stageClicks: 'Clicks',
    stageDetails: 'Detail views',
    stageTryOns: 'Try-ons',
    stageBookings: 'Bookings',
    context: (searches: number, customers: number) => `${searches} searches · ${customers} active customers`,
    demandTrends: 'Demand trends',
    vsPrevious: 'Current vs previous · touches',
    catalogGaps: 'Catalog gaps',
    designPerformance: 'Style performance',
    allStyles: (n: number) => `All styles (${n})`,
    sort: 'Sort by',
    sortConversion: 'Conversion',
    sortTryOns: 'Try-ons',
    tableAria: 'All style performance',
    colStyle: 'Style',
    colTryOn: 'Try-ons',
    colBook: 'Bookings',
    colConversion: 'Conversion',
    insufficientSample: 'Low sample',
    actionsTitle: 'Recommended actions',
    actionFixPricing: (title: string) => `Review “${title}” pricing or display to lift conversion`,
    actionAddStyles: (label: string) => `Add more “${label}” styles to close the gap`,
    ctaEdit: 'Edit',
    ctaUpload: 'Add styles',
  },
} satisfies Record<AppLanguage, Record<string, unknown>>;

// Min try-on sample before a conversion rate is trustworthy (a 1-try/1-book style is not "100%").
const MIN_CONVERSION_SAMPLE = 3;

function pct(rate: number | null): string {
  return rate == null ? '—' : `${Math.round(rate * 100)}%`;
}
function hasSample(s: StylePerformance): boolean {
  return s.tryOns >= MIN_CONVERSION_SAMPLE && s.conversionRate != null;
}

export default function MerchantInsightsPage() {
  const { language } = useLanguage();
  const copy = insightsCopy[language];
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
      .then((data) => {
        if (!active) return;
        setInsights(data);
        // Show the grounded deterministic card immediately — never gate the demo on the slow/optional
        // AI call. The AI narration below upgrades it (source→'ai') if and when it returns.
        setSummary((cur) => cur ?? fallbackSummary(data, language));
      })
      .catch(() => active && setInsights(null))
      .finally(() => active && setLoading(false));
    summarizeInsightsAction(rangeDays, language)
      .then((data) => active && setSummary(data))
      .catch(() => {/* the deterministic fallback already populated the card */});
    return () => {
      active = false;
    };
  }, [rangeDays, language]);

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

  const funnelStages: FunnelStage[] = s
    ? [
        { label: copy.stageImpressions, count: s.impressions },
        { label: copy.stageClicks, count: s.clicks },
        { label: copy.stageDetails, count: s.detailViews },
        { label: copy.stageTryOns, count: s.tryOns },
        { label: copy.stageBookings, count: s.bookings },
      ]
    : [];

  const trendRows = (insights?.demandTrends ?? []).filter((t) => !isGenericTag(t.label));
  const topGap = insights?.catalogGaps[0];

  const rangeLabels = [
    { days: 1 as const, label: copy.today },
    { days: 7 as const, label: copy.week },
  ];

  return (
    <MobileLayout role="merchant" title="Nailed-it">
      <section className="profile-hero">
        <p className="section-eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p className="section-copy">{copy.body}</p>
      </section>

      <div className="insights-range-toggle" role="tablist" aria-label={copy.rangeAria}>
        {rangeLabels.map(({ days, label }) => (
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
        <p className="helper-copy">{copy.loading}</p>
      ) : !insights || isEmpty ? (
        <EmptyState title={copy.emptyTitle} body={copy.emptyBody} />
      ) : (
        <>
          {summary ? (
            <article className="detail-surface insights-ai-card" aria-label={copy.aiSummary}>
              <div className="detail-surface-header">
                <h2>{copy.aiSummary}</h2>
                <span className="insights-badge">
                  {summary.source === 'ai' ? copy.aiGenerated : copy.ruleGenerated}
                </span>
              </div>
              <p className="insights-ai-headline">{summary.headline}</p>
            </article>
          ) : (
            <p className="helper-copy">{copy.aiLoading}</p>
          )}

          <section className="detail-surface" aria-labelledby="insights-funnel-title">
            <div className="detail-surface-header">
              <h2 id="insights-funnel-title">{copy.funnelTitle}</h2>
              <span className="helper-copy">{copy.context(s!.searches, s!.activeCustomers)}</span>
            </div>
            <FunnelChart stages={funnelStages} />
          </section>

          {trendRows.length > 0 ? (
            <section className="detail-surface" aria-labelledby="insights-trends-title">
              <div className="detail-surface-header">
                <h2 id="insights-trends-title">{copy.demandTrends}</h2>
                <span className="helper-copy">{copy.vsPrevious}</span>
              </div>
              <TrendBars rows={trendRows} limit={5} />
            </section>
          ) : null}

          {topGap ? (
            <section className="detail-surface" aria-labelledby="insights-gap-title">
              <div className="detail-surface-header">
                <h2 id="insights-gap-title">{copy.catalogGaps}</h2>
              </div>
              {insights.catalogGaps.slice(0, 2).map((gap) => (
                <GapBar key={gap.label} gap={gap} />
              ))}
            </section>
          ) : null}

          <section className="detail-surface" aria-labelledby="insights-perf-title">
            <div className="detail-surface-header">
              <h2 id="insights-perf-title">{copy.designPerformance}</h2>
            </div>
            <StyleConversionBars
              styles={perf}
              minTryOns={MIN_CONVERSION_SAMPLE}
              winnerId={topConverter?.styleId}
              leakIds={lowConversion ? [lowConversion.styleId] : []}
            />

            <button type="button" className="insights-collapse-toggle" aria-expanded={perfOpen} onClick={() => setPerfOpen((v) => !v)}>
              <span>{copy.allStyles(perf.length)}</span>
              <span className={`feed-filter-summary-caret${perfOpen ? ' feed-filter-summary-caret-open' : ''}`} aria-hidden>▾</span>
            </button>

            {perfOpen ? (
              <>
                <div className="insights-sort-row">
                  <span className="helper-copy">{copy.sort}</span>
                  {([
                    ['conversion', copy.sortConversion],
                    ['tryOns', copy.sortTryOns],
                  ] as const).map(([key, label]) => (
                    <button key={key} type="button" aria-pressed={perfSort === key} className={`insights-sort-chip${perfSort === key ? ' insights-sort-chip-on' : ''}`} onClick={() => setPerfSort(key)}>{label}</button>
                  ))}
                </div>
                <table className="insights-perf-table" aria-label={copy.tableAria}>
                  <thead>
                    <tr><th>{copy.colStyle}</th><th>{copy.colTryOn}</th><th>{copy.colBook}</th><th>{copy.colConversion}</th></tr>
                  </thead>
                  <tbody>
                    {sortedPerf.map((row) => (
                      <tr key={row.styleId}>
                        <td className="insights-perf-name">{row.title}</td>
                        <td>{row.tryOns}</td>
                        <td>{row.bookings}</td>
                        <td className={hasSample(row) ? 'insights-perf-rate' : 'insights-perf-rate-muted'}>
                          {hasSample(row) ? pct(row.conversionRate) : copy.insufficientSample}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : null}
          </section>

          {(lowConversion || topGap) ? (
            <section className="detail-surface" aria-labelledby="insights-actions-title">
              <div className="detail-surface-header">
                <h2 id="insights-actions-title">{copy.actionsTitle}</h2>
              </div>
              <div className="insights-action-queue">
                {lowConversion ? (
                  <ActionCard
                    text={copy.actionFixPricing(lowConversion.title)}
                    evidence={`${copy.stageTryOns} ${lowConversion.tryOns} · ${copy.stageBookings} ${lowConversion.bookings}`}
                    href={`/merchant/styles/${lowConversion.styleId}/review`}
                    cta={copy.ctaEdit}
                  />
                ) : null}
                {topGap ? (
                  <ActionCard
                    text={copy.actionAddStyles(topGap.label)}
                    evidence={language === 'zh-CN' ? `${topGap.searchCount} 次搜索 · 在售 ${topGap.matchingActiveStyles} 款` : `${topGap.searchCount} searches · ${topGap.matchingActiveStyles} in stock`}
                    href="/merchant/styles"
                    cta={copy.ctaUpload}
                  />
                ) : null}
              </div>
            </section>
          ) : null}
        </>
      )}
    </MobileLayout>
  );
}
