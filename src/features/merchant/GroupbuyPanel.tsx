'use client';

import { useCallback, useEffect, useState } from 'react';
import { glossaryById } from '@/data/glossary';
import type { GlossaryEntrySettings } from '@/data/glossary-settings-store';
import type { GroupbuyDeal, GroupbuyDealRecord } from '@/domain/groupbuy';
import {
  listGroupbuyDealsAction,
  saveGroupbuyDraftAction,
  publishGroupbuyDealAction,
  setGroupbuyStatusAction,
  copyGroupbuyDealAction,
} from '@/lib/actions/groupbuy-actions';
import { GroupbuyDetail } from '@/features/merchant/GroupbuyDetail';
import { GroupbuyWizard } from '@/features/merchant/GroupbuyWizard';

// 团购管理 (ADR-0012 Phase 2). Deals now come from the repository seam, not browser localStorage — so the
// drafts the 团购 agent proposes are actually visible and reviewable here. The "AI助手" card lists exactly
// those: deals carrying a sourceRunId that are still drafts, i.e. awaiting the merchant's publish.

type GroupbuyPanelMode = 'list' | 'detail' | 'create' | 'edit';

type GroupbuyPanelProps = {
  language: 'zh-CN' | 'en';
  currency: string;
  settingsById: Map<string, GlossaryEntrySettings>;
};

const copy = {
  'zh-CN': {
    aiHeader: 'AI助手 · 待你确认的团购建议',
    aiEmpty: '暂无 AI 团购建议。AI 团队会在下周有空档且款式转化不足时提出。',
    aiCta: '查看',
    aiWhy: (orig: string, deal: string) => `AI 建议：原价 ${orig} → 券后 ${deal}`,
    listHeader: '团购列表',
    viewBtn: '查看', addBtn: '+ 添加团购',
    purchaseCount: '购买次数 ', redemptionCount: '核销次数 ',
    draftStatus: '草稿', unlistedStatus: '已下架', aiBadge: 'AI 建议',
    loading: '加载中…', empty: '暂无团购', error: '操作失败，请重试。',
  },
  en: {
    aiHeader: 'AI assistant · deals awaiting your review',
    aiEmpty: 'No AI deal suggestions yet. The team proposes one when next week is idle and a style under-converts.',
    aiCta: 'View',
    aiWhy: (orig: string, deal: string) => `AI suggests: ${orig} → ${deal}`,
    listHeader: 'Deal list',
    viewBtn: 'View', addBtn: '+ Add deal',
    purchaseCount: 'Purchases: ', redemptionCount: 'Redeemed: ',
    draftStatus: 'Draft', unlistedStatus: 'Unlisted', aiBadge: 'AI proposed',
    loading: 'Loading…', empty: 'No deals yet', error: 'Action failed, please retry.',
  },
} as const;

/** No real sales metrics exist yet — render '—' (unknown), never a fake 0 (ADR-0011 backend-honest). */
const UNKNOWN_META = { purchaseCount: null, redemptionCount: null };

function formatListPrice(currency: string, price: number) {
  return `${currency} ${price}`;
}

function catalogItemName(catalogItemId: string, language: 'zh-CN' | 'en'): string {
  const entry = glossaryById.get(catalogItemId);
  if (!entry) return catalogItemId;
  return language === 'zh-CN' ? entry.name_zh : entry.name_en;
}

