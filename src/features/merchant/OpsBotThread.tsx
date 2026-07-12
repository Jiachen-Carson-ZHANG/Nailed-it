'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { getInsightsDailySeriesAction } from '@/lib/actions/insights-actions';
import { getMerchantTodayHomeAction } from '@/lib/actions/merchant-home-actions';
import { listAgentRunsAction, listTeamMemoryAction, type TeamMemoryView } from '@/lib/actions/agent-actions';
import { getMerchantAgentRunPath, getMerchantAgentsPath, getMerchantInsightsPath, homePathForRole } from '@/domain/session';
import { useLanguage } from '@/i18n/context';
import type { AppLanguage } from '@/i18n/types';
import type { DailyPoint } from '@/domain/intelligence';
import type { TodayHomeData } from '@/domain/merchant-home';
import type { AgentRunView } from '@/domain/agents';
import { Sparkline } from '@/features/merchant/insights/Sparkline';

const opsBotCopy = {
  'zh-CN': {
    loading: '运营助手正在生成晨报…',
    threadAria: '运营助手团队晨报',
    greeting: '早 👋 这是你的团队晨报：昨天门店发生了什么、AI 团队做了什么、哪些事在等你。',
    yesterdayTitle: '昨日经营',
    asOf: (date: string) => `（最近有数据：${date.slice(5).replace('-', '月')}日）`,
    metric: { tryOns: '试戴', bookings: '预约', searches: '搜索' },
    vsPrior: (d: number) => (d > 0 ? `较前日 +${d}` : d < 0 ? `较前日 ${d}` : '与前日持平'),
    sparkTryOns: '试戴',
    sparkBookings: '预约',
    last14: '近 14 天',
    teamTitle: '团队动态',
    runsLine: (n: number, actions: number, failed: number) =>
      `最近一轮：${n} 次运行 · ${actions} 个动作${failed > 0 ? ` · ${failed} 次失败` : ' · 全部成功'}`,
    viewRun: '查看推理 →',
    measuredTitle: '实测洞察',
    measuredHint: '监测 Agent 用实测结果写入，下一轮决策会引用。',
    deviation: (r: number) => `预测偏差 ×${r}`,
    pendingTitle: '待你确认',
    pendingLine: (n: number) => `${n} 件事在等你拍板`,
    pendingGo: '去处理 →',
    fullReport: '完整数据报告 →',
    teamPage: 'AI 团队 →',
    quiet: '昨日团队无新动作 · 一切平稳',
  },
  en: {
    loading: 'Preparing the team debrief…',
    threadAria: 'Ops assistant team debrief',
    greeting: 'Morning 👋 Your team debrief: what happened yesterday, what the AI team did, and what needs you.',
    yesterdayTitle: 'Yesterday',
    asOf: (date: string) => ` (latest data: ${date.slice(5)})`,
    metric: { tryOns: 'Try-ons', bookings: 'Bookings', searches: 'Searches' },
    vsPrior: (d: number) => (d > 0 ? `+${d} vs prior day` : d < 0 ? `${d} vs prior day` : 'flat vs prior day'),
    sparkTryOns: 'Try-ons',
    sparkBookings: 'Bookings',
    last14: 'last 14 days',
    teamTitle: 'Team activity',
    runsLine: (n: number, actions: number, failed: number) =>
      `Latest round: ${n} runs · ${actions} actions${failed > 0 ? ` · ${failed} failed` : ' · all succeeded'}`,
    viewRun: 'View reasoning →',
    measuredTitle: 'Measured outcomes',
    measuredHint: 'Written by the monitor from real results; the next round cites them.',
    deviation: (r: number) => `forecast off ×${r}`,
    pendingTitle: 'Needs you',
    pendingLine: (n: number) => `${n} decision${n === 1 ? '' : 's'} waiting on you`,
    pendingGo: 'Review →',
    fullReport: 'Full data report →',
    teamPage: 'AI team →',
    quiet: 'No new team actions yesterday · all steady',
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

const hasActivity = (p: DailyPoint) => p.tryOns + p.bookings + p.searches > 0;

/** The freshest full day vs the day before it. The last series point is today-in-progress (skipped);
 *  if yesterday is empty (stale seed), fall back to the most recent day WITH activity and say which
 *  date it was — an honest "quietest recent day" beats a wall of zeros. */
function yesterdayDelta(series: DailyPoint[]): { y: DailyPoint; isYesterday: boolean; delta: Record<'tryOns' | 'bookings' | 'searches', number> } | null {
  if (series.length < 3) return null;
  const yesterdayIdx = series.length - 2;
  let idx = yesterdayIdx;
  while (idx > 0 && !hasActivity(series[idx])) idx -= 1;
  if (!hasActivity(series[idx])) return null; // whole window empty — hide the card
  const y = series[idx];
  const prior = series[idx - 1] ?? { ...y, tryOns: 0, bookings: 0, searches: 0 };
  return {
    y,
    isYesterday: idx === yesterdayIdx,
    delta: {
      tryOns: y.tryOns - prior.tryOns,
      bookings: y.bookings - prior.bookings,
      searches: y.searches - prior.searches,
    },
  };
}

/** The latest ROUND, reconstructed from the runs list (newest-first) by the round's own domain rule:
 *  RoundState dispatches each agent AT MOST ONCE per round — so the newest round ends where a slug
 *  repeats. A 30-min time gap is the secondary cut (rounds complete in minutes). Grouping by calendar
 *  day or by gap alone chained back-to-back rehearsal rounds into "30 次运行". */
const ROUND_GAP_MS = 30 * 60 * 1000;
function latestRound(runs: AgentRunView[]): AgentRunView[] {
  if (runs.length === 0) return [];
  const out = [runs[0]];
  const seen = new Set([runs[0].agentSlug]);
  for (let i = 1; i < runs.length; i += 1) {
    if (seen.has(runs[i].agentSlug)) break; // one dispatch per agent per round — a repeat = previous round
    const prevTs = new Date(out[out.length - 1].startedAt).getTime();
    const ts = new Date(runs[i].startedAt).getTime();
    if (prevTs - ts > ROUND_GAP_MS) break;
    seen.add(runs[i].agentSlug);
    out.push(runs[i]);
  }
  return out;
}

/**
 * Ops-assistant thread = the team's daily debrief (2026-07-13 rebuild). The pre-agent version pushed a
 * second copy of the insights dashboard (weekly funnel/trends/gaps/style bars) plus "recommended
 * actions" — but the agent team now ACTS instead of recommending, so the thread narrates what happened:
 * yesterday's real numbers (analytics_events), what the team did (agent_actions + runs), what it
 * measured (agent_memory, incl. forecast deviation), and what awaits the merchant (proposed gate).
 * Deep data exploration stays on /merchant/insights — one layer per surface, no duplicated report.
 */
export function OpsBotThread() {
  const { language } = useLanguage();
  const copy = opsBotCopy[language];
  const [series, setSeries] = useState<DailyPoint[] | null>(null);
  const [home, setHome] = useState<TodayHomeData | null>(null);
  const [memory, setMemory] = useState<TeamMemoryView[]>([]);
  const [runs, setRuns] = useState<AgentRunView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      getInsightsDailySeriesAction(14),
      getMerchantTodayHomeAction(),
      listTeamMemoryAction(),
      listAgentRunsAction(),
    ])
      .then(([s, h, m, r]) => {
        if (!active) return;
        if (s.status === 'fulfilled') setSeries(s.value);
        if (h.status === 'fulfilled') setHome(h.value);
        if (m.status === 'fulfilled') setMemory(m.value);
        if (r.status === 'fulfilled') setRuns(r.value);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <p className="helper-copy">{copy.loading}</p>;

  const yd = series ? yesterdayDelta(series) : null;
  const roundRuns = latestRound(runs);
  const roundActions = roundRuns.reduce((n, r) => n + r.actions.length, 0);
  const roundFailed = roundRuns.filter((r) => r.status === 'failed').length;
  const recentActions = (home?.recent ?? []).slice(0, 3);
  const pending = home?.pending ?? [];
  // Measured conclusions only — the monitor's evidence layer (outcomes + calibration), not preferences.
  const measured = memory.filter((m) => m.kind === 'action_outcome' || m.kind === 'calibration').slice(0, 2);

  return (
    <div className="opsbot-thread" aria-label={copy.threadAria}>
      <Bubble>{copy.greeting}</Bubble>

      {yd ? (
        <Bubble title={yd.isYesterday ? copy.yesterdayTitle : `${copy.yesterdayTitle}${copy.asOf(yd.y.date)}`}>
          <ul className="opsbot-pulse">
            {(['tryOns', 'bookings', 'searches'] as const).map((k) => (
              <li key={k} className="opsbot-pulse-row">
                <span className="opsbot-pulse-label">{copy.metric[k]}</span>
                <strong className="opsbot-pulse-value">{yd.y[k]}</strong>
                <span className={`opsbot-pulse-delta${yd.delta[k] > 0 ? ' ok' : yd.delta[k] < 0 ? ' bad' : ''}`}>
                  {copy.vsPrior(yd.delta[k])}
                </span>
              </li>
            ))}
          </ul>
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
      ) : null}

      <Bubble title={copy.teamTitle}>
        {roundRuns.length > 0 ? (
          <p className="opsbot-runs-line">{copy.runsLine(roundRuns.length, roundActions, roundFailed)}</p>
        ) : null}
        {recentActions.length > 0 ? (
          <ul className="opsbot-team-list">
            {recentActions.map((a) => (
              <li key={a.id} className="opsbot-team-row">
                <span aria-hidden className="opsbot-team-icon">{a.icon}</span>
                <div className="opsbot-team-body">
                  <p className="opsbot-team-agent">{a.agentLabel}</p>
                  <p className="opsbot-team-title">{a.title}</p>
                </div>
                <Link className="opsbot-team-link" href={getMerchantAgentRunPath(a.runId)}>{copy.viewRun}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="helper-copy">{copy.quiet}</p>
        )}
      </Bubble>

      {measured.length > 0 ? (
        <Bubble title={copy.measuredTitle}>
          <p className="opsbot-measured-hint">{copy.measuredHint}</p>
          <ul className="opsbot-measured-list">
            {measured.map((m) => (
              <li key={m.id} className="opsbot-measured-row">
                <p className="opsbot-measured-claim">{m.claim}</p>
                {m.comparison?.ratio ? (
                  <span className="opsbot-measured-badge">{copy.deviation(m.comparison.ratio)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Bubble>
      ) : null}

      {pending.length > 0 ? (
        <Bubble title={copy.pendingTitle}>
          <p className="opsbot-pending-line">{copy.pendingLine(pending.length)}</p>
          <ul className="opsbot-pending-list">
            {pending.slice(0, 2).map((a) => (
              <li key={a.id} className="opsbot-pending-row">
                <span aria-hidden className="opsbot-team-icon">{a.icon}</span>
                <span className="opsbot-pending-title">{a.title}</span>
              </li>
            ))}
          </ul>
          <Link className="button button-primary button-block" href={homePathForRole('merchant')}>{copy.pendingGo}</Link>
        </Bubble>
      ) : null}

      <div className="opsbot-footer-links">
        <Link className="button button-secondary button-block" href={getMerchantInsightsPath()}>{copy.fullReport}</Link>
        <Link className="button button-secondary button-block" href={getMerchantAgentsPath()}>{copy.teamPage}</Link>
      </div>
    </div>
  );
}
