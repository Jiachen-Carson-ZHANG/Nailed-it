'use client';

import { useEffect, useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { EmptyState } from '@/components/ui/EmptyState';
import { MerchantAnalyticsCard } from '@/features/merchant/MerchantAnalyticsCard';
import { getMerchantInsightsAction, summarizeInsightsAction } from '@/lib/actions/insights-actions';
import { isGenericTag } from '@/domain/catalog-tags';
import { useLanguage } from '@/i18n/context';
import type { AppLanguage } from '@/i18n/types';
import type { MerchantInsights, StylePerformance } from '@/domain/intelligence';
import type { AISummary } from '@/nail-ai/insights-summary';

const insightsCopy = {
  'zh-CN': {
    eyebrow: 'Nailed AI · 需求洞察',
    title: '门店数据洞察',
    body: '基于真实顾客行为，实时呈现需求趋势、品类缺口与转化表现。',
    rangeAria: '时间范围',
    today: '今日',
    week: '本周',
    loading: '正在加载数据…',
    emptyTitle: '暂无足够数据',
    emptyBody: '顾客开始浏览、试戴和预约后，这里会显示需求趋势、品类缺口与转化表现。',
    aiSummary: 'AI 摘要',
    aiGenerated: 'AI 生成',
    ruleGenerated: '规则生成',
    aiLoading: 'AI 摘要生成中…',
    snapshot: '数据快照',
    searches: '搜索',
    searchesDetail: '搜索与筛选次数',
    tryOns: '试戴',
    tryOnsDetail: '虚拟试戴次数',
    bookings: '预约',
    bookingsDetail: '确认预约数',
    activeCustomers: '活跃顾客',
    activeCustomersDetail: '有互动行为的顾客',
    demandTrends: '需求趋势',
    vsPrevious: '本期 vs 上期',
    previous: (n: number) => `上期 ${n}`,
    catalogGaps: '品类缺口',
    customerWants: (label: string) => `顾客想要「${label}」`,
    demand: '需求',
    supply: '在售',
    searchCount: (n: number) => `${n} 次搜索`,
    styleCount: (n: number) => `${n} 款`,
    gapHint: '需求远超供给，建议上架更多相关款式。',
    designPerformance: '款式表现',
    highInterestLowConversion: '高意向 · 低转化',
    topConverter: '转化最高',
    topConverterMeta: (rate: string, bookings: number) => `转化率 ${rate} · 预约 ${bookings}`,
    tryOnBook: (tryOns: number, bookings: number) => `试戴 ${tryOns} · 预约 ${bookings}`,
    conversionRate: (rate: string) => `转化率 ${rate}`,
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
  },
  en: {
    eyebrow: 'Nailed AI · Demand insights',
    title: 'Studio insights',
    body: 'Live demand trends, catalog gaps, and conversion — all from real customer behaviour.',
    rangeAria: 'Time range',
    today: 'Today',
    week: 'This week',
    loading: 'Loading insights…',
    emptyTitle: 'Not enough data yet',
    emptyBody: 'Once customers browse, try on styles, and book, demand trends, gaps, and conversion will appear here.',
    aiSummary: 'AI summary',
    aiGenerated: 'AI generated',
    ruleGenerated: 'Rule based',
    aiLoading: 'Generating AI summary…',
    snapshot: 'Snapshot',
    searches: 'Searches',
    searchesDetail: 'Search and filter events',
    tryOns: 'Try-ons',
    tryOnsDetail: 'Virtual try-on sessions',
    bookings: 'Bookings',
    bookingsDetail: 'Confirmed bookings',
    activeCustomers: 'Active customers',
    activeCustomersDetail: 'Customers with recent activity',
    demandTrends: 'Demand trends',
    vsPrevious: 'Current vs previous period',
    previous: (n: number) => `Prev ${n}`,
    catalogGaps: 'Catalog gaps',
    customerWants: (label: string) => `Customers want "${label}"`,
    demand: 'Demand',
    supply: 'Live styles',
    searchCount: (n: number) => `${n} searches`,
    styleCount: (n: number) => `${n} styles`,
    gapHint: 'Demand outpaces supply — consider adding more styles in this category.',
    designPerformance: 'Style performance',
    highInterestLowConversion: 'High interest · low conversion',
    topConverter: 'Top converter',
    topConverterMeta: (rate: string, bookings: number) => `${rate} conversion · ${bookings} bookings`,
    tryOnBook: (tryOns: number, bookings: number) => `${tryOns} try-ons · ${bookings} bookings`,
    conversionRate: (rate: string) => `${rate} conversion`,
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
  },
} satisfies Record<AppLanguage, Record<string, unknown>>;

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
      .then((data) => active && setInsights(data))
      .catch(() => active && setInsights(null))
      .finally(() => active && setLoading(false));
    summarizeInsightsAction(rangeDays, language)
      .then((data) => active && setSummary(data))
      .catch(() => {/* card stays in its loading state */});
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
  const maxSearch = Math.max(1, ...(insights?.catalogGaps.map((g) => g.searchCount) ?? [1]));

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
          <article className="detail-surface insights-ai-card" aria-label={copy.aiSummary}>
            <div className="detail-surface-header">
              <h2>{copy.aiSummary}</h2>
              {summary ? (
                <span className="insights-badge">
                  {summary.source === 'ai' ? copy.aiGenerated : copy.ruleGenerated}
                </span>
              ) : null}
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
              <p className="helper-copy">{copy.aiLoading}</p>
            )}
          </article>

          <section className="analytics-grid" aria-label={copy.snapshot}>
            <MerchantAnalyticsCard title={copy.searches} value={String(s!.searches)} detail={copy.searchesDetail} />
            <MerchantAnalyticsCard title={copy.tryOns} value={String(s!.tryOns)} detail={copy.tryOnsDetail} />
            <MerchantAnalyticsCard title={copy.bookings} value={String(s!.bookings)} detail={copy.bookingsDetail} />
            <MerchantAnalyticsCard title={copy.activeCustomers} value={String(s!.activeCustomers)} detail={copy.activeCustomersDetail} />
          </section>

          {insights.demandTrends.length > 0 ? (
            <section className="detail-surface" aria-labelledby="insights-trends-title">
              <div className="detail-surface-header">
                <h2 id="insights-trends-title">{copy.demandTrends}</h2>
                <span className="helper-copy">{copy.vsPrevious}</span>
              </div>
              <div className="insights-trend-list">
                {insights.demandTrends.filter((t) => !isGenericTag(t.label)).slice(0, 6).map((t) => (
                  <div key={t.label} className="insights-trend-row">
                    <span className="insights-trend-label">{t.label}</span>
                    <span className={`insights-trend-delta insights-trend-${t.direction}`}>{arrow(t.direction)} {t.current}</span>
                    <span className="insights-trend-prev">{copy.previous(t.previous)}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {insights.catalogGaps.length > 0 ? (
            <section className="detail-surface" aria-labelledby="insights-gap-title">
              <div className="detail-surface-header">
                <h2 id="insights-gap-title">{copy.catalogGaps}</h2>
              </div>
              {insights.catalogGaps.map((gap) => (
                <div key={gap.label} className="insights-gap-card">
                  <p className="insights-gap-head">{copy.customerWants(gap.label)}</p>
                  <div className="insights-bar-row">
                    <span className="insights-bar-label">{copy.demand}</span>
                    <span className="insights-bar"><span className="insights-bar-fill insights-bar-demand" style={{ width: `${(gap.searchCount / maxSearch) * 100}%` }} /></span>
                    <span className="insights-bar-num">{copy.searchCount(gap.searchCount)}</span>
                  </div>
                  <div className="insights-bar-row">
                    <span className="insights-bar-label">{copy.supply}</span>
                    <span className="insights-bar"><span className="insights-bar-fill insights-bar-supply" style={{ width: `${Math.max(2, (gap.matchingActiveStyles / Math.max(gap.searchCount, 1)) * 100)}%` }} /></span>
                    <span className="insights-bar-num">{copy.styleCount(gap.matchingActiveStyles)}</span>
                  </div>
                  <p className="helper-copy">{copy.gapHint}</p>
                </div>
              ))}
            </section>
          ) : null}

          <section className="detail-surface" aria-labelledby="insights-perf-title">
            <div className="detail-surface-header">
              <h2 id="insights-perf-title">{copy.designPerformance}</h2>
            </div>
            {lowConversion ? (
              <div className="insights-perf-row">
                <div><span className="insights-badge insights-badge-warn">{copy.highInterestLowConversion}</span><p className="insights-perf-title">{lowConversion.title}</p></div>
                <p className="insights-perf-meta">{copy.tryOnBook(lowConversion.tryOns, lowConversion.bookings)}</p>
              </div>
            ) : null}
            {topConverter ? (
              <div className="insights-perf-row">
                <div><span className="insights-badge insights-badge-good">{copy.topConverter}</span><p className="insights-perf-title">{topConverter.title}</p></div>
                <p className="insights-perf-meta">{copy.topConverterMeta(pct(topConverter.conversionRate), topConverter.bookings)}</p>
              </div>
            ) : null}

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
        </>
      )}
    </MobileLayout>
  );
}
