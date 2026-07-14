'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { LoadingState } from '@/components/ui/LoadingState';
import {
  listAgentsAction,
  listAgentRunsAction,
  listTeamMemoryAction,
  getWeeklyObjectiveAction,
  triggerAgentRoundAction,
  getTeamConfigAction,
  setTeamConfigAction,
  type TeamConfig,
  type TeamMemoryView,
  type WeeklyObjectiveItem,
} from '@/lib/actions/agent-actions';
import { getMerchantAgentRunPath } from '@/domain/session';
import { useLanguage } from '@/i18n/context';
import type { AppLanguage } from '@/i18n/types';
import { groupRunsIntoRounds, FULL_ROUND_MIN_RUNS, type Agent, type AgentRole, type AgentRunView, type RunStatus, type TriggerSource } from '@/domain/agents';

const agentsCopy = {
  'zh-CN': {
    eyebrow: 'Nailed AI · 运营团队',
    back: '‹ 返回今日',
    title: '运营 Agent 团队',
    body: 'AI 团队按三条业务线运转：数据收集 → 商业决策 → 动作，动作效果由监测回流。',
    proofTitle: '闭环运行证据',
    proofAgents: '已配置 Agent',
    proofRuns: '可审计运行',
    proofMemory: '跨轮记忆',
    teamTitle: '团队成员',
    objectiveTitle: '本周经营目标',
    objectiveEmpty: '本周暂无经营计划',
    objectiveEmptyCta: '点击「生成本周经营计划」开始',
    objectiveGoal: (min: number, max: number) => `目标预约 ${min}–${max} 单`,
    objectiveDone: (n: number) => `已达成 ${n} 单`,
    objectiveStatus: { draft: '草稿', active: '投放中', paused: '已暂停', ended: '已结束', pending: '待执行' } as Record<string, string>,
    objectiveKind: { ad: '投广', coupon: '团购' } as Record<string, string>,
    roundsTitle: '最近轮次',
    roundLine: (runs: number, actions: number) => `${runs} 次运行 · ${actions} 个动作`,
    memoryEntry: '团队记忆库',
    memoryEntryBody: '监测写入的实测结论，下一轮决策会引用',
    runsEntry: '运行审计',
    runsEntryBody: '每次运行的思考链与动作',
    demoEntry: '演示控制台',
    runRound: '生成本周经营计划',
    runSubline: (freq: string) => `${freq}自动运行（定时任务）`,
    configEdit: '设置',
    configTitle: '经营目标与运行节奏',
    configGoal: '本周目标预约量',
    configGoalHint: 'AI 团队会围绕这个区间制定投广 / 团购计划，并按此衡量达成进度。',
    configGoalTo: '至',
    configGoalUnit: '单',
    configFocus: '本周经营重点（可留空）',
    configFocusHint: '一句话告诉团队本周侧重什么，决策 Agent 下一轮会参考。例：主推夏季清透款，提升周中产能。',
    configFocusPlaceholder: '例：主推夏季清透款，提升周中产能',
    configCadence: '自动运行频率',
    configCadenceHint: '团队多久自动跑一轮经营计划。你也可随时手动点「生成本周经营计划」。',
    cadenceOpts: { 1: '每天', 2: '每 2 天', 3: '每 3 天', 7: '每周', 14: '每 2 周' } as Record<number, string>,
    configWeekday: '在星期',
    configDay: (d: string) => `周${d}`,
    configSave: '保存',
    runningRound: '运行中…',
    runConfirm: '生成本周经营计划会调用模型并产生少量费用，确认运行？',
    loading: '正在加载…',
    planned: '规划中',
    plannedBooking: '预约全程跟踪 Bot · 满意度调研 → 技师月报 / 补偿折扣券',
    role: { lead: '主控', analyst: '分析', planner: '决策', operator: '执行', reviewer: '监测' } as Record<AgentRole, string>,
    status: { running: '运行中', completed: '完成', failed: '失败', awaiting_approval: '待审批' } as Record<RunStatus, string>,
    trigger: { manual: '手动', event: '事件', schedule: '定时' } as Record<TriggerSource, string>,
    actionsN: (n: number) => `${n} 个动作`,
  },
  en: {
    eyebrow: 'Nailed AI · Agent team',
    back: '‹ Back to Today',
    title: 'Operations agent team',
    body: 'Three business lanes: data collection → business decision → action, with monitoring feeding back.',
    proofTitle: 'Closed-loop proof',
    proofAgents: 'Agents',
    proofRuns: 'Auditable runs',
    proofMemory: 'Memories',
    teamTitle: 'Team',
    objectiveTitle: 'This week’s objective',
    objectiveEmpty: 'No plan yet this week',
    objectiveEmptyCta: 'Tap “Generate this week’s plan” to start',
    objectiveGoal: (min: number, max: number) => `Target ${min}–${max} bookings`,
    objectiveDone: (n: number) => `${n} booked`,
    objectiveStatus: { draft: 'Draft', active: 'Live', paused: 'Paused', ended: 'Ended', pending: 'Pending' } as Record<string, string>,
    objectiveKind: { ad: 'Ad', coupon: 'Group-buy' } as Record<string, string>,
    roundsTitle: 'Recent rounds',
    roundLine: (runs: number, actions: number) => `${runs} runs · ${actions} actions`,
    memoryEntry: 'Team memory',
    memoryEntryBody: 'Measured outcomes the next round cites',
    runsEntry: 'Run audit',
    runsEntryBody: 'Every run’s thinking chain and actions',
    demoEntry: 'Demo console',
    runRound: 'Generate this week’s plan',
    runSubline: (freq: string) => `Auto-runs ${freq.toLowerCase()} (scheduled)`,
    configEdit: 'Configure',
    configTitle: 'Goal & cadence',
    configGoal: 'This week’s booking target',
    configGoalHint: 'The AI team plans ads / group-buys around this range and measures progress against it.',
    configGoalTo: 'to',
    configGoalUnit: 'bookings',
    configFocus: 'Weekly focus (optional)',
    configFocusHint: 'One line telling the team what to prioritize; the decision agent reads it next round.',
    configFocusPlaceholder: 'e.g. push summer sheer looks, fill midweek capacity',
    configCadence: 'Auto-run frequency',
    configCadenceHint: 'How often the team auto-runs a plan. You can also tap “Generate this week’s plan” anytime.',
    cadenceOpts: { 1: 'Daily', 2: 'Every 2 days', 3: 'Every 3 days', 7: 'Weekly', 14: 'Every 2 weeks' } as Record<number, string>,
    configWeekday: 'on',
    configDay: (d: string) => `${d}`,
    configSave: 'Save',
    runningRound: 'Running…',
    runConfirm: 'Generating this week’s plan calls the model (small cost). Proceed?',
    loading: 'Loading…',
    planned: 'Planned',
    plannedBooking: 'Booking-journey bot · satisfaction survey → tech monthly report / compensation coupon',
    role: { lead: 'Lead', analyst: 'Analyst', planner: 'Planner', operator: 'Operator', reviewer: 'Reviewer' } as Record<AgentRole, string>,
    status: { running: 'Running', completed: 'Done', failed: 'Failed', awaiting_approval: 'Pending' } as Record<RunStatus, string>,
    trigger: { manual: 'Manual', event: 'Event', schedule: 'Schedule' } as Record<TriggerSource, string>,
    actionsN: (n: number) => `${n} action${n === 1 ? '' : 's'}`,
  },
} satisfies Record<AppLanguage, Record<string, unknown>>;

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

