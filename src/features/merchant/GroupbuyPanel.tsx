'use client';

import { useEffect, useState } from 'react';
import { glossaryById } from '@/data/glossary';
import type { GlossaryEntrySettings } from '@/data/glossary-settings-store';
import type { GroupbuyDeal } from '@/domain/groupbuy';
import {
  listGroupbuyDeals,
  publishGroupbuyDeal,
  saveGroupbuyDraft,
} from '@/lib/repositories/local/groupbuy-repository';
import { GroupbuyWizard } from '@/features/merchant/GroupbuyWizard';

type GroupDealCard = {
  id: string;
  title: string;
  elements: string[];
  price: number;
  originalPrice: number;
  purchaseCount: number;
  redemptionCount: number;
  status?: GroupbuyDeal['status'];
};

type GroupbuyPanelProps = {
  language: 'zh-CN' | 'en';
  currency: string;
  settingsById: Map<string, GlossaryEntrySettings>;
};

const mockDeals: GroupDealCard[] = [
  {
    id: 'deal-001',
    title: '韩系裸粉猫眼通勤款',
    elements: ['猫眼', '裸粉', '腮红'],
    price: 39,
    originalPrice: 48,
    purchaseCount: 142,
    redemptionCount: 89,
  },
  {
    id: 'deal-002',
    title: '冰透极光魔镜款',
    elements: ['魔镜粉', '极光粉', '渐变'],
    price: 55,
    originalPrice: 68,
    purchaseCount: 98,
    redemptionCount: 61,
  },
  {
    id: 'deal-003',
    title: '法式珍珠新娘款',
    elements: ['法式', '珍珠', '亮片'],
    price: 49,
    originalPrice: 63,
    purchaseCount: 76,
    redemptionCount: 44,
  },
  {
    id: 'deal-004',
    title: 'Y2K蝴蝶结重钻派对款',
    elements: ['全贴甲片', '蝴蝶结', '重钻'],
    price: 99,
    originalPrice: 123,
    purchaseCount: 53,
    redemptionCount: 27,
  },
  {
    id: 'deal-005',
    title: '度假贝壳水墨晕染款',
    elements: ['水墨晕染', '贝壳片', '金箔'],
    price: 62,
    originalPrice: 78,
    purchaseCount: 34,
    redemptionCount: 18,
  },
];

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
  },
} as const;

function catalogItemName(catalogItemId: string, language: 'zh-CN' | 'en'): string {
  const entry = glossaryById.get(catalogItemId);
  if (!entry) return catalogItemId;
  return language === 'zh-CN' ? entry.name_zh : entry.name_en;
}

function toLocalDealCard(deal: GroupbuyDeal, language: 'zh-CN' | 'en'): GroupDealCard {
  return {
    id: deal.id,
    title: deal.title,
    elements: deal.serviceSelections
      .filter((selection) => selection.enabled)
      .map((selection) => catalogItemName(selection.catalogItemId, language)),
    price: deal.dealPrice ?? deal.originalPrice,
    originalPrice: deal.originalPrice,
    purchaseCount: 0,
    redemptionCount: 0,
    status: deal.status,
  };
}

function mergeSavedDeal(savedDeal: GroupbuyDeal, persistedDeals: GroupbuyDeal[], currentDeals: GroupbuyDeal[]) {
  const seen = new Set<string>();
  return [savedDeal, ...persistedDeals, ...currentDeals].filter((deal) => {
    if (seen.has(deal.id)) return false;
    seen.add(deal.id);
    return true;
  });
}

function formatListPrice(currency: string, price: number) {
  return `${currency} ${price}`;
}

export function GroupbuyPanel({ language, currency, settingsById }: GroupbuyPanelProps) {
  const t = copy[language];
  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [localDeals, setLocalDeals] = useState<GroupbuyDeal[]>([]);

  function refreshLocalDeals() {
    setLocalDeals(listGroupbuyDeals());
  }

  useEffect(() => {
    refreshLocalDeals();
  }, []);

  function finishWithSavedDeal(saveDeal: (deal: GroupbuyDeal) => GroupbuyDeal, deal: GroupbuyDeal) {
    const savedDeal = saveDeal(deal);
    const persistedDeals = listGroupbuyDeals();
    setLocalDeals((currentDeals) => mergeSavedDeal(savedDeal, persistedDeals, currentDeals));
    setMode('list');
  }

  if (mode === 'create') {
    return (
      <div className="manage-panel-content groupbuy-panel">
        <GroupbuyWizard
          language={language}
          currency={currency}
          settingsById={settingsById}
          onCancel={() => setMode('list')}
          onSaveDraft={(deal) => finishWithSavedDeal(saveGroupbuyDraft, deal)}
          onPublish={(deal) => finishWithSavedDeal(publishGroupbuyDeal, deal)}
        />
      </div>
    );
  }

  const deals = [...localDeals.map((deal) => toLocalDealCard(deal, language)), ...mockDeals];

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
        {deals.map((deal) => (
          <div key={deal.id} className="groupbuy-deal-card">
            <div className="groupbuy-deal-body">
              <p className="groupbuy-deal-title">
                {deal.title}
                {deal.status === 'draft' ? (
                  <span className="groupbuy-status-pill">{t.draftStatus}</span>
                ) : null}
              </p>
              <div className="groupbuy-deal-elements">
                {deal.elements.map((el) => (
                  <span key={el} className="groupbuy-element-tag">{el}</span>
                ))}
              </div>
              <div className="groupbuy-deal-price-row">
                <span className="groupbuy-deal-price">{formatListPrice(currency, deal.price)}</span>
                <span className="groupbuy-deal-original">{formatListPrice(currency, deal.originalPrice)}</span>
              </div>
              <div className="groupbuy-deal-meta">
                <span>{t.purchaseCount}{deal.purchaseCount}</span>
                <span>{t.redemptionCount}{deal.redemptionCount}</span>
              </div>
            </div>
            <button type="button" className="button button-primary button-compact groupbuy-deal-cta">
              {t.viewBtn}
            </button>
          </div>
        ))}

        {/* ── Add Deal Button ── */}
        <button type="button" className="groupbuy-add-btn" onClick={() => setMode('create')}>
          {t.addBtn}
        </button>
      </div>
    </div>
  );
}
