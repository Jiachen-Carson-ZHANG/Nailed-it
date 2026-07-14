'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BottomSheet } from '@/components/ui/BottomSheet';
import {
  approveAgentActionAction,
  getAgentRunDetailAction,
  getStyleTitleMapAction,
  rejectAgentActionAction,
} from '@/lib/actions/agent-actions';
import { getMerchantAgentRunPath } from '@/domain/session';
import { useLanguage } from '@/i18n/context';
import { formatCurrency } from '@/i18n/format';
import type { AgentRunDetail, RunStatus, AgentAction, ActionStatus } from '@/domain/agents';
import { actionTypeLabel, describeAction, type StyleTitleMap } from '@/domain/agent-transcript';
import { TranscriptChain } from './TranscriptChain';
import styles from './AgentRunSheet.module.css';

// The 今日 home reasoning drill-down (Phase 3, DESIGN.md "Two-Depth Disclosure"): a card's face → this
// sheet. Read-only by design — the approve/reject controls stay on the pin (single source of that state);
// here we show WHY (推理链路) and the run's 上下游 lineage, with a link to the full record. The chain
// renders through the shared TranscriptChain, so the sheet and the full run page read identically.

const copy = {
  'zh-CN': {
    title: '智能体推理', loading: '正在加载推理链路…', notFound: '未找到该运行记录',
    why: '推理链路', lineage: '上下游', from: '上游触发', spawned: '触发的下游', audits: '监测对象', full: '查看完整记录 →',
    nextRound: '回流下一轮', actions: '动作设置', approve: '批准', reject: '拒绝', back: '‹ 返回',
    actionStatus: { proposed: '待你确认', applied: '已执行', approved: '已批准', undone: '已撤销' } as Record<ActionStatus, string>,
    status: { running: '运行中', completed: '已完成', failed: '失败', awaiting_approval: '待批准' } as Record<RunStatus, string>,
  },
  en: {
    title: 'Agent reasoning', loading: 'Loading the reasoning chain…', notFound: 'Run not found',
    why: 'Reasoning chain', lineage: 'Lineage', from: 'Triggered by', spawned: 'Spawned', audits: 'Auditing', full: 'Full record →',
    nextRound: 'Feeds next round', actions: 'Action settings', approve: 'Approve', reject: 'Reject', back: '‹ Back',
    actionStatus: { proposed: 'Awaiting you', applied: 'Applied', approved: 'Approved', undone: 'Undone' } as Record<ActionStatus, string>,
    status: { running: 'Running', completed: 'Done', failed: 'Failed', awaiting_approval: 'Awaiting approval' } as Record<RunStatus, string>,
  },
} as const;

// The merchant-readable slice of an action payload — the SETTINGS the gate is asking them to approve
// (a coupon's price/quota/validity, an ad's budget/audience), not the whole JSON blob.
const PARAM_FIELDS: Array<{ key: string; label: { 'zh-CN': string; en: string }; kind: 'money' | 'days' | 'count' | 'enum' }> = [
  { key: 'priceCents', label: { 'zh-CN': '券价', en: 'Coupon price' }, kind: 'money' },
  { key: 'maxCoupons', label: { 'zh-CN': '数量上限', en: 'Max coupons' }, kind: 'count' },
  { key: 'validDays', label: { 'zh-CN': '有效期', en: 'Valid for' }, kind: 'days' },
  { key: 'redemptionWindow', label: { 'zh-CN': '核销时段', en: 'Redemption' }, kind: 'enum' },
  { key: 'audience', label: { 'zh-CN': '适用人群', en: 'Audience' }, kind: 'enum' },
  { key: 'dailyBudgetCents', label: { 'zh-CN': '日预算', en: 'Daily budget' }, kind: 'money' },
  { key: 'totalBudgetCents', label: { 'zh-CN': '总预算', en: 'Total budget' }, kind: 'money' },
  { key: 'durationDays', label: { 'zh-CN': '投放天数', en: 'Duration' }, kind: 'days' },
];

