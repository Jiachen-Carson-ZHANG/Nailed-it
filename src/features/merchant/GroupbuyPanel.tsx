'use client';

import { useEffect, useState } from 'react';
import { glossaryById } from '@/data/glossary';
import type { GlossaryEntrySettings } from '@/data/glossary-settings-store';
import type { GroupbuyDeal } from '@/domain/groupbuy';
import {
  copyGroupbuyDeal,
  getGroupbuyDealById,
  listAllGroupbuyDeals,
  publishGroupbuyDeal,
  relistGroupbuyDeal,
  saveGroupbuyDraft,
  unlistGroupbuyDeal,
} from '@/lib/repositories/local/groupbuy-repository';
import type { GroupbuyListEntry } from '@/lib/repositories/local/groupbuy-repository';
import { GroupbuyDetail } from '@/features/merchant/GroupbuyDetail';
import { GroupbuyWizard } from '@/features/merchant/GroupbuyWizard';

type GroupbuyPanelMode = 'list' | 'detail' | 'create' | 'edit';

type GroupbuyPanelProps = {
  language: 'zh-CN' | 'en';
  currency: string;
  settingsById: Map<string, GlossaryEntrySettings>;
};

const aiSuggestions = [
  {
    id: 'sug-001',
    text: '补足工作日空档的套餐：工作日仍有可释放产能，可通过团购套餐引流填充档期…',
  },
  {
    id: 'sug-002',
    text: '基础款套餐价格更新：月度核销量下降40%，已为您自动生成价格调整建议…',
  },
];

const copy = {
  'zh-CN': {
    aiHeader: 'AI助手',
    aiCta: '查看',
    listHeader: '团购列表',
    viewBtn: '查看',
    addBtn: '+ 添加团购',
    purchaseCount: '购买次数 ',
    redemptionCount: '核销次数 ',
    draftStatus: '草稿',
    unlistedStatus: '已下架',
  },
  en: {
    aiHeader: 'AI assistant',
    aiCta: 'View',
    listHeader: 'Deal list',
    viewBtn: 'View',
    addBtn: '+ Add deal',
    purchaseCount: 'Purchases: ',
    redemptionCount: 'Redeemed: ',
    draftStatus: 'Draft',
    unlistedStatus: 'Unlisted',
  },
} as const;

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
  const [allEntries, setAllEntries] = useState<GroupbuyListEntry[]>([]);

  function refreshEntries() {
    setAllEntries(listAllGroupbuyDeals());
  }

  useEffect(() => {
    refreshEntries();
  }, []);

  function activeDeal(): GroupbuyDeal | undefined {
    if (!activeDealId) return undefined;
    return getGroupbuyDealById(activeDealId);
  }

  function activeMeta() {
    const entry = allEntries.find((e) => e.deal.id === activeDealId);
    return entry?.meta ?? { purchaseCount: 0, redemptionCount: 0 };
  }

  function handleViewDeal(id: string) {
    setActiveDealId(id);
    setMode('detail');
  }

  function handleSaveDeal(saveFn: (deal: GroupbuyDeal) => GroupbuyDeal, deal: GroupbuyDeal) {
    saveFn(deal);
    refreshEntries();
    if (mode === 'edit') {
      setMode('detail');
    } else {
      setActiveDealId(null);
      setMode('list');
    }
  }

  function handleCopy(deal: GroupbuyDeal) {
    copyGroupbuyDeal(deal);
    refreshEntries();
    setActiveDealId(null);
    setMode('list');
  }

  function handleUnlist(id: string) {
    unlistGroupbuyDeal(id);
    refreshEntries();
  }

  function handleRelist(id: string) {
    relistGroupbuyDeal(id);
    refreshEntries();
  }

  // ── detail mode ──────────────────────────────────────────────────────────────
  if (mode === 'detail') {
    const deal = activeDeal();
    if (!deal) {
      setMode('list');
      return null;
    }
    const meta = activeMeta();
    return (
      <div className="manage-panel-content groupbuy-panel">
        <GroupbuyDetail
          language={language}
          currency={currency}
          deal={deal}
          meta={meta}
          onBack={() => { setActiveDealId(null); setMode('list'); }}
          onEdit={() => setMode('edit')}
          onCopy={() => handleCopy(deal)}
          onUnlist={() => handleUnlist(deal.id)}
          onRelist={() => handleRelist(deal.id)}
        />
      </div>
    );
  }

  // ── create / edit mode ───────────────────────────────────────────────────────
  if (mode === 'create' || mode === 'edit') {
    const initialDeal = mode === 'edit' ? activeDeal() : undefined;
    return (
      <div className="manage-panel-content groupbuy-panel">
        <GroupbuyWizard
          language={language}
          currency={currency}
          settingsById={settingsById}
          initialDeal={initialDeal}
          onCancel={() => {
            if (mode === 'edit') {
              setMode('detail');
            } else {
              setActiveDealId(null);
              setMode('list');
            }
          }}
          onSaveDraft={(deal) => handleSaveDeal(saveGroupbuyDraft, deal)}
          onPublish={(deal) => handleSaveDeal(publishGroupbuyDeal, deal)}
        />
      </div>
    );
  }

  // ── list mode ────────────────────────────────────────────────────────────────
  return (
    <div className="manage-panel-content groupbuy-panel">
      {/* ── AI Assistant Card ── */}
      <div className="groupbuy-ai-card">
        <p className="groupbuy-ai-header">{t.aiHeader}</p>
        <ul className="groupbuy-ai-list">
          {aiSuggestions.map((sug) => (
            <li key={sug.id} className="groupbuy-ai-suggestion">
              <span className="groupbuy-ai-text">{sug.text}</span>
              <button type="button" className="button button-primary button-compact groupbuy-ai-cta">
                {t.aiCta}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Deal List ── */}
      <div className="manage-section-heading">{t.listHeader}</div>
      <div className="groupbuy-deal-list">
        {allEntries.map(({ deal, meta }) => (
          <div key={deal.id} className="groupbuy-deal-card">
            <div className="groupbuy-deal-body">
              <p className="groupbuy-deal-title">
                {deal.title}
                {deal.status === 'draft' ? (
                  <span className="groupbuy-status-pill">{t.draftStatus}</span>
                ) : deal.status === 'unlisted' ? (
                  <span className="groupbuy-status-pill groupbuy-status-pill--unlisted">{t.unlistedStatus}</span>
                ) : null}
              </p>
              <div className="groupbuy-deal-elements">
                {deal.serviceSelections
                  .filter((s) => s.enabled)
                  .slice(0, 4)
                  .map((s) => (
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
                <span>{t.purchaseCount}{meta.purchaseCount}</span>
                <span>{t.redemptionCount}{meta.redemptionCount}</span>
              </div>
            </div>
            <button
              type="button"
              className="button button-primary button-compact groupbuy-deal-cta"
              onClick={() => handleViewDeal(deal.id)}
            >
              {t.viewBtn}
            </button>
          </div>
        ))}

        {/* ── Add Deal Button ── */}
        <button type="button" className="groupbuy-add-btn" onClick={() => { setActiveDealId(null); setMode('create'); }}>
          {t.addBtn}
        </button>
      </div>
    </div>
  );
}
