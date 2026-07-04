'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { glossaryById } from '@/data/glossary';
import type { MockGroupbuyMeta } from '@/data/mock-groupbuy-deals';
import type { GroupbuyDeal } from '@/domain/groupbuy';
import {
  formatAvailability,
  formatBenefitSharing,
  formatPurchaseLimit,
  formatSaleChannel,
  formatSaleEnd,
  formatSaleStart,
  formatValidity,
} from '@/domain/groupbuy-display';
import { SERVICE_GROUPS } from '@/domain/groupbuy-service-groups';

type GroupbuyDetailProps = {
  language: 'zh-CN' | 'en';
  currency: string;
  deal: GroupbuyDeal;
  meta: MockGroupbuyMeta;
  onBack: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onUnlist: () => void;
  onRelist: () => void;
};

function itemName(catalogItemId: string, language: 'zh-CN' | 'en'): string {
  const entry = glossaryById.get(catalogItemId);
  if (!entry) return catalogItemId;
  return language === 'zh-CN' ? entry.name_zh : entry.name_en;
}

function AccordionItem({
  label,
  summary,
  children,
}: {
  label: string;
  summary?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="groupbuy-service-accordion groupbuy-detail-accordion">
      <button
        type="button"
        className="groupbuy-service-accordion-header"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="groupbuy-detail-accordion-label">
          {label}
          {summary && !open ? (
            <span className="groupbuy-detail-accordion-summary">{summary}</span>
          ) : null}
        </span>
        <span className="groupbuy-service-accordion-chevron" aria-hidden="true">
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open ? <div className="groupbuy-service-accordion-body groupbuy-detail-accordion-body">{children}</div> : null}
    </section>
  );
}

export function GroupbuyDetail({
  language,
  currency,
  deal,
  meta,
  onBack,
  onEdit,
  onCopy,
  onUnlist,
  onRelist,
}: GroupbuyDetailProps) {
  const enabledSelections = deal.serviceSelections.filter((s) => s.enabled);

  const serviceAccordionContent = SERVICE_GROUPS.map((group) => {
    const selected = group.ids
      .map((id) => enabledSelections.find((s) => s.catalogItemId === id))
      .filter(Boolean);
    if (selected.length === 0) return null;
    return (
      <div key={group.id} className="groupbuy-detail-service-group">
        <p className="groupbuy-detail-service-group-label">{group.label}</p>
        {selected.map((s) => (
          <div key={s!.catalogItemId} className="groupbuy-detail-service-row">
            <span>{itemName(s!.catalogItemId, language)}</span>
            {s!.quantity > 1 ? (
              <span className="groupbuy-detail-service-qty">×{s!.quantity}</span>
            ) : null}
          </div>
        ))}
      </div>
    );
  }).filter(Boolean);

  const isUnlisted = deal.status === 'unlisted';

  return (
    <div className="groupbuy-wizard groupbuy-detail">
      {/* ── top bar ── */}
      <div className="groupbuy-wizard-topbar">
        <button type="button" className="groupbuy-back-btn" onClick={onBack}>
          返回
        </button>
        <p className="groupbuy-detail-title-bar">
          <span className="groupbuy-detail-heading">{deal.title}</span>
          {deal.status === 'draft' ? (
            <span className="groupbuy-status-pill">草稿</span>
          ) : isUnlisted ? (
            <span className="groupbuy-status-pill groupbuy-status-pill--unlisted">已下架</span>
          ) : null}
        </p>
      </div>

      <div className="groupbuy-step-panel groupbuy-detail-body">
        {/* ── summary strip ── */}
        <div className="groupbuy-detail-summary">
          <div className="groupbuy-deal-price-row">
            <span className="groupbuy-deal-price">
              {currency} {deal.dealPrice ?? deal.originalPrice}
            </span>
            {deal.dealPrice !== null && deal.dealPrice !== deal.originalPrice ? (
              <span className="groupbuy-deal-original">
                {currency} {deal.originalPrice}
              </span>
            ) : null}
          </div>
          <div className="groupbuy-deal-meta">
            <span>购买次数 {meta.purchaseCount}</span>
            <span>核销次数 {meta.redemptionCount}</span>
          </div>
        </div>

        {/* ── accordion stack ── */}
        <div className="groupbuy-detail-accordions">
          <AccordionItem
            label="服务内容"
            summary={enabledSelections.length > 0 ? `已选 ${enabledSelections.length} 项` : '未选'}
          >
            {serviceAccordionContent.length > 0 ? serviceAccordionContent : <p className="groupbuy-detail-empty">暂无选中服务</p>}
          </AccordionItem>

          <AccordionItem label="价格设置">
            <div className="groupbuy-detail-field-row">
              <span>团购价</span>
              <span>{currency} {deal.dealPrice ?? '—'}</span>
            </div>
            <div className="groupbuy-detail-field-row">
              <span>服务原价</span>
              <span>{currency} {deal.originalPrice}</span>
            </div>
          </AccordionItem>

          <AccordionItem label="售卖开始时间">
            <p className="groupbuy-detail-field-value">{formatSaleStart(deal.saleStart)}</p>
          </AccordionItem>

          <AccordionItem label="售卖结束时间">
            <p className="groupbuy-detail-field-value">{formatSaleEnd(deal.saleEnd)}</p>
          </AccordionItem>

          <AccordionItem label="售卖渠道">
            <p className="groupbuy-detail-field-value">{formatSaleChannel(deal.saleChannel)}</p>
          </AccordionItem>

          <AccordionItem label="团购使用有效期">
            <p className="groupbuy-detail-field-value">{formatValidity(deal.validity)}</p>
          </AccordionItem>

          <AccordionItem label="可用时段">
            <p className="groupbuy-detail-field-value">{formatAvailability(deal.availability)}</p>
          </AccordionItem>

          <AccordionItem label="优惠同享信息">
            <p className="groupbuy-detail-field-value">{formatBenefitSharing(deal.benefitSharing)}</p>
          </AccordionItem>

          <AccordionItem label="单人购买量限制">
            <p className="groupbuy-detail-field-value">{formatPurchaseLimit(deal.purchaseLimit)}</p>
          </AccordionItem>
        </div>
      </div>

      {/* ── bottom action bar ── */}
      <div className="groupbuy-wizard-footer groupbuy-detail-footer">
        <Button variant="secondary" onClick={onEdit}>修改</Button>
        <Button variant="secondary" onClick={onCopy}>复制</Button>
        {isUnlisted ? (
          <Button onClick={onRelist}>上架</Button>
        ) : (
          <Button variant="ghost" onClick={onUnlist}>下架</Button>
        )}
      </div>
    </div>
  );
}
