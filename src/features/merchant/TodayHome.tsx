'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { approveAgentActionAction, rejectAgentActionAction } from '@/lib/actions/agent-actions';
import { getMerchantTodayHomeAction } from '@/lib/actions/merchant-home-actions';
import type { HomeActionView, TechnicianLabel, TodayHomeData } from '@/domain/merchant-home';
import { useLanguage } from '@/i18n/context';
import { AgentRunSheet } from './AgentRunSheet';
import styles from './TodayHome.module.css';

// Merchant 今日 home (agent-first) per DESIGN.md → "Merchant Agent Home". Rendered at the tab-1 route
// /merchant/calendar; the full calendar lives at /merchant/calendar/schedule (reached via the 今日预约
// stat card). Data = one read model (getMerchantTodayHomeAction, ADR-0011) with per-field error
// isolation + silent retry. Controls are backend-honest: every PROPOSED action → 批准/拒绝.

const FULL_CALENDAR_PATH = '/merchant/calendar/schedule';
const AGENTS_PATH = '/merchant/agents';

/** Demo stat strip — fixed mock values with navigation targets (not compute-on-read). */
const STAT_STRIP_MOCK = [
  { value: '¥27,308', metricKey: 'revenueMetric' as const, labelKey: 'revenue' as const, href: '/merchant/messages/ops?range=week' },
  { value: '12', metricKey: 'ordersMetric' as const, labelKey: 'orders' as const, href: FULL_CALENDAR_PATH },
  { valueKey: 'hotElementValue' as const, metricKey: 'hotMetric' as const, labelKey: 'hotElement' as const, href: '/merchant/styles' },
] as const;

const copy = {
  'zh-CN': {
    title: '今日经营',
    revenue: '查看周报', orders: '查看日历', hotElement: '查看款式', hotElementValue: '夏季清透感',
    revenueMetric: '本周营收', ordersMetric: '今日预约', hotMetric: '本周热点',
    aiTeamCta: '🤖 管理 AI 团队',
    attn: '需要关注', recent: '最近完成',
    approve: '批准', reject: '拒绝', view: '查看', pending: '待你确认', done: '已执行', reason: '查看推理 →',
    loading: '加载中…', calm: '今日无新动作', calmBody: 'AI 团队在后台监测中，需要你决定的会钉在这里。',
    errActions: '最近动作加载失败 · 重试', errStats: '数据暂不可用',
    more: (n: number) => `还有 ${n} 条待确认`, less: '收起',
    techs: '美甲师管理', fullCal: '完整日历 →', errTechs: '排班加载失败 · 重试',
    noTechs: '今日无排班', busy: '忙碌', free: '空闲', off: '下班',
    techLoad: (n: number) => `今日 ${n} 单`,
    tServing: (s: string) => `接待中 · ${s}`, tNext: (time: string, s: string) => `下一场 ${time} · ${s}`,
    tDone: '今日已完成', tIdle: '当前空闲，可插单', tOff: '今日未排班',
  },
  en: {
    title: 'Today',
    revenue: 'View report', orders: 'View calendar', hotElement: 'View styles', hotElementValue: 'Summer sheer look',
    revenueMetric: 'Week revenue', ordersMetric: 'Bookings today', hotMetric: 'Trending now',
    aiTeamCta: '🤖 Manage AI team',
    attn: 'Needs you', recent: 'Recently done',
    approve: 'Approve', reject: 'Reject', view: 'View', pending: 'Awaiting you', done: 'Done', reason: 'View reasoning →',
    loading: 'Loading…', calm: 'Nothing new today', calmBody: 'The AI team is monitoring; anything needing your call will be pinned here.',
    errActions: 'Failed to load actions · retry', errStats: 'Data unavailable',
    more: (n: number) => `${n} more to confirm`, less: 'Collapse',
    techs: 'Nail tech management', fullCal: 'Full calendar →', errTechs: 'Failed to load schedule · retry',
    noTechs: 'No shifts today', busy: 'Busy', free: 'Open', off: 'Off',
    techLoad: (n: number) => `${n} today`,
    tServing: (s: string) => `With a client · ${s}`, tNext: (time: string, s: string) => `Next ${time} · ${s}`,
    tDone: 'Done for today', tIdle: 'Free now', tOff: 'Not scheduled today',
  },
} as const;

