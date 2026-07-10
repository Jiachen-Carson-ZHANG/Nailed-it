'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listAgentActionsAction, undoAgentActionAction } from '@/lib/actions/agent-actions';
import { getMerchantAgentRunPath, getMerchantAgentsPath } from '@/domain/session';
import { dedupeActionsByEntity, describeAction } from '@/domain/agent-transcript';
import { useLanguage } from '@/i18n/context';
import type { AgentAction, AgentActionType } from '@/domain/agents';

/**
 * In-context surface (ADR-0007 Phase 3b): renders what the agent team did, on the *real* merchant
 * pages — an AI-attributed card with one-click undo. Self-fetching + self-hiding (renders nothing
 * when there are no applied actions), so it can be dropped onto any page. The panel
 * (/merchant/agents) stays the full audit; this is the "AI is woven into the product" view.
 *
 * UI-alignment pass: rows dedupe to the LATEST action per entity (four historical coupon rounds on one
 * deal used to render as four undo rows), and each row links to the run that reasoned it (为什么).
 */
type Props = {
  types: AgentActionType[];
  /** Optional filter (老板msg thread): only show messages to this customer. */
  filterCustomerName?: string;
};

const copy = {
  'zh-CN': { eyebrow: 'AI 运营助手', undo: '撤销', undone: '已撤销', detail: '查看团队', why: '为什么？' },
  en: { eyebrow: 'AI ops assistant', undo: 'Undo', undone: 'Undone', detail: 'View team', why: 'Why?' },
} as const;

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
        setActions(dedupeActionsByEntity(filtered));
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
              <span className="agent-inline-text">
                {describeAction(a.type, a.payload, language)}{' '}
                <Link className="agent-inline-why" href={getMerchantAgentRunPath(a.runId)}>{c.why}</Link>
              </span>
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
