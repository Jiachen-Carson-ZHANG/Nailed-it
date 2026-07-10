'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  getAgentRunAction,
  undoAgentActionAction,
  approveAgentActionAction,
  rejectAgentActionAction,
} from '@/lib/actions/agent-actions';
import { getMerchantAgentsPath, getMerchantStylesPath } from '@/domain/session';
import { actionEntityHref, actionTypeLabel, describeAction } from '@/domain/agent-transcript';
import { useLanguage } from '@/i18n/context';
import type { AppLanguage } from '@/i18n/types';
import type { AgentRunView } from '@/domain/agents';
import { TranscriptChain } from './TranscriptChain';

const detailCopy = {
  'zh-CN': {
    loading: '正在加载运行记录…',
    notFound: '未找到该运行记录',
    back: '返回团队',
    thinking: '思考链',
    actions: '执行动作',
    undo: '撤销',
    undone: '已撤销',
    approve: '批准',
    reject: '拒绝',
    approved: '已批准',
    rejected: '已拒绝',
    upload: '去上架',
    viewEntity: '查看 →',
    proposedNote: '待商家批准（库内无匹配款式，需提供图片后上架）',
  },
  en: {
    loading: 'Loading run…',
    notFound: 'Run not found',
    back: 'Back to team',
    thinking: 'Thinking chain',
    actions: 'Actions',
    undo: 'Undo',
    undone: 'Undone',
    approve: 'Approve',
    reject: 'Reject',
    approved: 'Approved',
    rejected: 'Rejected',
    upload: 'Upload it',
    viewEntity: 'View →',
    proposedNote: 'Awaiting merchant approval (no internal match — needs an image to list)',
  },
} satisfies Record<AppLanguage, Record<string, unknown>>;

function headline(output: unknown, fallback: string): string {
  const o = output as { headline?: string; verdict?: string } | null;
  return o?.headline ?? o?.verdict ?? fallback;
}

export function AgentRunDetailClient({ runId }: { runId: string }) {
  const { language } = useLanguage();
  const copy = detailCopy[language];
  const [run, setRun] = useState<AgentRunView | null>(null);
  const [loading, setLoading] = useState(true);
  const [undone, setUndone] = useState<Set<string>>(new Set());
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [rejected, setRejected] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    getAgentRunAction(runId)
      .then((data) => active && setRun(data))
      .catch(() => {/* not found */})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [runId]);

  async function undo(actionId: string) {
    setUndone((prev) => new Set(prev).add(actionId));
    await undoAgentActionAction(actionId);
  }

  async function approve(actionId: string) {
    setApproved((prev) => new Set(prev).add(actionId));
    await approveAgentActionAction(actionId);
  }

  async function reject(actionId: string) {
    setRejected((prev) => new Set(prev).add(actionId));
    await rejectAgentActionAction(actionId);
  }

  if (loading) return <p className="helper-copy">{copy.loading}</p>;
  if (!run) {
    return (
      <section className="page-heading">
        <EmptyState title={copy.notFound} body="" />
        <Link className="button button-secondary" href={getMerchantAgentsPath()}>{copy.back}</Link>
      </section>
    );
  }

  return (
    <>
      <Link className="detail-back-link detail-back-top" href={getMerchantAgentsPath()}>← {copy.back}</Link>
      <section className="profile-hero">
        <p className="section-eyebrow">{run.agentName}</p>
        <h1>{headline(run.output, run.agentName)}</h1>
      </section>

      <section className="detail-surface" aria-label={copy.thinking}>
        <div className="detail-surface-header"><h2>{copy.thinking}</h2></div>
        <TranscriptChain steps={run.transcript} language={language} />
      </section>

      {run.actions.length > 0 ? (
        <section className="detail-surface" aria-label={copy.actions}>
          <div className="detail-surface-header"><h2>{copy.actions}</h2></div>
          <ul className="agent-action-list">
            {run.actions.map((a) => {
              const isApproved = a.status === 'approved' || approved.has(a.id);
              const isRejected = rejected.has(a.id) || (a.status === 'undone' && a.risk === 'irreversible');
              // The approve/reject gate is the *proposed* state only — never `risk` (an applied irreversible
              // action like a sent message is done, not a pending gate). Risk decides undo eligibility below.
              const isProposed = !isApproved && !isRejected && a.status === 'proposed';
              const isUndone = a.status === 'undone' || undone.has(a.id);
              const entityHref = actionEntityHref(a);
              return (
                <li key={a.id} className="agent-action-row">
                  <div className="agent-action-body">
                    <span className={`agent-action-type agent-action-${a.type}`}>{actionTypeLabel(a.type, language)}</span>
                    <span className="agent-action-payload">
                      {describeAction(a.type, a.payload, language)}
                      {entityHref ? <> <Link className="agent-action-entity-link" href={entityHref}>{copy.viewEntity}</Link></> : null}
                    </span>
                    {isProposed ? <span className="agent-action-gate-note">{copy.proposedNote}</span> : null}
                  </div>
                  {isProposed ? (
                    <div className="agent-action-gate">
                      <button type="button" className="button button-primary button-compact" onClick={() => void approve(a.id)}>
                        {copy.approve}
                      </button>
                      <button type="button" className="button button-secondary button-compact" onClick={() => void reject(a.id)}>
                        {copy.reject}
                      </button>
                    </div>
                  ) : isApproved ? (
                    <span className="agent-action-gate">
                      <span className="agent-action-status">{copy.approved}</span>
                      {a.type === 'draft_upload' ? (
                        <Link className="button button-primary button-compact" href={getMerchantStylesPath()}>
                          {copy.upload}
                        </Link>
                      ) : null}
                    </span>
                  ) : isRejected ? (
                    <span className="agent-action-status">{copy.rejected}</span>
                  ) : a.risk === 'reversible' ? (
                    <button
                      type="button"
                      className="button button-secondary button-compact"
                      disabled={isUndone}
                      onClick={() => void undo(a.id)}
                    >
                      {isUndone ? copy.undone : copy.undo}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <Link className="button button-secondary" href={getMerchantAgentsPath()}>{copy.back}</Link>
    </>
  );
}