// Silent background retries after a failed/partial read: during a live demo a transient blip (cold
// compile, DB hiccup) must not flash an error card — the UI keeps what it has and refetches quietly.
// The error state only surfaces once every retry is spent AND the field still has nothing to show.
const RETRY_DELAYS_MS = [1500, 4000];
const EMPTY_HOME: TodayHomeData = { stats: null, pending: [], recent: [], technicians: [], agents: [], errors: ['stats', 'actions', 'technicians'] };

function mergeReads(prev: TodayHomeData | null, next: TodayHomeData): TodayHomeData {
  if (!prev) return next;
  const fresh = (field: string) => !next.errors.includes(field);
  const stats = fresh('stats') ? next.stats : prev.stats;
  const pending = fresh('actions') ? next.pending : prev.pending;
  const recent = fresh('actions') ? next.recent : prev.recent;
  const technicians = fresh('technicians') ? next.technicians : prev.technicians;
  return {
    stats, pending, recent, technicians,
    agents: next.agents.length > 0 ? next.agents : prev.agents,
    // A field only stays in error if we ALSO have nothing stale to show for it.
    errors: next.errors.filter((field) =>
      (field === 'stats' && stats === null) ||
      (field === 'actions' && pending.length === 0 && recent.length === 0) ||
      (field === 'technicians' && technicians.length === 0)),
  };
}

function hhmm(iso: string, locale: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
}

const techStateClass: Record<string, string> = {
  busy: styles.tstateBusy,
  free: styles.tstateFree,
  off: styles.tstateOff,
};

