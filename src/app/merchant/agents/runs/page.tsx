'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { listAgentRunsAction } from '@/lib/actions/agent-actions';
import { getMerchantAgentRunPath } from '@/domain/session';
import { useLanguage } from '@/i18n/context';
import type { AppLanguage } from '@/i18n/types';
import type { AgentRunView, RunStatus, TriggerSource } from '@/domain/agents';

const copy = {
  'zh-CN': {
    eyebrow: 'Nailed AI · 运行审计',
    title: '运行审计',
    body: '每一次代理运行的完整记录：谁在什么时机被调度、结果如何、产生了哪些动作。点击查看思考链。',
    back: '← 返回运营团队',
    emptyTitle: '暂无运行记录',
    emptyBody: '运营团队运行后，这里会显示每次运行的思考链与动作。',
    loading: '正在加载…',
    status: { running: '运行中', completed: '完成', failed: '失败', awaiting_approval: '待审批' } as Record<RunStatus, string>,
    trigger: { manual: '手动', event: '事件', schedule: '定时' } as Record<TriggerSource, string>,
    actionsN: (n: number) => `${n} 个动作`,
  },
  en: {
    eyebrow: 'Nailed AI · Run audit',
    title: 'Run audit',
    body: 'The full record of every agent run: who was dispatched when, the outcome, and the actions produced. Tap to see the thinking chain.',
    back: '← Back to agent team',
    emptyTitle: 'No runs yet',
    emptyBody: 'Once the team runs, each run’s thinking chain and actions show here.',
    loading: 'Loading…',
    status: { running: 'Running', completed: 'Done', failed: 'Failed', awaiting_approval: 'Pending' } as Record<RunStatus, string>,
    trigger: { manual: 'Manual', event: 'Event', schedule: 'Schedule' } as Record<TriggerSource, string>,
    actionsN: (n: number) => `${n} action${n === 1 ? '' : 's'}`,
  },
} satisfies Record<AppLanguage, Record<string, unknown>>;

function fmtTime(iso: string, language: AppLanguage): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(language === 'zh-CN' ? 'zh-CN' : 'en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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

  return (
    <MobileLayout role="merchant" title="Nailed-it">
      <section className="profile-hero">
        <Link href="/merchant/agents" className="agent-back-link">{c.back}</Link>
        <p className="section-eyebrow">{c.eyebrow}</p>
        <h1>{c.title}</h1>
        <p className="section-copy">{c.body}</p>
      </section>

      {loading ? (
        <LoadingState title={c.loading as string} body="" />
      ) : runs.length === 0 ? (
        <EmptyState title={c.emptyTitle as string} body={c.emptyBody as string} />
      ) : (
        <section className="detail-surface">
          <ul className="agent-run-list">
            {runs.map((run) => (
              <li key={run.id}>
                <Link className="agent-run-row" href={getMerchantAgentRunPath(run.id)}>
                  <div className="agent-run-main">
                    <span className="agent-run-name">{run.agentName}</span>
                    <span className={`agent-run-status agent-run-status-${run.status}`}>{c.status[run.status]}</span>
                  </div>
                  <div className="agent-run-meta">
                    <span>{c.trigger[run.triggerSource]}</span>
                    <span>·</span>
                    <span>{fmtTime(run.startedAt, language)}</span>
                    {run.actions.length > 0 ? (
                      <>
                        <span>·</span>
                        <span className="agent-run-actions-count">{c.actionsN(run.actions.length)}</span>
                      </>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </MobileLayout>
  );
}
