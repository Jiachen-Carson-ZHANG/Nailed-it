'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { getMerchantInsightsAction, summarizeInsightsAction } from '@/lib/actions/insights-actions';
import { isGenericTag } from '@/domain/catalog-tags';
import { getMerchantInsightsPath } from '@/domain/session';
import type { MerchantInsights } from '@/domain/intelligence';
import type { AISummary } from '@/nail-ai/insights-summary';

function Bubble({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'alert' }) {
  return <div className={`opsbot-bubble${tone === 'alert' ? ' opsbot-bubble-alert' : ''}`}>{children}</div>;
}

/**
 * Deterministic ops-assistant digest (ADR-0006, Phase G2). Posts pre-computed insight cards (today
 * + week) as chat bubbles; quick-reply chips deep-link to the full report. No free-text NLP — the
 * AI only narrates the grounded summary.
 */
export function OpsBotThread() {
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

  if (loading || !today || !week) return <p className="helper-copy">运营助手正在生成快报…</p>;

  const ts = today.snapshot;
  const rising = week.demandTrends.find((t) => t.direction === 'up' && !isGenericTag(t.label));
  const gap = week.catalogGaps[0];
  const low = week.designPerformance.highInterestLowConversion[0];
  const top = [...week.designPerformance.styles]
    .filter((s) => s.tryOns >= 3 && s.conversionRate != null)
    .sort((a, b) => b.conversionRate! - a.conversionRate!)[0];

  return (
    <div className="opsbot-thread" aria-label="运营助手快报">
      <Bubble>嗨，我是 Nailed AI 运营助手 👋 这是你的经营快报。</Bubble>

      <Bubble>
        <strong>今日</strong>
        <br />搜索 {ts.searches} · 试戴 {ts.tryOns} · 预订 {ts.bookings} · 活跃顾客 {ts.activeCustomers}
      </Bubble>

      {summary ? (
        <Bubble>
          <strong>本周摘要</strong>
          <br />{summary.headline}
          {summary.insights.map((line) => (
            <div key={line} className="opsbot-bullet">· {line}</div>
          ))}
        </Bubble>
      ) : null}

      {rising ? (
        <Bubble>📈 需求上升：「{rising.label}」本周 {rising.current}（上周 {rising.previous}）。</Bubble>
      ) : null}

      {gap ? (
        <Bubble tone="alert">
          ⚠️ 品类缺口：顾客想要「{gap.label}」，{gap.searchCount} 次搜索但仅 {gap.matchingActiveStyles} 款在售。建议上架补足。
        </Bubble>
      ) : null}

      {top || low ? (
        <Bubble>
          {top ? `🔥 转化最高：${top.title}（${Math.round((top.conversionRate ?? 0) * 100)}%）` : ''}
          {top && low ? <br /> : null}
          {low ? `⚠️ ${low.title} 高意向低转化：试戴 ${low.tryOns} / 预订 ${low.bookings}` : ''}
        </Bubble>
      ) : null}

      <div className="opsbot-chips">
        <Link className="button button-primary button-compact" href={getMerchantInsightsPath()}>查看完整报告 →</Link>
        <Link className="opsbot-chip" href={getMerchantInsightsPath()}>需求趋势</Link>
        <Link className="opsbot-chip" href={getMerchantInsightsPath()}>转化榜</Link>
        <Link className="opsbot-chip" href={getMerchantInsightsPath()}>品类缺口</Link>
      </div>
    </div>
  );
}
