'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { getAgentRunDetailAction } from '@/lib/actions/agent-actions';
import { getMerchantAgentRunPath } from '@/domain/session';
import { useLanguage } from '@/i18n/context';
import type { AgentRunDetail, RunStatus, TranscriptStep } from '@/domain/agents';
import styles from './AgentRunSheet.module.css';

// The 今日 home reasoning drill-down (Phase 3, DESIGN.md "Two-Depth Disclosure"): a card's face → this
// sheet. Read-only by design — the approve/reject controls stay on the pin (single source of that state);
// here we show WHY (推理链路) and the run's 上下游 lineage, with a link to the full record.

const copy = {
  'zh-CN': {
    title: '智能体推理', loading: '正在加载推理链路…', notFound: '未找到该运行记录',
    why: '推理链路', lineage: '上下游', from: '上游触发', spawned: '触发的下游',
    reasoning: '推理', tool: '工具', action: '动作', full: '查看完整记录 →',
    status: { running: '运行中', completed: '已完成', failed: '失败', awaiting_approval: '待批准' } as Record<RunStatus, string>,
  },
  en: {
    title: 'Agent reasoning', loading: 'Loading the reasoning chain…', notFound: 'Run not found',
    why: 'Reasoning chain', lineage: 'Lineage', from: 'Triggered by', spawned: 'Spawned',
    reasoning: 'Reasoning', tool: 'Tool', action: 'Action', full: 'Full record →',
    status: { running: 'Running', completed: 'Done', failed: 'Failed', awaiting_approval: 'Awaiting approval' } as Record<RunStatus, string>,
  },
} as const;

// Compact a tool payload for the sheet. Escaped by React (no XSS), but raw JSON can be long/noisy, so
// truncate — the full record is one tap away via "查看完整记录 →".
function summarize(value: unknown, max = 140): string {
  if (value == null) return '';
  const s = typeof value === 'string' ? value : (() => { try { return JSON.stringify(value); } catch { return String(value); } })();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function headline(output: unknown, fallback: string): string {
  const o = output as { headline?: string; verdict?: string } | null;
  return summarize(o?.headline ?? o?.verdict ?? fallback);
}

export function AgentRunSheet({ open, runId, onClose }: { open: boolean; runId: string | null; onClose: () => void }) {
  const { language } = useLanguage();
  const t = copy[language];
  const [detail, setDetail] = useState<AgentRunDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !runId) return;
    let active = true;
    setLoading(true);
    setDetail(null);
    getAgentRunDetailAction(runId)
      .then((d) => { if (active) setDetail(d); })
      .catch(() => { if (active) setDetail(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, runId]);

  const run = detail?.run ?? null;

  return (
    <BottomSheet open={open} onClose={onClose} title={t.title}>
      {loading ? (
        <p className={styles.state}>{t.loading}</p>
      ) : !run ? (
        <p className={styles.state}>{t.notFound}</p>
      ) : (
        <>
          <header className={styles.head}>
            <div className={styles.eyebrow}>
              <span>{run.agentName}</span>
              <span className={styles.statusChip}>{t.status[run.status]}</span>
            </div>
            <h3 className={styles.headline}>{headline(run.output, run.agentName)}</h3>
          </header>

          {(detail?.parent || (detail?.children.length ?? 0) > 0) ? (
            <section className={styles.section} aria-label={t.lineage}>
              <div className={styles.lane}>{t.lineage}</div>
              {detail?.parent ? (
                <div className={styles.lineRow}>
                  <span className={styles.lineLabel}>{t.from}</span>
                  <Link className={styles.chipLink} href={getMerchantAgentRunPath(detail.parent.id)} onClick={onClose}>
                    ↑ {detail.parent.agentName}
                  </Link>
                </div>
              ) : null}
              {detail && detail.children.length > 0 ? (
                <div className={styles.lineRow}>
                  <span className={styles.lineLabel}>{t.spawned}</span>
                  <div className={styles.chips}>
                    {detail.children.map((c) => (
                      <Link key={c.id} className={styles.chipLink} href={getMerchantAgentRunPath(c.id)} onClick={onClose}>
                        ↓ {c.agentName}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className={styles.section} aria-label={t.why}>
            <div className={styles.lane}>{t.why}</div>
            <ol className="agent-chain">
              {run.transcript.map((step, i) => (
                <li key={i} className={`agent-chain-step agent-chain-${step.kind}`}>
                  {renderStep(step, t)}
                </li>
              ))}
            </ol>
          </section>

          <Link className={styles.full} href={getMerchantAgentRunPath(run.id)} onClick={onClose}>
            {t.full}
          </Link>
        </>
      )}
    </BottomSheet>
  );
}

function renderStep(step: TranscriptStep, t: (typeof copy)[keyof typeof copy]): ReactNode {
  if (step.kind === 'reasoning') {
    return (
      <>
        <span className="agent-chain-tag">💭 {t.reasoning}</span>
        <p className="agent-chain-text">{step.text}</p>
      </>
    );
  }
  if (step.kind === 'tool_call') {
    return (
      <>
        <span className="agent-chain-tag">🔧 {t.tool} · {step.tool}</span>
        <p className="agent-chain-io">{summarize(step.input)} → {summarize(step.output)}</p>
      </>
    );
  }
  return (
    <>
      <span className="agent-chain-tag">⚡ {t.action}</span>
      <p className="agent-chain-text">{step.summary}</p>
    </>
  );
}
