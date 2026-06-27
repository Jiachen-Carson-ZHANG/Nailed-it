'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listAgentActionsAction, undoAgentActionAction } from '@/lib/actions/agent-actions';
import { getMerchantAgentsPath } from '@/domain/session';
import { useLanguage } from '@/i18n/context';
import type { AgentAction, AgentActionType } from '@/domain/agents';

/**
 * In-context surface (ADR-0007 Phase 3b): renders what the agent team did, on the *real* merchant
 * pages — an AI-attributed card with one-click undo. Self-fetching + self-hiding (renders nothing
 * when there are no applied actions), so it can be dropped onto any page. The panel
 * (/merchant/agents) stays the full audit; this is the "AI is woven into the product" view.
 */
type Props = {
  types: AgentActionType[];
  /** Optional filter (老板msg thread): only show messages to this customer. */
  filterCustomerName?: string;
};

const copy = {
  'zh-CN': {
    eyebrow: 'AI 运营助手',
    undo: '撤销',
    undone: '已撤销',
    detail: '查看团队',
    slot: { top_funnel: '首页推荐位', mid_funnel: '中部曝光位', lower_funnel: '详情页转化位' } as Record<string, string>,
    ad: (s: string, slot: string, amt: string) => `已为「${s}」投放广告 · ${slot} · 预算 ${amt}`,
    coupon: (s: string, amt: string) => `已为「${s}」设置团购券 · 券后 ${amt}`,
    msg: (n: string, body: string) => `已以老板身份给 ${n} 发送：${body}`,
  },
  en: {
    eyebrow: 'AI ops assistant',
    undo: 'Undo',
    undone: 'Undone',
    detail: 'View team',
    slot: { top_funnel: 'Home feature', mid_funnel: 'Mid exposure', lower_funnel: 'Detail conversion' } as Record<string, string>,
    ad: (s: string, slot: string, amt: string) => `Placed an ad for "${s}" · ${slot} · budget ${amt}`,
    coupon: (s: string, amt: string) => `Set a group-buy coupon for "${s}" · after-coupon ${amt}`,
    msg: (n: string, body: string) => `Messaged ${n} as the boss: ${body}`,
  },
} as const;

function money(cents: unknown): string {
  const n = typeof cents === 'number' ? cents : Number(cents);
  return Number.isFinite(n) ? `SGD ${(n / 100).toFixed(0)}` : '—';
}

function shortStyle(id: unknown): string {
  const s = String(id ?? '');
  return s.length > 14 ? `…${s.slice(-10)}` : s || '—';
}

export function AgentActionInline({ types, filterCustomerName }: Props) {
  const { language } = useLanguage();
  const c = copy[language];
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [undone, setUndone] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    listAgentActionsAction(types)
      .then((rows) => {
        if (!active) return;
        const filtered = filterCustomerName
          ? rows.filter((a) => a.payload?.customerName === filterCustomerName)
          : rows;
        setActions(filtered);
      })
      .catch(() => {/* no surface */});
    return () => {
      active = false;
    };
    // types is a literal array per call site; join for a stable dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types.join(','), filterCustomerName]);

  if (actions.length === 0) return null;

  async function undo(id: string) {
    setUndone((prev) => new Set(prev).add(id));
    await undoAgentActionAction(id);
  }

  function summarize(a: AgentAction): string {
    const p = a.payload ?? {};
    if (a.type === 'place_ad') return c.ad(shortStyle(p.styleId), c.slot[String(p.slot)] ?? String(p.slot), money(p.budgetCents));
    if (a.type === 'set_group_buy_coupon') return c.coupon(shortStyle(p.styleId), money(p.priceCents));
    if (a.type === 'send_customer_message') return c.msg(String(p.customerName ?? ''), String(p.body ?? ''));
    return a.type;
  }

  return (
    <section className="agent-inline" aria-label={c.eyebrow}>
      <header className="agent-inline-head">
        <span className="agent-inline-eyebrow">{c.eyebrow}</span>
        <Link className="agent-inline-link" href={getMerchantAgentsPath()}>{c.detail}</Link>
      </header>
      <ul className="agent-inline-list">
        {actions.map((a) => {
          const isUndone = undone.has(a.id);
          return (
            <li key={a.id} className="agent-inline-row">
              <span className="agent-inline-text">{summarize(a)}</span>
              {a.risk === 'reversible' ? (
                <button
                  type="button"
                  className="button button-secondary button-compact"
                  disabled={isUndone}
                  onClick={() => void undo(a.id)}
                >
                  {isUndone ? c.undone : c.undo}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
