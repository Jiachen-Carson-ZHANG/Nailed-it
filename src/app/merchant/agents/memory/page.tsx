'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { getStyleTitleMapAction, listTeamMemoryAction, type TeamMemoryView } from '@/lib/actions/agent-actions';
import { humanizeReasoning, type StyleTitleMap } from '@/domain/agent-transcript';
import { useLanguage } from '@/i18n/context';
import type { AppLanguage } from '@/i18n/types';

const copy = {
  'zh-CN': {
    eyebrow: 'Nailed AI · 团队记忆',
    title: '团队记忆库',
    body: '监测 Agent 用实测结果写入，下一轮决策会引用——这是团队跨轮学习的证据。每条都锚定到具体动作，可追溯。',
    back: '← 返回运营团队',
    all: '全部',
    kind: { action_outcome: '实测结论', calibration: '校准', round_verdict: '本轮结论', merchant_preference: '商家偏好' } as Record<string, string>,
    confidence: { high: '置信度高', medium: '置信度中', low: '置信度低' } as Record<string, string>,
    fromAgent: '来源',
    anchor: '证据锚',
    expires: '有效至',
    deviation: (r: number) => `预测偏差 ×${r}`,
    emptyTitle: '暂无记忆',
    emptyBody: '运营团队运行、监测写入实测结论后，这里会分类展示。',
    loading: '正在加载…',
  },
  en: {
    eyebrow: 'Nailed AI · Team memory',
    title: 'Team memory',
    body: 'Written by the monitor from measured outcomes; the next round cites it. Every row is anchored to a real action — traceable.',
    back: '← Back to agent team',
    all: 'All',
    kind: { action_outcome: 'Measured', calibration: 'Calibration', round_verdict: 'Round verdict', merchant_preference: 'Preference' } as Record<string, string>,
    confidence: { high: 'high', medium: 'medium', low: 'low' } as Record<string, string>,
    fromAgent: 'From',
    anchor: 'Evidence',
    expires: 'Expires',
    deviation: (r: number) => `deviation ×${r}`,
    emptyTitle: 'No memory yet',
    emptyBody: 'Once the team runs and the monitor writes measured outcomes, they appear here by kind.',
    loading: 'Loading…',
  },
} satisfies Record<AppLanguage, Record<string, unknown>>;

const KIND_ORDER = ['action_outcome', 'round_verdict', 'calibration', 'merchant_preference'] as const;

function fmtDate(iso: string, language: AppLanguage): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(language === 'zh-CN' ? 'zh-CN' : 'en-GB', { month: 'short', day: 'numeric' });
}

export default function MerchantAgentMemoryPage() {
  const { language } = useLanguage();
  const c = copy[language];
  const [memory, setMemory] = useState<TeamMemoryView[]>([]);
  const [titles, setTitles] = useState<StyleTitleMap>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    let active = true;
    void getStyleTitleMapAction().then((t) => active && setTitles(t)).catch(() => {});
    listTeamMemoryAction(50)
      .then((m) => active && setMemory(m))
      .catch(() => {/* leave empty */})
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of memory) map.set(m.kind, (map.get(m.kind) ?? 0) + 1);
    return map;
  }, [memory]);

  const chips = useMemo(
    () => [{ key: 'all', label: c.all as string, n: memory.length },
      ...KIND_ORDER.filter((k) => counts.has(k)).map((k) => ({ key: k, label: c.kind[k] ?? k, n: counts.get(k) ?? 0 }))],
    [memory.length, counts, c],
  );

  const shown = filter === 'all' ? memory : memory.filter((m) => m.kind === filter);

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
      ) : memory.length === 0 ? (
        <EmptyState title={c.emptyTitle as string} body={c.emptyBody as string} />
      ) : (
        <section className="detail-surface">
          <div className="agent-memory-filterow" role="tablist" aria-label={c.title as string}>
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                role="tab"
                aria-selected={filter === chip.key}
                className={`agent-memory-chip${filter === chip.key ? ' agent-memory-chip--active' : ''}`}
                onClick={() => setFilter(chip.key)}
              >
                {chip.label} <span className="agent-memory-chip-n">{chip.n}</span>
              </button>
            ))}
          </div>

          <ul className="agent-memory-list">
            {shown.map((m) => (
              <li key={m.id} className="agent-memory-row">
                <div className="agent-memory-rowhead">
                  <span className={`agent-memory-kind agent-memory-kind-${m.kind}`}>{c.kind[m.kind] ?? m.kind}</span>
                  {m.confidence ? (
                    <span className={`agent-memory-conf agent-memory-conf-${m.confidence}`}>{c.confidence[m.confidence] ?? m.confidence}</span>
                  ) : null}
                </div>
                <p className="agent-memory-claim">{humanizeReasoning(m.claim, language, titles)}</p>
                <div className="agent-memory-meta">
                  {m.agentSlug ? <span>{c.fromAgent}: {m.agentSlug}</span> : null}
                  {m.comparison?.ratio ? <span>· {c.deviation(m.comparison.ratio)}</span> : null}
                  <span>· {fmtDate(m.createdAt, language)}</span>
                  {m.expiresAt ? <span>· {c.expires} {fmtDate(m.expiresAt, language)}</span> : null}
                </div>
                {m.sourceActionId || m.entityId ? (
                  <p className="agent-memory-anchor">
                    <span>{c.anchor}:</span> <code>{m.entityId ?? m.sourceActionId}</code>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </MobileLayout>
  );
}
