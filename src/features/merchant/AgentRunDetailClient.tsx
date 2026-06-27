'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  getAgentRunAction,
  undoAgentActionAction,
  approveAgentActionAction,
  rejectAgentActionAction,
} from '@/lib/actions/agent-actions';
import { getMerchantAgentsPath, getMerchantStylesPath } from '@/domain/session';
import { useLanguage } from '@/i18n/context';
import type { AppLanguage } from '@/i18n/types';
import type { AgentActionType, AgentRunView, TranscriptStep } from '@/domain/agents';

const detailCopy = {
  'zh-CN': {
    loading: '正在加载运行记录…',
    notFound: '未找到该运行记录',
    back: '返回团队',
    thinking: '思考链',
    actions: '执行动作',
    output: '产出',
    undo: '撤销',
    undone: '已撤销',
    approve: '批准',
    reject: '拒绝',
    approved: '已批准',
    rejected: '已拒绝',
    upload: '去上架',
    proposedNote: '待商家批准（库内无匹配款式，需提供图片后上架）',
    reasoning: '推理',
    tool: '工具',
    action: '动作',
    actionType: {
      place_ad: '投广',
      set_group_buy_coupon: '团购券',
      list_style: '上架',
      delist_style: '下架',
      draft_upload: '生成草稿',
      send_customer_message: '发送消息',
    } as Record<AgentActionType, string>,
  },
  en: {
    loading: 'Loading run…',
    notFound: 'Run not found',
    back: 'Back to team',
    thinking: 'Thinking chain',
    actions: 'Actions',
    output: 'Output',
    undo: 'Undo',
    undone: 'Undone',
    approve: 'Approve',
    reject: 'Reject',
    approved: 'Approved',
    rejected: 'Rejected',
    upload: 'Upload it',
    proposedNote: 'Awaiting merchant approval (no internal match — needs an image to list)',
    reasoning: 'Reasoning',
    tool: 'Tool',
    action: 'Action',
    actionType: {
      place_ad: 'Ad',
      set_group_buy_coupon: 'Coupon',
      list_style: 'List',
      delist_style: 'Delist',
      draft_upload: 'Draft',
      send_customer_message: 'Message',
    } as Record<AgentActionType, string>,
  },
} satisfies Record<AppLanguage, Record<string, unknown>>;

function summarize(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
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
      <section className="profile-hero">
        <p className="section-eyebrow">{run.agentName}</p>
        <h1>{summarize((run.output as { headline?: string; verdict?: string })?.headline ?? (run.output as { verdict?: string })?.verdict ?? run.agentName)}</h1>
      </section>

      <section className="detail-surface" aria-label={copy.thinking}>
        <div className="detail-surface-header"><h2>{copy.thinking}</h2></div>
        <ol className="agent-chain">
          {run.transcript.map((step, i) => (
            <li key={i} className={`agent-chain-step agent-chain-${step.kind}`}>
              {renderStep(step, copy)}
            </li>
          ))}
        </ol>
      </section>

      {run.actions.length > 0 ? (
        <section className="detail-surface" aria-label={copy.actions}>
          <div className="detail-surface-header"><h2>{copy.actions}</h2></div>
          <ul className="agent-action-list">
            {run.actions.map((a) => {
              const isApproved = a.status === 'approved' || approved.has(a.id);
              const isRejected = rejected.has(a.id) || (a.status === 'undone' && a.risk === 'irreversible');
              const isProposed = !isApproved && !isRejected && (a.status === 'proposed' || a.risk === 'irreversible');
              const isUndone = a.status === 'undone' || undone.has(a.id);
              return (
                <li key={a.id} className="agent-action-row">
                  <div className="agent-action-body">
                    <span className={`agent-action-type agent-action-${a.type}`}>{copy.actionType[a.type]}</span>
                    <span className="agent-action-payload">{summarize(a.payload)}</span>
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

function renderStep(
  step: TranscriptStep,
  copy: (typeof detailCopy)[AppLanguage],
): ReactNode {
  if (step.kind === 'reasoning') {
    return (
      <>
        <span className="agent-chain-tag">💭 {copy.reasoning}</span>
        <p className="agent-chain-text">{step.text}</p>
      </>
    );
  }
  if (step.kind === 'tool_call') {
    return (
      <>
        <span className="agent-chain-tag">🔧 {copy.tool} · {step.tool}</span>
        <p className="agent-chain-io">{summarize(step.input)} → {summarize(step.output)}</p>
      </>
    );
  }
  return (
    <>
      <span className="agent-chain-tag">⚡ {copy.action} · {copy.actionType[step.actionType]}</span>
      <p className="agent-chain-text">{step.summary}</p>
    </>
  );
}
