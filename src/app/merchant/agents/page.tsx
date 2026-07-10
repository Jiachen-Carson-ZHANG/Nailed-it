'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { listAgentsAction, listAgentRunsAction, triggerAgentRoundAction } from '@/lib/actions/agent-actions';
import { getMerchantAgentRunPath } from '@/domain/session';
import { useLanguage } from '@/i18n/context';
import type { AppLanguage } from '@/i18n/types';
import type { Agent, AgentRole, AgentRunView, RunStatus, TriggerSource } from '@/domain/agents';

const agentsCopy = {
  'zh-CN': {
    eyebrow: 'Nailed AI · 运营团队',
    title: '运营 Agent 团队',
    body: 'AI 团队按三条业务线运转：数据收集 → 商业决策 → 动作，动作效果由监测回流。',
    teamTitle: '团队成员',
    runsTitle: '最近运行',
    runRound: '运行一轮',
    runningRound: '运行中…',
    runConfirm: '运行一轮会调用模型并产生少量费用，确认运行？',
    emptyTitle: '暂无运行记录',
    emptyBody: '运营团队运行后，这里会显示每次运行的思考链与动作。',
    loading: '正在加载…',
    planned: '规划中',
    plannedBooking: '预约全程跟踪 Bot · 满意度调研 → 技师月报 / 补偿折扣券',
    showAllRuns: (n: number) => `显示全部 ${n} 条运行记录`,
    collapseRuns: '收起',
    role: { lead: '主控', analyst: '分析', planner: '决策', operator: '执行', reviewer: '监测' } as Record<AgentRole, string>,
    status: { running: '运行中', completed: '完成', failed: '失败', awaiting_approval: '待审批' } as Record<RunStatus, string>,
    trigger: { manual: '手动', event: '事件', schedule: '定时' } as Record<TriggerSource, string>,
    actionsN: (n: number) => `${n} 个动作`,
  },
  en: {
    eyebrow: 'Nailed AI · Agent team',
    title: 'Operations agent team',
    body: 'Three business lanes: data collection → business decision → action, with monitoring feeding back.',
    teamTitle: 'Team',
    runsTitle: 'Recent runs',
    runRound: 'Run a round',
    runningRound: 'Running…',
    runConfirm: 'Running a round calls the model (small cost). Proceed?',
    emptyTitle: 'No runs yet',
    emptyBody: 'Once the team runs, each run’s thinking chain and actions show here.',
    loading: 'Loading…',
    planned: 'Planned',
    plannedBooking: 'Booking-journey bot · satisfaction survey → tech monthly report / compensation coupon',
    showAllRuns: (n: number) => `Show all ${n} runs`,
    collapseRuns: 'Collapse',
    role: { lead: 'Lead', analyst: 'Analyst', planner: 'Planner', operator: 'Operator', reviewer: 'Reviewer' } as Record<AgentRole, string>,
    status: { running: 'Running', completed: 'Done', failed: 'Failed', awaiting_approval: 'Pending' } as Record<RunStatus, string>,
    trigger: { manual: 'Manual', event: 'Event', schedule: 'Schedule' } as Record<TriggerSource, string>,
    actionsN: (n: number) => `${n} action${n === 1 ? '' : 's'}`,
  },
} satisfies Record<AppLanguage, Record<string, unknown>>;

/** The PM architecture (商家运营 Multi-Agent 画板): three business lanes, each 数据收集 → 商业决策 → 动作,
 *  with 监测 feeding back. The team renders in THIS structure — not a flat card grid. */
/** 最近运行 shows the latest round's worth by default — the full history sits behind a toggle. */
const RUNS_PREVIEW = 9;

const TEAM_LANES: ReadonlyArray<{
  key: 'style' | 'customer' | 'booking';
  name: { 'zh-CN': string; en: string };
  stages: ReadonlyArray<{ label: { 'zh-CN': string; en: string }; slugs: readonly string[] }>;
  planned?: boolean;
}> = [
  {
    key: 'style',
    name: { 'zh-CN': '款式运营', en: 'Style ops' },
    stages: [
      { label: { 'zh-CN': '数据收集', en: 'Collect' }, slugs: ['trend', 'insight'] },
      { label: { 'zh-CN': '商业决策', en: 'Decide' }, slugs: ['decision'] },
      { label: { 'zh-CN': '动作', en: 'Act' }, slugs: ['ad', 'coupon', 'catalog'] },
      { label: { 'zh-CN': '监测', en: 'Monitor' }, slugs: ['monitor'] },
    ],
  },
  {
    key: 'customer',
    name: { 'zh-CN': '用户运营', en: 'Customer ops' },
    stages: [
      { label: { 'zh-CN': '匹配 → 召回私信', en: 'Match → recall message' }, slugs: ['customer_ops'] },
    ],
  },
  {
    key: 'booking',
    name: { 'zh-CN': '预约运营', en: 'Booking ops' },
    stages: [],
    planned: true,
  },
];