type WeeklyObjective = {
  targetMin: number;
  targetMax: number;
  measuredBookings: number;
  items: WeeklyObjectiveItem[];
};

/** Navigational evidence strip: each stat routes somewhere, the pipeline scrolls horizontally. */
function AgentProofStrip({
  language,
  agents,
  runs,
  memory,
  loading,
}: {
  language: AppLanguage;
  agents: Agent[];
  runs: AgentRunView[];
  memory: TeamMemoryView[];
  loading: boolean;
}) {
  const copy = agentsCopy[language];
  const placeholder = loading ? '…' : '—';
  const stats: Array<{ label: string; value: number | string; href: string }> = [
    { label: copy.proofAgents as string, value: agents.length || placeholder, href: '#agents-team-title' },
    { label: copy.proofRuns as string, value: runs.length || placeholder, href: '/merchant/agents/runs' },
    { label: copy.proofMemory as string, value: memory.length || placeholder, href: '/merchant/agents/memory' },
  ];
  // The stats ARE the proof (auditable counts, each a link); the old narrative + flow-chip strip
  // restated what the 团队成员 lanes already show.
  return (
    <section className="agent-proof" aria-label={copy.proofTitle as string}>
      <div className="agent-proof-stats">
        {stats.map((s) => (
          <Link key={s.label} className="agent-proof-stat agent-proof-stat--link" href={s.href}>
            <strong>{s.value}</strong>
            <span>{s.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Derived roll-up (never stored): Σ brief targets vs Σ measured bookings on the real campaigns. */
function WeeklyObjectiveCard({ language, objective, cfg }: { language: AppLanguage; objective: WeeklyObjective | null; cfg: TeamConfig }) {
  const copy = agentsCopy[language];
  const goal = copy.objectiveGoal as (min: number, max: number) => string;
  if (!objective) {
    return (
      <section className="detail-surface agent-objective">
        <div className="detail-surface-header"><h2>{copy.objectiveTitle as string}</h2></div>
        <div className="agent-objective-headline">
          <span className="agent-objective-goal">{goal(cfg.goalMin, cfg.goalMax)}</span>
        </div>
        <p className="agent-objective-empty">{copy.objectiveEmpty as string}</p>
        <p className="agent-objective-empty-cta">{copy.objectiveEmptyCta as string}</p>
      </section>
    );
  }
  const done = copy.objectiveDone as (n: number) => string;
  const kindMap = copy.objectiveKind as Record<string, string>;
  const statusMap = copy.objectiveStatus as Record<string, string>;
  // The GOAL is the merchant's setting (pref-weekly-focus); progress measures against it. The agents'
  // per-campaign targets stay on the item chips below — merchant goal ≠ agent plan.
  const goalMax = cfg.goalMax > 0 ? cfg.goalMax : objective.targetMax;
  const pct = goalMax > 0 ? Math.min(100, Math.round((objective.measuredBookings / goalMax) * 100)) : 0;
  return (
    <section className="detail-surface agent-objective">
      <div className="detail-surface-header"><h2>{copy.objectiveTitle as string}</h2></div>
      <div className="agent-objective-headline">
        <span className="agent-objective-goal">{goal(cfg.goalMin, cfg.goalMax)}</span>
        <span className="agent-objective-done">{done(objective.measuredBookings)} · {pct}%</span>
      </div>
      <div className="agent-objective-bar" aria-hidden="true">
        <span className="agent-objective-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <ul className="agent-objective-items">
        {objective.items.map((it) => (
          <li key={`${it.actionType}-${it.styleId}`} className="agent-objective-chip">
            <span className="agent-objective-chip-kind">{kindMap[it.actionType] ?? it.actionType}</span>
            <span className="agent-objective-chip-title">{it.styleTitle}</span>
            <span className="agent-objective-chip-num">{it.measuredBookings}/{it.targetMax}</span>
            <span className={`agent-objective-chip-status agent-objective-chip-status-${it.status}`}>{statusMap[it.status] ?? it.status}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function MerchantAgentsPage() {
  const { language } = useLanguage();
  const copy = agentsCopy[language];
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runs, setRuns] = useState<AgentRunView[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [memory, setMemory] = useState<TeamMemoryView[]>([]);
  const [objective, setObjective] = useState<WeeklyObjective | null>(null);
  const [cfg, setCfg] = useState<TeamConfig>({ goalMin: 8, goalMax: 16, focusText: '', cadenceEveryDays: 7, cadenceDay: '五' });
  const [cfgOpen, setCfgOpen] = useState(false);
  const [cfgSaving, setCfgSaving] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let active = true;
    void getTeamConfigAction().then((c) => active && setCfg(c)).catch(() => {});
    Promise.all([listAgentsAction(), listAgentRunsAction(), listTeamMemoryAction(), getWeeklyObjectiveAction()])
      .then(([a, r, m, o]) => {
        if (!active) return;
        setAgents(a);
        setRuns(r);
        setMemory(m);
        setObjective(o);
      })
      .catch(() => {/* leave empty */})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleRun() {
    if (triggering || !window.confirm(copy.runConfirm as string)) return;
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
        setMemory(await listTeamMemoryAction());
        setObjective(await getWeeklyObjectiveAction());
      } catch {/* keep polling */}
      if (polls >= 30) {
        if (pollRef.current) clearInterval(pollRef.current);
        setTriggering(false);
      }
    }, 3000);
  }

  return (
    <MobileLayout role="merchant" title="Nailed-it">
      <Link className="merchant-review-back" href="/merchant/calendar">{copy.back as string}</Link>
      <section className="profile-hero">
        {/* Single heading: the pink brand line IS the title (the black h1 restated it). */}
        <h1 className="agent-hero-eyebrow">{copy.eyebrow as string}</h1>
        <p className="section-copy">{copy.body as string}</p>
        <button
          type="button"
          className="button button-primary agent-run-cta"
          disabled={triggering}
          onClick={() => void handleRun()}
        >
          {triggering ? (copy.runningRound as string) : (copy.runRound as string)}
        </button>
        <p className="agent-run-subline">
          {(copy.runSubline as (d: string) => string)(
            cfg.cadenceEveryDays === 7 ? (copy.configDay as (d: string) => string)(cfg.cadenceDay).replace(/^/, language === 'zh-CN' ? '每' : 'weekly ') : (copy.cadenceOpts as Record<number, string>)[cfg.cadenceEveryDays])}
          <button type="button" className="agent-config-edit" onClick={() => setCfgOpen(true)}>{copy.configEdit as string}</button>
        </p>
      </section>

      {/* 经营目标 + 运行节奏 are merchant-owned config: saved as the merchant_preference rows the
       * decision agent already injects (pref-weekly-focus / pref-run-cadence) — editing here steers
       * the NEXT round, it isn't display-only. */}
      <BottomSheet open={cfgOpen} onClose={() => setCfgOpen(false)} title={copy.configTitle as string}>
        <div className="agent-config-form">
          <label className="agent-config-label">{copy.configGoal as string}</label>
          <p className="agent-config-hint">{copy.configGoalHint as string}</p>
          <div className="agent-config-range">
            <input type="number" min={1} max={99} value={cfg.goalMin}
              onChange={(e) => setCfg((c) => ({ ...c, goalMin: Number(e.target.value) }))} />
            <span>{copy.configGoalTo as string}</span>
            <input type="number" min={1} max={99} value={cfg.goalMax}
              onChange={(e) => setCfg((c) => ({ ...c, goalMax: Number(e.target.value) }))} />
            <span className="agent-config-unit">{copy.configGoalUnit as string}</span>
          </div>

          <label className="agent-config-label">{copy.configFocus as string}</label>
          <p className="agent-config-hint">{copy.configFocusHint as string}</p>
          <textarea rows={3} value={cfg.focusText} placeholder={copy.configFocusPlaceholder as string}
            onChange={(e) => setCfg((c) => ({ ...c, focusText: e.target.value }))} />

          <label className="agent-config-label">{copy.configCadence as string}</label>
          <p className="agent-config-hint">{copy.configCadenceHint as string}</p>
          <div className="agent-config-cadence">
            <select value={cfg.cadenceEveryDays}
              onChange={(e) => setCfg((c) => ({ ...c, cadenceEveryDays: Number(e.target.value) }))}>
              {[1, 2, 3, 7, 14].map((n) => (
                <option key={n} value={n}>{(copy.cadenceOpts as Record<number, string>)[n]}</option>
              ))}
            </select>
            {cfg.cadenceEveryDays === 7 ? (
              <>
                <span className="agent-config-inline">{copy.configWeekday as string}</span>
                <select value={cfg.cadenceDay} onChange={(e) => setCfg((c) => ({ ...c, cadenceDay: e.target.value }))}>
                  {['一', '二', '三', '四', '五', '六', '日'].map((d) => (
                    <option key={d} value={d}>{(copy.configDay as (d: string) => string)(d)}</option>
                  ))}
                </select>
              </>
            ) : null}
          </div>
          <button
            type="button"
            className="button button-primary button-block"
            disabled={cfgSaving || cfg.goalMin < 1 || cfg.goalMax < cfg.goalMin}
            onClick={() => {
              setCfgSaving(true);
              void setTeamConfigAction(cfg).finally(() => { setCfgSaving(false); setCfgOpen(false); });
            }}
          >
            {copy.configSave as string}
          </button>
        </div>
      </BottomSheet>

      <AgentProofStrip language={language} agents={agents} runs={runs} memory={memory} loading={loading} />

      {loading ? (
        <LoadingState title={copy.loading as string} body="" />
      ) : (
        <>
          <WeeklyObjectiveCard language={language} objective={objective} cfg={cfg} />

          {/* Runs grouped by ROUND (trigger + start time) — the runtime record, kept apart from the
           * static team intro below. Same domain grouping the 晚报 uses. */}
          {runs.length > 0 ? (
            <section className="detail-surface" aria-labelledby="agents-rounds-title">
              <div className="detail-surface-header">
                <h2 id="agents-rounds-title">{copy.roundsTitle as string}</h2>
              </div>
              {groupRunsIntoRounds(runs).filter((r) => r.length >= FULL_ROUND_MIN_RUNS).slice(0, 3).map((round) => {
                const head = round[0];
                // The round's trigger is the ORCHESTRATOR's (who opened it), not the last child's.
                const opener = round.find((r) => r.agentRole === 'lead') ?? round[round.length - 1];
                const actions = round.reduce((n, r) => n + r.actions.length, 0);
                const roundLine = copy.roundLine as (a: number, b: number) => string;
                return (
                  <div key={head.id} className="agent-round">
                    <p className="agent-round-head">
                      <span className="agent-round-trigger">{copy.trigger[opener.triggerSource]}</span>
                      <span>· {fmtTime(head.startedAt, language)}</span>
                      <span>· {roundLine(round.length, actions)}</span>
                    </p>
                    <ul className="agent-run-list">
                      {/* Dispatch order (oldest first): the pipeline reads 数分 → … → Monitor top-down —
                        * newest-first put Monitor 完成 above executors still 待审批, which read as broken. */}
                      {[...round].reverse().map((run) => (
                        <li key={run.id}>
                          <Link className="agent-run-row" href={getMerchantAgentRunPath(run.id)}>
                            <div className="agent-run-main">
                              <span className="agent-run-name">{run.agentName}</span>
                              <span className={`agent-run-status agent-run-status-${run.status}`}>{copy.status[run.status]}</span>
                            </div>
                            {run.actions.length > 0 ? (
                              <div className="agent-run-meta"><span className="agent-run-actions-count">{copy.actionsN(run.actions.length)}</span></div>
                            ) : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </section>
          ) : null}

          <section className="detail-surface" aria-labelledby="agents-team-title">
            <div className="detail-surface-header">
              <h2 id="agents-team-title">{copy.teamTitle as string}</h2>
              <span className="insights-badge">Nailed AI</span>
            </div>
            {(() => {
              const bySlug = new Map(agents.map((a) => [a.slug, a]));
              // Presence (Multica pattern): tie 团队成员 to 最近运行 — live dot + the agent's last outcome.
              // The card links to that agent's most recent run detail (its thinking chain).
              const card = (slug: string) => {
                const a = bySlug.get(slug as Agent['slug']);
                if (!a) return null;
                const mine = runs.filter((r) => r.agentSlug === a.slug);
                const isRunning = mine.some((r) => r.status === 'running');
                const last = mine[0]; // runs are newest-first
                // Team INTRO card: name + role + live presence only. Per-run status/time moved to the
                // 最近轮次 section — mixing timestamps from different rounds here read as chaos.
                const inner = (
                  <>
                    <p className="agent-card-name">
                      <span className={`agent-presence-dot${isRunning ? ' agent-presence-dot--running' : ''}`} aria-hidden />
                      {a.name}
                    </p>
                    <span className={`agent-role-chip agent-role-${a.role}`}>{copy.role[a.role]}</span>
                  </>
                );
                return last ? (
                  <Link key={a.slug} className="agent-card agent-card--link" href={getMerchantAgentRunPath(last.id)}>
                    {inner}
                  </Link>
                ) : (
                  <div key={a.slug} className="agent-card">{inner}</div>
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
                        {lane.planned ? <span className="agent-lane-planned">{copy.planned as string}</span> : null}
                      </p>
                      {lane.planned ? (
                        <p className="agent-lane-planned-copy">{copy.plannedBooking as string}</p>
                      ) : (
                        lane.stages.map((stage, si) => (
                          <div key={stage.label.en} className="agent-stage">
                            <p className="agent-stage-label">{si > 0 ? '↓ ' : ''}{stage.label[language]}</p>
                            <div className="agent-stage-cards agent-stage-cards--scroll">{stage.slugs.map(card)}</div>
                          </div>
                        ))
                      )}
                    </section>
                  ))}
                </>
              );
            })()}
          </section>

          {/* Entry rows to the pages we split off the main scroll — same pattern as the 款式图鉴 arrow. */}
          <nav className="agent-entry-rows" aria-label="pages">
            <Link className="agent-entry-row" href="/merchant/agents/memory">
              <span className="agent-entry-main">
                <span className="agent-entry-title">{copy.memoryEntry as string}</span>
                <span className="agent-entry-body">{copy.memoryEntryBody as string}</span>
              </span>
              <span className="agent-entry-arrow" aria-hidden="true">→</span>
            </Link>
            <Link className="agent-entry-row" href="/merchant/agents/runs">
              <span className="agent-entry-main">
                <span className="agent-entry-title">{copy.runsEntry as string}</span>
                <span className="agent-entry-body">{copy.runsEntryBody as string}</span>
              </span>
              <span className="agent-entry-arrow" aria-hidden="true">→</span>
            </Link>
          </nav>

          <Link className="agent-demo-link" href="/merchant/agents/demo">{copy.demoEntry as string} →</Link>
        </>
      )}
    </MobileLayout>
  );
}