export function TodayHome() {
  const { language } = useLanguage();
  const t = copy[language];
  const locale = language === 'zh-CN' ? 'zh-CN' : 'en';

  // Format the technician's structured status per-language (the domain stays i18n-free).
  const techLabelText = (label: TechnicianLabel): string => {
    switch (label.kind) {
      case 'serving': return t.tServing(label.styleTitle);
      case 'next': return t.tNext(label.time, label.styleTitle);
      case 'done': return t.tDone;
      case 'idle': return t.tIdle;
      case 'off': return t.tOff;
    }
  };
  const [data, setData] = useState<TodayHomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllPending, setShowAllPending] = useState(false);
  const [sheetRunId, setSheetRunId] = useState<string | null>(null); // open reasoning drill-down (Phase 3)
  const dataRef = useRef<TodayHomeData | null>(null);

  const load = useCallback(() => {
    let alive = true; // a re-load (or unmount) supersedes any in-flight retry chain
    setLoading(dataRef.current === null);
    const attempt = (n: number) => {
      // Never an infinite spinner (DESIGN.md interaction-state rule); the 15s headroom covers a cold
      // dev first-load. Partial/failed reads retry silently (see RETRY_DELAYS_MS) before any error UI.
      const timeout = new Promise<TodayHomeData>((resolve) => setTimeout(() => resolve(EMPTY_HOME), 15000));
      void Promise.race([getMerchantTodayHomeAction(), timeout])
        .catch(() => EMPTY_HOME)
        .then((d) => {
          if (!alive) return;
          const retrying = d.errors.length > 0 && n < RETRY_DELAYS_MS.length;
          const merged = mergeReads(dataRef.current, d);
          // While quietly retrying, suppress error fields — show whatever content exists instead.
          const next = retrying ? { ...merged, errors: [] } : merged;
          dataRef.current = next;
          setData(next);
          const hasContent = next.stats !== null || next.pending.length > 0 || next.recent.length > 0 || next.technicians.length > 0;
          setLoading(retrying && !hasContent);
          if (retrying) setTimeout(() => { if (alive) attempt(n + 1); }, RETRY_DELAYS_MS[n]);
        });
    };
    attempt(0);
    return () => { alive = false; };
  }, []);

  useEffect(load, [load]);

  const act = useCallback((action: HomeActionView, kind: 'approve' | 'reject') => {
    // Optimistic: drop the pinned action; fire the backed server action.
    setData((prev) => (prev ? { ...prev, pending: prev.pending.filter((a) => a.id !== action.id) } : prev));
    const fn = kind === 'approve' ? approveAgentActionAction : rejectAgentActionAction;
    // setActionStatus returns null on a stale/invalid transition (already resolved, wrong merchant). A
    // thrown error and a null both mean the optimistic drop was wrong → reload to restore the truth.
    void fn(action.id)
      .then((result) => { if (!result) load(); })
      .catch(load);
  }, [load]);

  const err = (key: string) => data?.errors.includes(key) ?? false;
  const pending = data?.pending ?? [];
  const recent = data?.recent ?? [];
  const technicians = data?.technicians ?? [];

  return (
    <div className={styles.home}>
      {/* 1 · stat strip (mock demo values + navigation) */}
      <div className={styles.titlebar}>
        <div className={styles.titleGroup}>
          <h1>{t.title}</h1>
          <span className={styles.date}>
            {new Date().toLocaleDateString(locale, { month: 'long', day: 'numeric', weekday: 'short' })}
          </span>
        </div>
        <Link className={styles.titleCta} href={AGENTS_PATH}>{t.aiTeamCta}</Link>
      </div>
      <div className={styles.statStrip}>
        {STAT_STRIP_MOCK.map((stat) => {
          const value = 'valueKey' in stat ? t[stat.valueKey] : stat.value;
          const label = t[stat.labelKey];
          return (
            <Link key={stat.href} href={stat.href} className={styles.stat} aria-label={`${t[stat.metricKey]} ${value} · ${label}`}>
              <div className={styles.statM}>{t[stat.metricKey]}</div>
              <div className={'valueKey' in stat ? `${styles.statN} ${styles.statNText}` : styles.statN}>
                {value}
              </div>
              <div className={styles.statL}>{label}</div>
            </Link>
          );
        })}
      </div>

      {/* 2 · 需要关注 (hero): pending pin + done roll */}
      <div className={styles.laneH}>
        <h2>{t.attn}</h2>
        <span className={styles.cnt}>{pending.length} {t.pending} · {recent.length} {t.done}</span>
      </div>

      {pending[0] ? (
        <div className={styles.pin}>
          <div className={styles.pinRow}>
            <span className={styles.pinIcon} aria-hidden>{pending[0].icon}</span>
            <span className={styles.pinAgent}>{pending[0].agentLabel}</span>
            <span className={styles.pinState}>⚠ {t.pending}</span>
          </div>
          {/* Content first: title reads full-width; the gates sit small on the right (商家建议-row style). */}
          <div className={styles.pinBody}>
            <div className={styles.pinTitle}>{pending[0].title}</div>
            <div className={styles.gateRow}>
              {pending[0].controls.includes('approve') && (
                <button type="button" className={`${styles.gateSm} ${styles.gateSmPrimary}`} onClick={() => act(pending[0], 'approve')}>{t.approve}</button>
              )}
              {pending[0].controls.includes('reject') && (
                <button type="button" className={styles.gateSm} onClick={() => act(pending[0], 'reject')}>{t.reject}</button>
              )}
            </div>
          </div>
          <div className={styles.pinFoot}>
            <button type="button" className={styles.gateSm} onClick={() => setSheetRunId(pending[0].runId)}>{t.view}</button>
            {pending.length > 1 ? (
              <button type="button" className={styles.moreBtn} aria-expanded={showAllPending} onClick={() => setShowAllPending((v) => !v)}>
                {showAllPending ? `${t.less} ▴` : `${t.more(pending.length - 1)} ▾`}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {showAllPending && pending.length > 1 ? (
        <div className={styles.miniPins} role="group" aria-label={t.pending}>
          {pending.slice(1).map((a) => (
            <div key={a.id} className={styles.miniPin}>
              <button type="button" className={styles.miniPinFace} onClick={() => setSheetRunId(a.runId)}>
                <span aria-hidden>{a.icon}</span>
                <span className={styles.miniPinTitle}>{a.title}</span>
              </button>
              {a.controls.includes('approve') && (
                <button type="button" className={`${styles.gateSm} ${styles.gateSmPrimary}`} onClick={() => act(a, 'approve')}>{t.approve}</button>
              )}
              {a.controls.includes('reject') && (
                <button type="button" className={styles.gateSm} onClick={() => act(a, 'reject')}>{t.reject}</button>
              )}
            </div>
          ))}
        </div>
      ) : null}

      <div className={styles.laneH} style={{ marginTop: 'var(--space-3)' }}>
        <h2 className={styles.subH}>{t.recent}</h2>
        {/* 查看全部 needs a full-history route (backlog); omitted until backed rather than shown inert. */}
      </div>

      {loading && !data ? (
        <div className={styles.calm}>{t.loading}</div>
      ) : err('actions') ? (
        <div className={styles.calm}><b>{t.errActions}</b></div>
      ) : recent.length === 0 && pending.length === 0 ? (
        <div className={styles.calm}><b>{t.calm}</b><div>{t.calmBody}</div></div>
      ) : (
        <div className={styles.strip} role="group" aria-label={t.recent}>
          {recent.map((r) => (
            // The face → tap opens the reasoning drill-down (推理链路 + 上下游 lineage).
            <button type="button" key={r.id} className={styles.acard} onClick={() => setSheetRunId(r.runId)}>
              <div className={styles.arow}>
                <span className={styles.arowIcon} aria-hidden>{r.icon}</span>
                <span className={styles.aname}>{r.agentLabel}</span>
                <span className={styles.chip}>✓ {t.done}</span>
              </div>
              <div className={styles.cardTitle}>{r.title}</div>
              <div className={styles.cardFoot}>
                <span className={styles.cardT}>{hhmm(r.createdAt, locale)}</span>
                <span className={styles.cardGo}>{t.reason}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 3 · 今日 · 技师 roll — the single calendar entry */}
      <div className={styles.laneH}>
        <h2>{t.techs}</h2>
        <Link className={styles.more} href={FULL_CALENDAR_PATH}>{t.fullCal}</Link>
      </div>
      {loading && !data ? (
        <div className={styles.calm}>{t.loading}</div>
      ) : err('technicians') ? (
        <div className={styles.calm}><b>{t.errTechs}</b></div>
      ) : technicians.length === 0 ? (
        <div className={styles.calm}>{t.noTechs}</div>
      ) : (
        <div className={styles.techRoll} role="group" aria-label={t.techs}>
          {technicians.map((tech) => (
            <Link key={tech.id} href={FULL_CALENDAR_PATH} className={`${styles.tcard} ${tech.state === 'off' ? styles.tcardOff : ''}`} aria-label={`${tech.name} · ${t[tech.state]} · ${techLabelText(tech.label)}`}>
              <div className={styles.trow}>
                <span className={styles.tav} aria-hidden>{tech.initials}</span>
                <span className={styles.tnm}>{tech.name}</span>
                <span className={`${styles.tstate} ${techStateClass[tech.state]}`}>{t[tech.state]}</span>
              </div>
              <div className={styles.tnext}>{techLabelText(tech.label)}</div>
              {tech.load > 0 ? <div className={styles.tload}>{t.techLoad(tech.load)}</div> : null}
            </Link>
          ))}
        </div>
      )}

      <AgentRunSheet
        open={sheetRunId !== null}
        runId={sheetRunId}
        onClose={() => setSheetRunId(null)}
        onActionsChanged={load}
      />
    </div>
  );
}