function fmtTime(iso: string, language: AppLanguage): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(language === 'zh-CN' ? 'zh-CN' : 'en-GB', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MerchantAgentsPage() {
  const { language } = useLanguage();
  const copy = agentsCopy[language];
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runs, setRuns] = useState<AgentRunView[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [showAllRuns, setShowAllRuns] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([listAgentsAction(), listAgentRunsAction()])
      .then(([a, r]) => {
        if (!active) return;
        setAgents(a);
        setRuns(r);
      })
      .catch(() => {/* leave empty */})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleRun() {
    if (triggering || !window.confirm(copy.runConfirm)) return;
    setTriggering(true);
    const res = await triggerAgentRoundAction();
    if (!res.ok) {
      window.alert(res.error ?? 'Failed to start');
      setTriggering(false);
      return;
    }
    // The Python service writes runs/actions to Supabase as it goes → poll to show running→completed
    // live. Stop after ~90s (a round is ~1–2 min; data persists if it's still finishing).
    let polls = 0;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      polls += 1;
      try {
        setRuns(await listAgentRunsAction());
      } catch {/* keep polling */}
      if (polls >= 30) {
        if (pollRef.current) clearInterval(pollRef.current);
        setTriggering(false);
      }
    }, 3000);
  }

  return (
    <MobileLayout role="merchant" title="Nailed-it">
      <section className="profile-hero">
        <p className="section-eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p className="section-copy">{copy.body}</p>
      </section>

      {loading ? (
        <LoadingState title={copy.loading} body="" />
      ) : (
        <>
          <section className="detail-surface" aria-labelledby="agents-team-title">
            <div className="detail-surface-header">
              <h2 id="agents-team-title">{copy.teamTitle}</h2>
              <span className="insights-badge">Nailed AI</span>
            </div>
            {(() => {
              const bySlug = new Map(agents.map((a) => [a.slug, a]));
              // Presence (Multica pattern): tie 团队成员 to 最近运行 — live dot + the agent's last outcome.
              const card = (slug: string) => {
                const a = bySlug.get(slug as Agent['slug']);
                if (!a) return null;
                const mine = runs.filter((r) => r.agentSlug === a.slug);
                const isRunning = mine.some((r) => r.status === 'running');
                const last = mine[0]; // runs are newest-first
                return (
                  <div key={a.slug} className="agent-card">
                    <p className="agent-card-name">
                      <span className={`agent-presence-dot${isRunning ? ' agent-presence-dot--running' : ''}`} aria-hidden />
                      {a.name}
                    </p>
                    <span className={`agent-role-chip agent-role-${a.role}`}>{copy.role[a.role]}</span>
                    {last ? (
                      <p className="agent-card-lastrun">
                        <span className={last.status === 'failed' ? 'bad' : 'ok'}>{copy.status[last.status]}</span>
                        {' · '}{fmtTime(last.startedAt, language)}
                      </p>
                    ) : null}
                  </div>
                );
              };
              return (
                <>
                  {/* Orchestrator sits above the lanes — it dispatches every targeted run. */}
                  {bySlug.has('orchestrator') ? <div className="agent-lane-orchestrator">{card('orchestrator')}</div> : null}
                  {TEAM_LANES.map((lane) => (
                    <section key={lane.key} className={`agent-lane agent-lane-${lane.key}`} aria-label={lane.name[language]}>
                      <p className="agent-lane-name">
                        {lane.name[language]}
                        {lane.planned ? <span className="agent-lane-planned">{copy.planned}</span> : null}
                      </p>
                      {lane.planned ? (
                        <p className="agent-lane-planned-copy">{copy.plannedBooking}</p>
                      ) : (
                        lane.stages.map((stage, si) => (
                          <div key={stage.label.en} className="agent-stage">
                            <p className="agent-stage-label">{si > 0 ? '↓ ' : ''}{stage.label[language]}</p>
                            <div className="agent-stage-cards">{stage.slugs.map(card)}</div>
                          </div>
                        ))
                      )}
                    </section>
                  ))}
                </>
              );
            })()}
          </section>

          <section className="detail-surface" aria-labelledby="agents-runs-title">
            <div className="detail-surface-header">
              <h2 id="agents-runs-title">{copy.runsTitle}</h2>
              <button
                type="button"
                className="button button-primary button-compact"
                disabled={triggering}
                onClick={() => void handleRun()}
              >
                {triggering ? copy.runningRound : copy.runRound}
              </button>
            </div>
            {runs.length === 0 ? (
              <EmptyState title={copy.emptyTitle} body={copy.emptyBody} />
            ) : (
              <ul className="agent-run-list">
                {(showAllRuns ? runs : runs.slice(0, RUNS_PREVIEW)).map((run) => (
                  <li key={run.id}>
                    <Link className="agent-run-row" href={getMerchantAgentRunPath(run.id)}>
                      <div className="agent-run-main">
                        <span className="agent-run-name">{run.agentName}</span>
                        <span className={`agent-run-status agent-run-status-${run.status}`}>
                          {copy.status[run.status]}
                        </span>
                      </div>
                      <div className="agent-run-meta">
                        <span>{copy.trigger[run.triggerSource]}</span>
                        <span>·</span>
                        <span>{fmtTime(run.startedAt, language)}</span>
                        {run.actions.length > 0 ? (
                          <>
                            <span>·</span>
                            <span className="agent-run-actions-count">{copy.actionsN(run.actions.length)}</span>
                          </>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {runs.length > RUNS_PREVIEW ? (
              <button type="button" className="button button-secondary button-block agent-runs-toggle" onClick={() => setShowAllRuns((v) => !v)}>
                {showAllRuns ? copy.collapseRuns : copy.showAllRuns(runs.length)}
              </button>
            ) : null}
          </section>
        </>
      )}
    </MobileLayout>
  );
}
