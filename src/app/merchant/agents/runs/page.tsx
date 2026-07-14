'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { listAgentRunsAction } from '@/lib/actions/agent-actions';
import { getMerchantAgentRunPath } from '@/domain/session';
import { useLanguage } from '@/i18n/context';
import type { AppLanguage } from '@/i18n/types';
import { FULL_ROUND_MIN_RUNS } from '@/domain/agents';
import type { AgentRunView, RunStatus, TriggerSource } from '@/domain/agents';

const copy = {
  'zh-CN': {
    eyebrow: 'Nailed AI · 运行审计',
    title: '运行审计',
    body: '按「轮」分组的完整运行记录。一轮 = 主控一次调度产生的整条链路；点开任一 Agent 看它的思考链。',
    back: '← 返回运营团队',
    roundN: (n: number) => `第 ${n} 轮`,
    roundMeta: (agents: number, actions: number) => `${agents} 个 Agent · ${actions} 个动作`,
    emptyTitle: '暂无运行记录',
    emptyBody: '运营团队运行后，这里会按轮显示每次运行的思考链与动作。',
    loading: '正在加载…',
    status: { running: '运行中', completed: '完成', failed: '失败', awaiting_approval: '待审批' } as Record<RunStatus, string>,
    trigger: { manual: '手动', event: '事件', schedule: '定时' } as Record<TriggerSource, string>,
  },
  en: {
    eyebrow: 'Nailed AI · Run audit',
    title: 'Run audit',
    body: 'The full record grouped by round. A round = the whole chain one dispatch produced; tap any agent for its thinking chain.',
    back: '← Back to agent team',
    roundN: (n: number) => `Round ${n}`,
    roundMeta: (agents: number, actions: number) => `${agents} agents · ${actions} actions`,
    emptyTitle: 'No runs yet',
    emptyBody: 'Once the team runs, each round’s thinking chains and actions show here.',
    loading: 'Loading…',
    status: { running: 'Running', completed: 'Done', failed: 'Failed', awaiting_approval: 'Pending' } as Record<RunStatus, string>,
    trigger: { manual: 'Manual', event: 'Event', schedule: 'Schedule' } as Record<TriggerSource, string>,
  },
} satisfies Record<AppLanguage, Record<string, unknown>>;

function fmtTime(iso: string, language: AppLanguage): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(language === 'zh-CN' ? 'zh-CN' : 'en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

type Round = { rootId: string; startedAt: string; runs: AgentRunView[] };

/** Group flat runs into rounds by the dispatch tree: each run's round is its top ancestor via
 *  parentRunId (the orchestrator run that opened the round). Read-side only — no schema dependency. */
function groupIntoRounds(runs: AgentRunView[]): Round[] {
  const byId = new Map(runs.map((r) => [r.id, r]));
  const rootOf = (r: AgentRunView): string => {
    let cur = r;
    const seen = new Set<string>();
    while (cur.parentRunId && byId.has(cur.parentRunId) && !seen.has(cur.id)) {
      seen.add(cur.id);
      cur = byId.get(cur.parentRunId)!;
    }
    return cur.id;
  };
  const buckets = new Map<string, AgentRunView[]>();
  for (const r of runs) {
    const key = rootOf(r);
    (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(r);
  }
  return [...buckets.entries()]
    .map(([rootId, group]) => {
      // dispatch order within the round (oldest first) so it reads top-to-bottom as it happened
      const ordered = [...group].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
      return { rootId, startedAt: ordered[0]?.startedAt ?? '', runs: ordered };
    })
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)); // newest round first
}

export default function MerchantAgentRunsPage() {
  const { language } = useLanguage();
  const c = copy[language];
  const [runs, setRuns] = useState<AgentRunView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listAgentRunsAction()
      .then((r) => active && setRuns(r))
      .catch(() => {/* leave empty */})
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  // Demo curation: the audit shows FULL rounds (≥4 runs). Stray anchor runs — kept in the DB only
  // because campaigns/deals/memories cite them as evidence — would render as confusing partial "rounds" (full rounds run 10-11 agents).
  const rounds = useMemo(() => groupIntoRounds(runs).filter((r) => r.runs.length >= FULL_ROUND_MIN_RUNS), [runs]);

  return (
    <MobileLayout role="merchant" title="Nailed-it">
      <section className="profile-hero">
        <Link href="/merchant/agents" className="agent-back-link">{c.back as string}</Link>
        <p className="section-eyebrow">{c.eyebrow as string}</p>
        <h1>{c.title as string}</h1>
        <p className="section-copy">{c.body as string}</p>
      </section>

      {loading ? (
        <LoadingState title={c.loading as string} body="" />
      ) : rounds.length === 0 ? (
        <EmptyState title={c.emptyTitle as string} body={c.emptyBody as string} />
      ) : (
        <div className="agent-rounds">
          {rounds.map((round, idx) => {
            const roundN = (c.roundN as (n: number) => string)(rounds.length - idx);
            const actionCount = round.runs.reduce((s, r) => s + r.actions.length, 0);
            const anyRunning = round.runs.some((r) => r.status === 'running');
            const anyFailed = round.runs.some((r) => r.status === 'failed');
            const roundStatus: RunStatus = anyRunning ? 'running' : anyFailed ? 'failed' : 'completed';
            return (
              <section key={round.rootId} className="detail-surface agent-round">
                <div className="agent-round-head">
                  <div className="agent-round-title">
                    <span className="agent-round-n">{roundN}</span>
                    <span className={`agent-run-status agent-run-status-${roundStatus}`}>{c.status[roundStatus]}</span>
                  </div>
                  <span className="agent-round-meta">
                    {fmtTime(round.startedAt, language)} · {(c.roundMeta as (a: number, b: number) => string)(round.runs.length, actionCount)}
                  </span>
                </div>
                <ul className="agent-run-list">
                  {round.runs.map((run) => (
                    <li key={run.id}>
                      <Link className="agent-run-row agent-run-row--compact" href={getMerchantAgentRunPath(run.id)}>
                        <div className="agent-run-main">
                          <span className="agent-run-name">
                            <span className={`agent-run-roledot agent-run-roledot-${run.agentRole}`} aria-hidden />
                            {run.agentName}
                          </span>
                          <span className={`agent-run-status agent-run-status-${run.status}`}>{c.status[run.status]}</span>
                        </div>
                        <div className="agent-run-meta">
                          <span>{c.trigger[run.triggerSource]}</span>
                          <span>·</span>
                          <span>{fmtTime(run.startedAt, language)}</span>
                          {run.actions.length > 0 ? <span className="agent-run-actions-count">· {run.actions.length}</span> : null}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </MobileLayout>
  );
}