export function GroupbuyPanel({ language, currency, settingsById }: GroupbuyPanelProps) {
  const t = copy[language];
  const [mode, setMode] = useState<GroupbuyPanelMode>('list');
  const [activeDealId, setActiveDealId] = useState<string | null>(null);
  const [deals, setDeals] = useState<GroupbuyDealRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    listGroupbuyDealsAction()
      .then((rows) => { setDeals(rows); setFailed(false); })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(refresh, [refresh]);

  const activeDeal = (): GroupbuyDealRecord | undefined => deals.find((d) => d.id === activeDealId);
  /** Agent-proposed drafts awaiting the merchant — replaces the old hardcoded suggestions. */
  const proposals = deals.filter((d) => d.sourceRunId !== null && d.status === 'draft');

  function run(op: Promise<{ ok: boolean }>, after: () => void) {
    op.then((r) => { if (!r.ok) setFailed(true); else { setFailed(false); after(); } })
      .catch(() => setFailed(true))
      .finally(refresh);
  }

  function handleView(id: string) { setActiveDealId(id); setMode('detail'); }
  function backToList() { setActiveDealId(null); setMode('list'); }

  // ── detail mode ──────────────────────────────────────────────────────────────
  if (mode === 'detail') {
    const deal = activeDeal();
    if (!deal) { setMode('list'); return null; }
    return (
      <div className="manage-panel-content groupbuy-panel">
        {failed ? <p className="groupbuy-ai-text">{t.error}</p> : null}
        <GroupbuyDetail
          language={language}
          currency={currency}
          deal={deal}
          meta={UNKNOWN_META}
          sourceRunId={deal.sourceRunId}
          onBack={backToList}
          onEdit={() => setMode('edit')}
          onCopy={() => run(copyGroupbuyDealAction(deal), backToList)}
          onUnlist={() => run(setGroupbuyStatusAction(deal.id, 'unlisted'), () => {})}
          onRelist={() => run(setGroupbuyStatusAction(deal.id, 'published'), () => {})}
        />
      </div>
    );
  }

  // ── create / edit mode ───────────────────────────────────────────────────────
  if (mode === 'create' || mode === 'edit') {
    const initialDeal = mode === 'edit' ? activeDeal() : undefined;
    return (
      <div className="manage-panel-content groupbuy-panel">
        {failed ? <p className="groupbuy-ai-text">{t.error}</p> : null}
        <GroupbuyWizard
          language={language}
          currency={currency}
          settingsById={settingsById}
          initialDeal={initialDeal}
          onCancel={() => (mode === 'edit' ? setMode('detail') : backToList())}
          onSaveDraft={(deal: GroupbuyDeal) => run(saveGroupbuyDraftAction(deal), () => (mode === 'edit' ? setMode('detail') : backToList()))}
          onPublish={(deal: GroupbuyDeal) => run(publishGroupbuyDealAction(deal), () => (mode === 'edit' ? setMode('detail') : backToList()))}
        />
      </div>
    );
  }

  // ── list mode ────────────────────────────────────────────────────────────────
  return (
    <div className="manage-panel-content groupbuy-panel">
      {/* AI助手 — the agent's real proposals, not a mockup */}
      <div className="groupbuy-ai-card">
        <p className="groupbuy-ai-header">{t.aiHeader}</p>
        {proposals.length === 0 ? (
          <p className="groupbuy-ai-text">{t.aiEmpty}</p>
        ) : (
          <ul className="groupbuy-ai-list">
            {proposals.map((deal) => (
              <li key={deal.id} className="groupbuy-ai-suggestion">
                <span className="groupbuy-ai-text">
                  <b>{deal.title}</b> — {t.aiWhy(formatListPrice(currency, deal.originalPrice), formatListPrice(currency, deal.dealPrice ?? deal.originalPrice))}
                </span>
                <button type="button" className="button button-primary button-compact groupbuy-ai-cta" onClick={() => handleView(deal.id)}>
                  {t.aiCta}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Deal list */}
      <div className="manage-section-heading">{t.listHeader}</div>
      {failed ? <p className="groupbuy-ai-text">{t.error}</p> : null}
      <div className="groupbuy-deal-list">
        {loading && deals.length === 0 ? <p className="groupbuy-ai-text">{t.loading}</p> : null}
        {!loading && deals.length === 0 ? <p className="groupbuy-ai-text">{t.empty}</p> : null}

        {deals.map((deal) => (
          <div key={deal.id} className="groupbuy-deal-card">
            <div className="groupbuy-deal-body">
              <p className="groupbuy-deal-title">
                {deal.title}
                {deal.sourceRunId !== null ? <span className="groupbuy-status-pill">{t.aiBadge}</span> : null}
                {deal.status === 'draft' ? (
                  <span className="groupbuy-status-pill">{t.draftStatus}</span>
                ) : deal.status === 'unlisted' ? (
                  <span className="groupbuy-status-pill groupbuy-status-pill--unlisted">{t.unlistedStatus}</span>
                ) : null}
              </p>
              <div className="groupbuy-deal-elements">
                {deal.serviceSelections.filter((s) => s.enabled).slice(0, 4).map((s) => (
                  <span key={s.catalogItemId} className="groupbuy-element-tag">
                    {catalogItemName(s.catalogItemId, language)}
                  </span>
                ))}
              </div>
              <div className="groupbuy-deal-price-row">
                <span className="groupbuy-deal-price">{formatListPrice(currency, deal.dealPrice ?? deal.originalPrice)}</span>
                {deal.dealPrice !== null ? (
                  <span className="groupbuy-deal-original">{formatListPrice(currency, deal.originalPrice)}</span>
                ) : null}
              </div>
              <div className="groupbuy-deal-meta">
                <span>{t.purchaseCount}—</span>
                <span>{t.redemptionCount}—</span>
              </div>
            </div>
            <button type="button" className="button button-primary button-compact groupbuy-deal-cta" onClick={() => handleView(deal.id)}>
              {t.viewBtn}
            </button>
          </div>
        ))}

        <button type="button" className="groupbuy-add-btn" onClick={() => { setActiveDealId(null); setMode('create'); }}>
          {t.addBtn}
        </button>
      </div>
    </div>
  );
}
