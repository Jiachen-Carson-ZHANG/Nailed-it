'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  getMerchantInsightsAction,
  getInsightsDailySeriesAction,
  summarizeInsightsAction,
} from '@/lib/actions/insights-actions';
import { isGenericTag } from '@/domain/catalog-tags';
import { getMerchantInsightsPath } from '@/domain/session';
import { useLanguage } from '@/i18n/context';
import type { AppLanguage } from '@/i18n/types';
import type { MerchantInsights, DailyPoint, StylePerformance } from '@/domain/intelligence';
import type { AISummary } from '@/nail-ai/insights-summary';
import { FunnelChart, type FunnelStage } from '@/features/merchant/insights/FunnelChart';
import { TrendBars } from '@/features/merchant/insights/TrendBars';
import { GapBar } from '@/features/merchant/insights/GapBar';
import { StyleConversionBars } from '@/features/merchant/insights/StyleConversionBars';
import { ActionCard } from '@/features/merchant/insights/ActionCard';
import { Sparkline } from '@/features/merchant/insights/Sparkline';

const MIN_CONVERSION_SAMPLE = 3;

const opsBotCopy = {
  'zh-CN': {
    loading: '运营助手正在生成简报…',
    threadAria: '运营助手简报',
    greeting: '嗨，我是 Nailed AI 运营助手 👋 这是你的门店简报。',
    dailyTitle: '今日简报',
    todayMetrics: (tryOns: number, bookings: number, customers: number) =>
      `试戴 ${tryOns} · 预约 ${bookings} · 活跃顾客 ${customers}`,
    sparkTryOns: '试戴',
    sparkBookings: '预约',
    last14: '近 14 天',
    weeklyTitle: '本周报告',
    funnelTitle: '客户旅程',
    stageImpressions: '曝光',
    stageClicks: '点击',
    stageDetails: '详情',
    stageTryOns: '试戴',
    stageBookings: '预约',
    demandTitle: '需求趋势',
    gapTitle: '品类缺口',
    perfTitle: '款式表现',
    actionsTitle: '建议行动',
    actionFixPricing: (title: string) => `复查「${title}」定价或展示，提升转化`,
    actionAddStyles: (label: string) => `上架更多「${label}」风格，补足缺口`,
    ctaEdit: '去编辑',
    ctaUpload: '去上架',
    fullReport: '查看完整报告 →',
  },
  en: {
    loading: 'Preparing your studio briefing…',
    threadAria: 'Ops assistant briefing',
    greeting: 'Hi, I\'m the Nailed AI ops assistant 👋 Here is your studio briefing.',
    dailyTitle: 'Today',
    todayMetrics: (tryOns: number, bookings: number, customers: number) =>
      `${tryOns} try-ons · ${bookings} bookings · ${customers} active customers`,
    sparkTryOns: 'Try-ons',
    sparkBookings: 'Bookings',
    last14: 'last 14 days',
    weeklyTitle: 'This week',
    funnelTitle: 'Customer journey',
    stageImpressions: 'Impressions',
    stageClicks: 'Clicks',
    stageDetails: 'Detail views',
    stageTryOns: 'Try-ons',
    stageBookings: 'Bookings',
    demandTitle: 'Demand trends',
    gapTitle: 'Catalog gaps',
    perfTitle: 'Style performance',
    actionsTitle: 'Recommended actions',
    actionFixPricing: (title: string) => `Review “${title}” pricing or display to lift conversion`,
    actionAddStyles: (label: string) => `Add more “${label}” styles to close the gap`,
    ctaEdit: 'Edit',
    ctaUpload: 'Add styles',
    fullReport: 'View full report →',
  },
} satisfies Record<AppLanguage, Record<string, unknown>>;

function Bubble({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className={`opsbot-bubble${title ? ' opsbot-bubble-card' : ''}`}>
      {title ? <p className="opsbot-bubble-title">{title}</p> : null}
      {children}
    </div>
  );
}

/**
 * Ops-assistant report thread (ADR-0006, Phase G2 + 2026-06-08 data-story pass). Posts a light
 * daily pulse card (today + 14-day sparklines) and a weekly digest card (funnel + demand + gap +
 * conversion + actions) reusing the insights chart components. Deterministic — the AI only narrates
 * the grounded weekly headline.
 */
