'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { listAgentsAction, listAgentRunsAction } from '@/lib/actions/agent-actions';
import { getMerchantAgentRunPath } from '@/domain/session';
import { useLanguage } from '@/i18n/context';
import type { AppLanguage } from '@/i18n/types';
import {
  groupRunsIntoRounds,
  FULL_ROUND_MIN_RUNS,
  type Agent,
  type AgentRunView,
  type RunStatus,
  type TriggerSource,
} from '@/domain/agents';

const copy = {
  'zh-CN': {
    back: '← 返回运营团队',
    eyebrow: 'Nailed AI · 单 Agent 历程',
    subtitle: (n: number) => `这个 Agent 参与过的全部 ${n} 轮（最新在上）`,
    emptyTitle: '这个 Agent 还没有运行记录',
    emptyBody: '运营团队跑过一轮后，它经历的每一轮都会显示在这里。',
    loading: '正在加载…',
    roundN: (n: number) => `第 ${n} 轮`,
    status: { running: '运行中', completed: '完成', failed: '失败', awaiting_approval: '待审批' } as Record<RunStatus, string>,
    trigger: { manual: '手动', event: '事件', schedule: '定时' } as Record<TriggerSource, string>,
    actionsN: (n: number) => `${n} 个动作`,
  },
  en: {
    back: '← Back to agent team',
    eyebrow: 'Nailed AI · Single-agent history',
    subtitle: (n: number) => `All ${n} rounds this agent ran (newest first)`,
    emptyTitle: 'No runs for this agent yet',
    emptyBody: 'Once the team runs a round, every round this agent joins shows here.',
    loading: 'Loading…',
    roundN: (n: number) => `Round ${n}`,
    status: { running: 'Running', completed: 'Done', failed: 'Failed', awaiting_approval: 'Pending' } as Record<RunStatus, string>,
    trigger: { manual: 'Manual', event: 'Event', schedule: 'Schedule' } as Record<TriggerSource, string>,
    actionsN: (n: number) => `${n} action${n === 1 ? '' : 's'}`,
  },
} satisfies Record<AppLanguage, Record<string, unknown>>;

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

export default function AgentHistoryPage() {
  const { language } = useLanguage();
  const c = copy[language];
  const params = useParams();
  const slug = String((params as { slug?: string })?.slug ?? '');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runs, setRuns] = useState<AgentRunView[]>([]);
  const [loading, setLoading] = useState(true);

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
    return () => { active = false; };
  }, []);

  const agent = agents.find((a) => a.slug === slug);

  // Round ordinal (newest = highest) shared with the rest of the panel, so a run reads "第 N 轮".
  const ordinalById = useMemo(() => {
    const rounds = groupRunsIntoRounds(runs).filter((r) => r.length >= FULL_ROUND_MIN_RUNS);
    const total = rounds.length;
    const m = new Map<string, number>();
    rounds.forEach((round, idx) => {
      const ord = total - idx;
      for (const r of round) m.set(r.id, ord);
    });
    return m;
  }, [runs]);

  // Every run this single agent ran, newest first — one row per round it joined.
  const mine = useMemo(
    () => runs.filter((r) => r.agentSlug === slug).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)),
    [runs, slug],
  );

  return (
    <MobileLayout role="merchant" title="Nailed-it">
      <section className="profile-hero">
        <Link href="/merchant/agents" className="agent-back-link">{c.back as string}</Link>
        <p className="section-eyebrow">{c.eyebrow as string}</p>
        <h1>{agent?.name ?? slug}</h1>
        <p className="section-copy">{(c.subtitle as (n: number) => string)(mine.length)}</p>
      </section>

      {loading ? (
        <LoadingState title={c.loading as string} body="" />
      ) : mine.length === 0 ? (
        <EmptyState title={c.emptyTitle as string} body={c.emptyBody as string} />
      ) : (
        <section className="detail-surface">
          <ul className="agent-run-list">
            {mine.map((run) => {
              const ord = ordinalById.get(run.id);
              return (
                <li key={run.id}>
                  <Link className="agent-run-row" href={getMerchantAgentRunPath(run.id)}>
                    <div className="agent-run-main">
                      <span className="agent-run-name">
                        {ord ? (c.roundN as (n: number) => string)(ord) : fmtTime(run.startedAt, language)}
                      </span>
                      <span className={`agent-run-status agent-run-status-${run.status}`}>{c.status[run.status]}</span>
                    </div>
                    <div className="agent-run-meta">
                      <span>{c.trigger[run.triggerSource]}</span>
                      <span>·</span>
                      <span>{fmtTime(run.startedAt, language)}</span>
                      {run.actions.length > 0 ? (
                        <span className="agent-run-actions-count">· {(c.actionsN as (n: number) => string)(run.actions.length)}</span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </MobileLayout>
  );
}
