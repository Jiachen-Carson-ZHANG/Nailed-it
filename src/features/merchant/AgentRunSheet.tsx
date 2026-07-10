'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { getAgentRunDetailAction, getStyleTitleMapAction } from '@/lib/actions/agent-actions';
import { getMerchantAgentRunPath } from '@/domain/session';
import { useLanguage } from '@/i18n/context';
import type { AgentRunDetail, RunStatus } from '@/domain/agents';
import type { StyleTitleMap } from '@/domain/agent-transcript';
import { TranscriptChain } from './TranscriptChain';
import styles from './AgentRunSheet.module.css';

// The 今日 home reasoning drill-down (Phase 3, DESIGN.md "Two-Depth Disclosure"): a card's face → this
// sheet. Read-only by design — the approve/reject controls stay on the pin (single source of that state);
// here we show WHY (推理链路) and the run's 上下游 lineage, with a link to the full record. The chain
// renders through the shared TranscriptChain, so the sheet and the full run page read identically.

const copy = {
  'zh-CN': {
    title: '智能体推理', loading: '正在加载推理链路…', notFound: '未找到该运行记录',
    why: '推理链路', lineage: '上下游', from: '上游触发', spawned: '触发的下游', full: '查看完整记录 →',
    status: { running: '运行中', completed: '已完成', failed: '失败', awaiting_approval: '待批准' } as Record<RunStatus, string>,
  },
  en: {
    title: 'Agent reasoning', loading: 'Loading the reasoning chain…', notFound: 'Run not found',
    why: 'Reasoning chain', lineage: 'Lineage', from: 'Triggered by', spawned: 'Spawned', full: 'Full record →',
    status: { running: 'Running', completed: 'Done', failed: 'Failed', awaiting_approval: 'Awaiting approval' } as Record<RunStatus, string>,
  },
} as const;

function headline(output: unknown, fallback: string): string {
  const o = output as { headline?: string; verdict?: string } | null;
  const s = o?.headline ?? o?.verdict ?? fallback;
  return s.length > 140 ? `${s.slice(0, 139)}…` : s;
}

export function AgentRunSheet({ open, runId, onClose }: { open: boolean; runId: string | null; onClose: () => void }) {
  const { language } = useLanguage();
  const t = copy[language];
  const [detail, setDetail] = useState<AgentRunDetail | null>(null);
  const [titles, setTitles] = useState<StyleTitleMap>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !runId) return;
    let active = true;
    setLoading(true);
    setDetail(null);
    Promise.all([getAgentRunDetailAction(runId), getStyleTitleMapAction().catch(() => ({}))])
      .then(([d, t]) => { if (active) { setDetail(d); setTitles(t); } })
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
            <TranscriptChain steps={run.transcript} language={language} titles={titles} />
          </section>

          <Link className={styles.full} href={getMerchantAgentRunPath(run.id)} onClick={onClose}>
            {t.full}
          </Link>
        </>
      )}
    </BottomSheet>
  );
}