export function OpsBotThread() {
  const { language } = useLanguage();
  const copy = opsBotCopy[language];
  const [today, setToday] = useState<MerchantInsights | null>(null);
  const [week, setWeek] = useState<MerchantInsights | null>(null);
  const [series, setSeries] = useState<DailyPoint[] | null>(null);
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([getMerchantInsightsAction(1), getMerchantInsightsAction(7), getInsightsDailySeriesAction(14)])
      .then(([t, w, s]) => {
        if (active) {
          setToday(t);
          setWeek(w);
          setSeries(s);
        }
      })
      .catch(() => {/* leave null */})
      .finally(() => active && setLoading(false));
    summarizeInsightsAction(7, language).then((s) => active && setSummary(s)).catch(() => {/* bubble omitted */});
    return () => {
      active = false;
    };
  }, [language]);

  if (loading || !today || !week) return <p className="helper-copy">{copy.loading}</p>;

  const ts = today.snapshot;
  const ws = week.snapshot;
  const funnelStages: FunnelStage[] = [
    { label: copy.stageImpressions, count: ws.impressions },
    { label: copy.stageClicks, count: ws.clicks },
    { label: copy.stageDetails, count: ws.detailViews },
    { label: copy.stageTryOns, count: ws.tryOns },
    { label: copy.stageBookings, count: ws.bookings },
  ];
  const trendRows = week.demandTrends.filter((t) => !isGenericTag(t.label));
  const gap = week.catalogGaps[0];
  const low = week.designPerformance.highInterestLowConversion[0];
  const top = [...week.designPerformance.styles]
    .filter((s: StylePerformance) => s.tryOns >= MIN_CONVERSION_SAMPLE && s.conversionRate != null)
    .sort((a, b) => b.conversionRate! - a.conversionRate!)[0];

  return (
    <div className="opsbot-thread" aria-label={copy.threadAria}>
      <Bubble>{copy.greeting}</Bubble>

      <Bubble title={copy.dailyTitle}>
        <p className="opsbot-metrics">{copy.todayMetrics(ts.tryOns, ts.bookings, ts.activeCustomers)}</p>
        {series ? (
          <div className="opsbot-sparkrow">
            <div className="opsbot-spark">
              <span className="opsbot-spark-label">{copy.sparkTryOns}</span>
              <Sparkline points={series.map((p) => p.tryOns)} tone="accent" label={`${copy.sparkTryOns} ${copy.last14}`} />
            </div>
            <div className="opsbot-spark">
              <span className="opsbot-spark-label">{copy.sparkBookings}</span>
              <Sparkline points={series.map((p) => p.bookings)} tone="muted" label={`${copy.sparkBookings} ${copy.last14}`} />
            </div>
          </div>
        ) : null}
      </Bubble>

      <Bubble title={copy.weeklyTitle}>
        {summary ? <p className="opsbot-headline">{summary.headline}</p> : null}
        <p className="opsbot-section-label">{copy.funnelTitle}</p>
        <FunnelChart stages={funnelStages} />
      </Bubble>

      {trendRows.length > 0 ? (
        <Bubble title={copy.demandTitle}>
          <TrendBars rows={trendRows} limit={3} />
        </Bubble>
      ) : null}

      {gap ? (
        <Bubble title={copy.gapTitle}>
          <GapBar gap={gap} />
        </Bubble>
      ) : null}

      {week.designPerformance.styles.some((s) => s.tryOns > 0) ? (
        <Bubble title={copy.perfTitle}>
          <StyleConversionBars
            styles={week.designPerformance.styles}
            minTryOns={MIN_CONVERSION_SAMPLE}
            limit={3}
            winnerId={top?.styleId}
            leakIds={low ? [low.styleId] : []}
          />
        </Bubble>
      ) : null}

      {(low || gap) ? (
        <Bubble title={copy.actionsTitle}>
          <div className="insights-action-queue">
            {low ? (
              <ActionCard
                text={copy.actionFixPricing(low.title)}
                evidence={`${copy.stageTryOns} ${low.tryOns} · ${copy.stageBookings} ${low.bookings}`}
                href={`/merchant/styles/${low.styleId}/review`}
                cta={copy.ctaEdit}
              />
            ) : null}
            {gap ? (
              <ActionCard
                text={copy.actionAddStyles(gap.label)}
                evidence={language === 'zh-CN' ? `${gap.searchCount} 次搜索 · 在售 ${gap.matchingActiveStyles} 款` : `${gap.searchCount} searches · ${gap.matchingActiveStyles} in stock`}
                href="/merchant/styles"
                cta={copy.ctaUpload}
              />
            ) : null}
          </div>
        </Bubble>
      ) : null}

      <Link className="button button-primary button-block" href={getMerchantInsightsPath()}>{copy.fullReport}</Link>
    </div>
  );
}