const ENUM_LABELS: Record<string, { 'zh-CN': string; en: string }> = {
  any: { 'zh-CN': '不限', en: 'Anyone' },
  weekday_afternoon: { 'zh-CN': '工作日下午', en: 'Weekday afternoons' },
  weekday_10_off: { 'zh-CN': '工作日 9 折', en: 'Weekday 10% off' },
  broad_local_interest: { 'zh-CN': '本地兴趣人群', en: 'Broad local interest' },
  saved_or_viewed: { 'zh-CN': '收藏/浏览过', en: 'Saved or viewed' },
  try_on_no_booking: { 'zh-CN': '试戴未预约', en: 'Tried on, no booking' },
};

function ActionParams({ action, language }: { action: AgentAction; language: 'zh-CN' | 'en' }) {
  const rows = PARAM_FIELDS.flatMap(({ key, label, kind }) => {
    const v = action.payload?.[key];
    if (v === undefined || v === null) return [];
    const value =
      kind === 'money' && typeof v === 'number' ? formatCurrency({ cents: v, language })
      : kind === 'days' ? `${v} ${language === 'zh-CN' ? '天' : 'days'}`
      : kind === 'enum' ? (ENUM_LABELS[String(v)]?.[language] ?? String(v))
      : String(v);
    return [{ key, label: label[language], value }];
  });
  if (rows.length === 0) return null;
  return (
    <dl className={styles.paramGrid}>
      {rows.map((r) => (
        <div key={r.key} className={styles.paramRow}>
          <dt>{r.label}</dt>
          <dd>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function headline(output: unknown, fallback: string): string {
  const o = output as { headline?: string; verdict?: string } | null;
  const s = o?.headline ?? o?.verdict ?? fallback;
  return s.length > 140 ? `${s.slice(0, 139)}…` : s;
}

export function AgentRunSheet({ open, runId, onClose, onActionsChanged }: {
  open: boolean;
  runId: string | null;
  onClose: () => void;
  /** Fired after an in-sheet 批准/拒绝 lands, so the opener can refresh its queue. */
  onActionsChanged?: () => void;
}) {
  const { language } = useLanguage();
  const t = copy[language];
  const [detail, setDetail] = useState<AgentRunDetail | null>(null);
  const [titles, setTitles] = useState<StyleTitleMap>({});
  const [loading, setLoading] = useState(false);
  // In-sheet lineage navigation: tapping an 上下游 chip loads THAT run here (with ‹返回), instead of
  // yanking the merchant off to the AI-team page. The full record stays one explicit link away.
  const [viewRunId, setViewRunId] = useState<string | null>(runId);
  const [stack, setStack] = useState<string[]>([]);

  useEffect(() => {
    // (Re)opening resets the drill-down to the tapped run.
    setViewRunId(runId);
    setStack([]);
  }, [open, runId]);

  useEffect(() => {
    if (!open || !viewRunId) return;
    let active = true;
    setLoading(true);
    setDetail(null);
    Promise.all([getAgentRunDetailAction(viewRunId), getStyleTitleMapAction().catch(() => ({}))])
      .then(([d, t]) => { if (active) { setDetail(d); setTitles(t); } })
      .catch(() => { if (active) setDetail(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, viewRunId]);

  const run = detail?.run ?? null;

  const hop = (targetRunId: string) => {
    setStack((s) => (viewRunId ? [...s, viewRunId] : s));
    setViewRunId(targetRunId);
  };
  const hopBack = () => {
    setStack((s) => {
      const prev = s[s.length - 1];
      if (prev) setViewRunId(prev);
      return s.slice(0, -1);
    });
  };

  const resolve = (action: AgentAction, kind: 'approve' | 'reject') => {
    // Optimistic: flip the card's status locally; the opener refreshes its own queue via the callback.
    const nextStatus: ActionStatus = kind === 'approve' ? 'approved' : 'undone';
    setDetail((d) => d ? {
      ...d,
      run: { ...d.run, actions: d.run.actions.map((a) => (a.id === action.id ? { ...a, status: nextStatus } : a)) },
    } : d);
    const fn = kind === 'approve' ? approveAgentActionAction : rejectAgentActionAction;
    void fn(action.id).then(() => onActionsChanged?.()).catch(() => onActionsChanged?.());
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={t.title}>
      {loading ? (
        <p className={styles.state}>{t.loading}</p>
      ) : !run ? (
        <p className={styles.state}>{t.notFound}</p>
      ) : (
        <>
          {stack.length > 0 ? (
            <button type="button" className={styles.backBtn} onClick={hopBack}>{t.back}</button>
          ) : null}
          <header className={styles.head}>
            <div className={styles.eyebrow}>
              <span>{run.agentName}</span>
              <span className={styles.statusChip}>{t.status[run.status]}</span>
            </div>
            <h3 className={styles.headline}>{headline(run.output, run.agentName)}</h3>
          </header>

          {run.actions.length > 0 ? (
            // The gate's substance first: WHAT the agent set up (a coupon's price/quota/validity, an
            // ad's budget) — the reasoning chain below explains WHY. A merchant deciding 批准/拒绝 needs
            // the settings, not just the thinking.
            <section className={styles.section} aria-label={t.actions}>
              <div className={styles.lane}>{t.actions}</div>
              {run.actions.map((a) => (
                <div key={a.id} className={styles.actionCard}>
                  <div className={styles.actionHead}>
                    <span className={styles.actionType}>{actionTypeLabel(a.type, language)}</span>
                    <span className={a.status === 'proposed' ? styles.actionPending : styles.actionDone}>
                      {t.actionStatus[a.status] ?? a.status}
                    </span>
                  </div>
                  <p className={styles.actionSummary}>{describeAction(a.type, a.payload, language, titles)}</p>
                  <ActionParams action={a} language={language} />
                  {a.status === 'proposed' ? (
                    <div className={styles.actionCtl}>
                      <button type="button" className={`${styles.gateBtn} ${styles.gateApprove}`} onClick={() => resolve(a, 'approve')}>{t.approve}</button>
                      <button type="button" className={styles.gateBtn} onClick={() => resolve(a, 'reject')}>{t.reject}</button>
                    </div>
                  ) : null}
                </div>
              ))}
            </section>
          ) : null}

          {(detail?.parent || (detail?.children.length ?? 0) > 0 || (detail?.auditTargets.length ?? 0) > 0 || detail?.nextRoundDecision) ? (
            <section className={styles.section} aria-label={t.lineage}>
              <div className={styles.lane}>{t.lineage}</div>
              {detail && detail.auditTargets.length > 0 ? (
                <div className={styles.lineRow}>
                  <span className={styles.lineLabel}>{t.audits}</span>
                  <div className={styles.chips}>
                    {detail.auditTargets.map((tgt) => (
                      <button key={tgt.id} type="button" className={styles.chipLink} onClick={() => hop(tgt.id)}>
                        {tgt.agentName}
                      </button>
                    ))}
                  </div>
                </div>
              ) : detail?.parent ? (
                <div className={styles.lineRow}>
                  <span className={styles.lineLabel}>{t.from}</span>
                  <button type="button" className={styles.chipLink} onClick={() => detail.parent && hop(detail.parent.id)}>
                    ↑ {detail.parent.agentName}
                  </button>
                </div>
              ) : null}
              {detail && detail.children.length > 0 ? (
                <div className={styles.lineRow}>
                  <span className={styles.lineLabel}>{t.spawned}</span>
                  <div className={styles.chips}>
                    {detail.children.map((c) => (
                      <button key={c.id} type="button" className={styles.chipLink} onClick={() => hop(c.id)}>
                        ↓ {c.agentName}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {detail?.nextRoundDecision ? (
                // Cross-round memory loop: this round's monitor findings inform the next round's 商分.
                <div className={styles.lineRow}>
                  <span className={styles.lineLabel}>{t.nextRound}</span>
                  <button type="button" className={`${styles.chipLink} ${styles.chipNext}`} onClick={() => hop(detail.nextRoundDecision!.id)}>
                    ⟳ {detail.nextRoundDecision.agentName} →
                  </button>
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
