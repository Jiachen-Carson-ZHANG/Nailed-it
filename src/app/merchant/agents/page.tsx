'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { EmptyState } from '@/components/ui/EmptyState';
import { listAgentsAction, listAgentRunsAction } from '@/lib/actions/agent-actions';
import { getMerchantAgentRunPath } from '@/domain/session';
import { useLanguage } from '@/i18n/context';
import type { AppLanguage } from '@/i18n/types';
import type { Agent, AgentRole, AgentRunView, RunStatus, TriggerSource } from '@/domain/agents';

const agentsCopy = {
  'zh-CN': {
    eyebrow: 'Nailed AI · 运营团队',
    title: '运营 Agent 团队',
    body: 'AI 团队自动分析、决策、执行并复盘，闭合 B→C 回路。',
    loop: '闭环：数分 → 决策 → 执行（投广 / 团购 / 上下架 / 用户运营）→ 监测',
    teamTitle: '团队成员',
    runsTitle: '最近运行',
    emptyTitle: '暂无运行记录',
    emptyBody: '运营团队运行后，这里会显示每次运行的思考链与动作。',
    loading: '正在加载…',
    role: { lead: '主控', analyst: '分析', planner: '决策', operator: '执行', reviewer: '监测' } as Record<AgentRole, string>,
    status: { running: '运行中', completed: '完成', failed: '失败', awaiting_approval: '待审批' } as Record<RunStatus, string>,
    trigger: { manual: '手动', event: '事件', schedule: '定时' } as Record<TriggerSource, string>,
    actionsN: (n: number) => `${n} 个动作`,
  },
  en: {
    eyebrow: 'Nailed AI · Agent team',
    title: 'Operations agent team',
    body: 'The AI team analyzes, decides, acts, and reviews automatically — a closed B→C loop.',
    loop: 'Loop: Insight → Decision → Act (ad / coupon / catalog / customer-ops) → Monitor',
    teamTitle: 'Team',
    runsTitle: 'Recent runs',
    emptyTitle: 'No runs yet',
    emptyBody: 'Once the team runs, each run’s thinking chain and actions show here.',
    loading: 'Loading…',
    role: { lead: 'Lead', analyst: 'Analyst', planner: 'Planner', operator: 'Operator', reviewer: 'Reviewer' } as Record<AgentRole, string>,
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

export default function MerchantAgentsPage() {
  const { language } = useLanguage();
  const copy = agentsCopy[language];
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
    return () => {
      active = false;
    };
  }, []);

  return (
    <MobileLayout role="merchant" title="Nailed-it">
      <section className="profile-hero">
        <p className="section-eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p className="section-copy">{copy.body}</p>
        <p className="agent-loop-caption">{copy.loop}</p>
      </section>

      {loading ? (
        <p className="helper-copy">{copy.loading}</p>
      ) : (
        <>
          <section className="detail-surface" aria-labelledby="agents-team-title">
            <div className="detail-surface-header">
              <h2 id="agents-team-title">{copy.teamTitle}</h2>
              <span className="insights-badge">Nailed AI</span>
            </div>
            <div className="agent-team-grid">
              {agents.map((a) => (
                <div key={a.slug} className="agent-card">
                  <p className="agent-card-name">{a.name}</p>
                  <span className={`agent-role-chip agent-role-${a.role}`}>{copy.role[a.role]}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="detail-surface" aria-labelledby="agents-runs-title">
            <div className="detail-surface-header">
              <h2 id="agents-runs-title">{copy.runsTitle}</h2>
            </div>
            {runs.length === 0 ? (
              <EmptyState title={copy.emptyTitle} body={copy.emptyBody} />
            ) : (
              <ul className="agent-run-list">
                {runs.map((run) => (
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
          </section>
        </>
      )}
    </MobileLayout>
  );
}
