'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { approveAgentActionAction, rejectAgentActionAction } from '@/lib/actions/agent-actions';
import { getMerchantTodayHomeAction } from '@/lib/actions/merchant-home-actions';
import type { HomeActionView, TechnicianLabel, TodayHomeData } from '@/domain/merchant-home';
import { useLanguage } from '@/i18n/context';
import { AgentRunSheet } from './AgentRunSheet';
import styles from './TodayHome.module.css';

// Merchant 今日 home (agent-first) per DESIGN.md → "Merchant Agent Home". Rendered at the tab-1 route
// /merchant/calendar; the full calendar lives at /merchant/calendar/schedule (opened from the tech roll).
// Data = one read model (getMerchantTodayHomeAction, ADR-0011) with per-field error isolation. Controls
// are backend-honest: a proposed draft_upload → 批准/拒绝; everything else → 查看 only.

const FULL_CALENDAR_PATH = '/merchant/calendar/schedule';
const AGENTS_PATH = '/merchant/agents';

/** Demo stat strip — fixed mock values with navigation targets (not compute-on-read). */
const STAT_STRIP_MOCK = [
  { value: '¥27,308', delta: '+3%', labelKey: 'revenue' as const, href: '/merchant/messages/ops?range=week' },
  { value: '12', labelKey: 'orders' as const, href: FULL_CALENDAR_PATH },
  { valueKey: 'hotElementValue' as const, labelKey: 'hotElement' as const, href: '/merchant/styles' },
] as const;

const copy = {
  'zh-CN': {
    title: '摘要',
    revenue: '查看周报', orders: '查看日历', hotElement: '查看款式', hotElementValue: '夏季清透感',
    aiTeamCta: '🤖AI 团队',
    attn: '需要关注', recent: '最近完成',
    approve: '批准', reject: '拒绝', view: '查看', pending: '待你确认', done: '已执行', reason: '查看推理 →',
    techs: '美甲师管理', fullCal: '完整日历 →',
    loading: '加载中…', calm: '今日无新动作', calmBody: 'AI 团队在后台监测中，需要你决定的会钉在这里。',
    errActions: '最近动作加载失败 · 重试', errStats: '数据暂不可用', errTechs: '排班加载失败 · 重试',
    noTechs: '今日无排班', busy: '忙碌', free: '空闲', off: '下班', more: (n: number) => `还有 ${n} 条待确认 →`,
    techLoad: (n: number) => `今日 ${n} 单`,
    tServing: (s: string) => `接待中 · ${s}`, tNext: (time: string, s: string) => `下一场 ${time} · ${s}`,
    tDone: '今日已完成', tIdle: '当前空闲，可插单', tOff: '今日未排班',
  },
  en: {
    title: 'Summary',
    revenue: 'View report', orders: 'View calendar', hotElement: 'View styles', hotElementValue: 'Summer sheer look',
    aiTeamCta: '🤖AI 团队',
    attn: 'Needs you', recent: 'Recently done',
    approve: 'Approve', reject: 'Reject', view: 'View', pending: 'Awaiting you', done: 'Done', reason: 'View reasoning →',
    techs: 'Nail tech management', fullCal: 'Full calendar →',
    loading: 'Loading…', calm: 'Nothing new today', calmBody: 'The AI team is monitoring; anything needing your call will be pinned here.',
    errActions: 'Failed to load actions · retry', errStats: 'Data unavailable', errTechs: 'Failed to load schedule · retry',
    noTechs: 'No shifts today', busy: 'Busy', free: 'Open', off: 'Off', more: (n: number) => `${n} more to confirm →`,
    techLoad: (n: number) => `${n} today`,
    tServing: (s: string) => `With a client · ${s}`, tNext: (time: string, s: string) => `Next ${time} · ${s}`,
    tDone: 'Done for today', tIdle: 'Free now', tOff: 'Not scheduled today',
  },
} as const;

const techStateClass: Record<string, string> = {
  busy: styles.tstateBusy,
  free: styles.tstateFree,
  off: styles.tstateOff,
};

function hhmm(iso: string, locale: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
}

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
  const [sheetRunId, setSheetRunId] = useState<string | null>(null); // open reasoning drill-down (Phase 3)

  const load = useCallback(() => {
    setLoading(true);
    // Never an infinite spinner (DESIGN.md interaction-state rule): if the read model doesn't resolve,
    // fall back to the error state instead of hanging forever. The reads now run in one parallel batch
    // (~1–2s warm); the headroom is for a cold dev first-load, where Next compiles the route + server
    // action on demand (~10s). Prod is precompiled and never approaches this.
    const fallback: TodayHomeData = { stats: null, pending: [], recent: [], technicians: [], agents: [], errors: ['stats', 'actions', 'technicians'] };
    const timeout = new Promise<TodayHomeData>((resolve) => setTimeout(() => resolve(fallback), 15000));
    Promise.race([getMerchantTodayHomeAction(), timeout])
      .then((d) => setData(d))
      .catch(() => setData(fallback))
      .finally(() => setLoading(false));
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
        <h1>{t.title}</h1>
        <Link className={styles.titleCta} href={AGENTS_PATH}>{t.aiTeamCta}</Link>
      </div>
      <div className={styles.statStrip}>
        {STAT_STRIP_MOCK.map((stat) => {
          const value = 'valueKey' in stat ? t[stat.valueKey] : stat.value;
          const label = t[stat.labelKey];
          return (
            <Link key={stat.href} href={stat.href} className={styles.stat} aria-label={`${value} · ${label}`}>
              <div className={styles.statN}>
                {value}
                {'delta' in stat ? <span className={styles.statUp}>{stat.delta}</span> : null}
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
          <div className={styles.pinTitle}>{pending[0].title}</div>
          <div className={styles.ctl}>
            {pending[0].controls.includes('approve') && (
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => act(pending[0], 'approve')}>{t.approve}</button>
            )}
            {pending[0].controls.includes('reject') && (
              <button type="button" className={styles.btn} onClick={() => act(pending[0], 'reject')}>{t.reject}</button>
            )}
            <button type="button" className={`${styles.btn} ${styles.btnFixed}`} onClick={() => setSheetRunId(pending[0].runId)}>{t.view}</button>
          </div>
          {pending.length > 1 ? <div className={styles.cardT} style={{ marginTop: 8 }}>{t.more(pending.length - 1)}</div> : null}
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

      <AgentRunSheet open={sheetRunId !== null} runId={sheetRunId} onClose={() => setSheetRunId(null)} />
    </div>
  );
}
