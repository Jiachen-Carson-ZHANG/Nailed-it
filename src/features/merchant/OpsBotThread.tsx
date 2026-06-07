'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { getMerchantInsightsAction, summarizeInsightsAction } from '@/lib/actions/insights-actions';
import { isGenericTag } from '@/domain/catalog-tags';
import { getMerchantInsightsPath } from '@/domain/session';
import { useLanguage } from '@/i18n/context';
import type { AppLanguage } from '@/i18n/types';
import type { MerchantInsights } from '@/domain/intelligence';
import type { AISummary } from '@/nail-ai/insights-summary';

const opsBotCopy = {
  'zh-CN': {
    loading: '运营助手正在生成简报…',
    threadAria: '运营助手简报',
    greeting: '嗨，我是 Nailed AI 运营助手 👋 这是你的门店简报。',
    today: '今日',
    todayStats: (searches: number, tryOns: number, bookings: number, customers: number) =>
      `搜索 ${searches} · 试戴 ${tryOns} · 预约 ${bookings} · 活跃顾客 ${customers}`,
    weekSummary: '本周摘要',
    demandRising: (label: string, current: number, previous: number) =>
      `📈 需求上升：「${label}」本周 ${current}（上期 ${previous}）。`,
    catalogGap: (label: string, searches: number, styles: number) =>
      `⚠️ 品类缺口：顾客想要「${label}」，${searches} 次搜索但仅 ${styles} 款在售。建议上架补足。`,
    topConverter: (title: string, rate: number) => `🔥 转化最高：${title}（${rate}%）`,
    lowConversion: (title: string, tryOns: number, bookings: number) =>
      `⚠️ ${title} 高意向低转化：试戴 ${tryOns} / 预约 ${bookings}`,
    fullReport: '查看完整报告 →',
    chipTrends: '需求趋势',
    chipConversion: '转化榜',
    chipGaps: '品类缺口',
  },
  en: {
    loading: 'Preparing your studio briefing…',
    threadAria: 'Ops assistant briefing',
    greeting: 'Hi, I\'m the Nailed AI ops assistant 👋 Here is your studio briefing.',
    today: 'Today',
    todayStats: (searches: number, tryOns: number, bookings: number, customers: number) =>
      `${searches} searches · ${tryOns} try-ons · ${bookings} bookings · ${customers} active customers`,
    weekSummary: 'This week',
    demandRising: (label: string, current: number, previous: number) =>
      `📈 Rising demand: "${label}" — ${current} this week (was ${previous}).`,
    catalogGap: (label: string, searches: number, styles: number) =>
      `⚠️ Catalog gap: customers want "${label}" — ${searches} searches but only ${styles} styles live. Consider adding more.`,
    topConverter: (title: string, rate: number) => `🔥 Top converter: ${title} (${rate}%)`,
    lowConversion: (title: string, tryOns: number, bookings: number) =>
      `⚠️ ${title} — high interest, low conversion: ${tryOns} try-ons / ${bookings} bookings`,
    fullReport: 'View full report →',
    chipTrends: 'Demand trends',
    chipConversion: 'Conversion rank',
    chipGaps: 'Catalog gaps',
  },
} satisfies Record<AppLanguage, Record<string, unknown>>;

function Bubble({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'alert' }) {
  return <div className={`opsbot-bubble${tone === 'alert' ? ' opsbot-bubble-alert' : ''}`}>{children}</div>;
}

/**
 * Deterministic ops-assistant digest (ADR-0006, Phase G2). Posts pre-computed insight cards (today
 * + week) as chat bubbles; quick-reply chips deep-link to the full report. No free-text NLP — the
 * AI only narrates the grounded summary.
 */
export function OpsBotThread() {
  const { language } = useLanguage();
  const copy = opsBotCopy[language];
  const [today, setToday] = useState<MerchantInsights | null>(null);
  const [week, setWeek] = useState<MerchantInsights | null>(null);
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([getMerchantInsightsAction(1), getMerchantInsightsAction(7)])
      .then(([t, w]) => {
        if (active) {
          setToday(t);
          setWeek(w);
        }
      })
      .catch(() => {/* leave null */})
      .finally(() => active && setLoading(false));
    summarizeInsightsAction(7).then((s) => active && setSummary(s)).catch(() => {/* bubble omitted */});
    return () => {
      active = false;
    };
  }, []);

  if (loading || !today || !week) return <p className="helper-copy">{copy.loading}</p>;

  const ts = today.snapshot;
  const rising = week.demandTrends.find((t) => t.direction === 'up' && !isGenericTag(t.label));
  const gap = week.catalogGaps[0];
  const low = week.designPerformance.highInterestLowConversion[0];
  const top = [...week.designPerformance.styles]
    .filter((s) => s.tryOns >= 3 && s.conversionRate != null)
    .sort((a, b) => b.conversionRate! - a.conversionRate!)[0];

  return (
    <div className="opsbot-thread" aria-label={copy.threadAria}>
      <Bubble>{copy.greeting}</Bubble>

      <Bubble>
        <strong>{copy.today}</strong>
        <br />
        {copy.todayStats(ts.searches, ts.tryOns, ts.bookings, ts.activeCustomers)}
      </Bubble>

      {summary ? (
        <Bubble>
          <strong>{copy.weekSummary}</strong>
          <br />
          {summary.headline}
          {summary.insights.map((line) => (
            <div key={line} className="opsbot-bullet">· {line}</div>
          ))}
        </Bubble>
      ) : null}

      {rising ? (
        <Bubble>{copy.demandRising(rising.label, rising.current, rising.previous)}</Bubble>
      ) : null}

      {gap ? (
        <Bubble tone="alert">
          {copy.catalogGap(gap.label, gap.searchCount, gap.matchingActiveStyles)}
        </Bubble>
      ) : null}

      {top || low ? (
        <Bubble>
          {top ? copy.topConverter(top.title, Math.round((top.conversionRate ?? 0) * 100)) : ''}
          {top && low ? <br /> : null}
          {low ? copy.lowConversion(low.title, low.tryOns, low.bookings) : ''}
        </Bubble>
      ) : null}

      <div className="opsbot-chips">
        <Link className="button button-primary button-compact" href={getMerchantInsightsPath()}>{copy.fullReport}</Link>
        <Link className="opsbot-chip" href={getMerchantInsightsPath()}>{copy.chipTrends}</Link>
        <Link className="opsbot-chip" href={getMerchantInsightsPath()}>{copy.chipConversion}</Link>
        <Link className="opsbot-chip" href={getMerchantInsightsPath()}>{copy.chipGaps}</Link>
      </div>
    </div>
  );
}
