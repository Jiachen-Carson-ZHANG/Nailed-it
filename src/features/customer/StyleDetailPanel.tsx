'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatCurrency, formatDuration } from '@/i18n/format';
import { pickLocalizedText } from '@/i18n/localized';
import { useLanguage } from '@/i18n/context';
import type { CatalogSelection } from '@/domain/catalog';
import type { PublishedMerchantStyle } from '@/domain/merchant-style';
import type { AIRecognitionResult, BreakdownResult, GlossaryBreakdownItem, StyleDiscoveryFacet, StyleDiscoveryFacetKind } from '@/domain/nail';
import type { QuoteLine } from '@/lib/services/quote-service';
import { saveCustomerBookingDraft } from '@/domain/booking-draft';
import { getCustomerBookingConfirmPath, getCustomerTryOnPath } from '@/domain/session';
import { catalogItems } from '@/mock/catalog';
import { mockAIResult } from '@/mock/ai';
import { ComponentBreakdownPanel } from '@/features/customer/ComponentBreakdownPanel';

const catalogById = new Map(catalogItems.map((item) => [item.id, item]));
const BASE_MANICURE_ID = 'basic_manicure_service';

const TYPE_ZH: Record<string, string> = {
  service_module: '服务',
  procedure: '工序',
  billable_component: '收费项',
  visual_attribute: '视觉',
  complexity_level: '复杂度',
  style_tag: '风格',
};

function buildCachedBreakdown(breakdown: CatalogSelection[], quoteLines: QuoteLine[]): BreakdownResult {
  const lineById = new Map(quoteLines.map((l) => [l.catalogItemId, l]));

  const items: GlossaryBreakdownItem[] = breakdown.flatMap((sel) => {
    const item = catalogById.get(sel.catalogItemId);
    if (!item) return [];
    // Filter out container service modules (grouping parents) — keep only the base manicure
    if (item.type === 'service_module' && sel.catalogItemId !== BASE_MANICURE_ID) return [];
    const line = lineById.get(sel.catalogItemId);
    return [{
      mode: 'glossary' as const,
      glossaryId: sel.catalogItemId,
      glossaryType: item.type as GlossaryBreakdownItem['glossaryType'],
      nameZh: item.nameZh,
      typeZh: TYPE_ZH[item.type] ?? item.type,
      parentId: item.parentId ?? 'na',
      parentNameZh: '',
      quantity: sel.quantity,
      unit: item.defaultPricingUnit,
      price: line ? line.linePriceCents / 100 / sel.quantity : 0,
      duration: line?.affectsDuration
        ? line.durationMin / (item.type === 'billable_component' ? sel.quantity : 1)
        : (item.defaultDurationMin ?? 0),
    }];
  });

  const PRICED = new Set(['service_module', 'billable_component']);
  const totalPrice    = items.filter((i) => PRICED.has(i.glossaryType)).reduce((s, i) => s + i.price * i.quantity, 0);
  const totalDuration = items.filter((i) => PRICED.has(i.glossaryType)).reduce((s, i) =>
    s + (i.glossaryType === 'billable_component' ? i.duration * i.quantity : i.duration), 0);

  return { items, catalogSelections: breakdown, totalPrice, totalDuration, mode: 'glossary' };
}

const facetKindLabels: Record<'zh-CN' | 'en', Record<StyleDiscoveryFacetKind, string>> = {
  'zh-CN': {
    shape: '甲形',
    style: '风格',
    addon: '加项',
    mood: '氛围',
    lifestyle: '场景',
  },
  en: {
    shape: 'Shape',
    style: 'Style',
    addon: 'Add-on',
    mood: 'Mood',
    lifestyle: 'Lifestyle',
  },
};
const FACET_KIND_ORDER: StyleDiscoveryFacetKind[] = ['shape', 'style', 'addon', 'mood', 'lifestyle'];

function groupFacets(facets: StyleDiscoveryFacet[], language: 'zh-CN' | 'en') {
  return FACET_KIND_ORDER.flatMap((kind) => {
    const values = Array.from(new Set(facets.filter((f) => f.kind === kind).map((f) => f.label)));
    return values.length > 0 ? [{ kind, label: facetKindLabels[language][kind], values }] : [];
  });
}

type StyleDetailPanelProps = {
  backHref: string;
  recognition: AIRecognitionResult | null;
  style: PublishedMerchantStyle;
  quoteLines?: QuoteLine[];
};

export function StyleDetailPanel({ backHref, recognition, style, quoteLines = [] }: StyleDetailPanelProps) {
  const router = useRouter();
  const { language, t } = useLanguage();
  const facetGroups = groupFacets(style.discoveryFacets, language);
  const title = style.titleLocalized ? pickLocalizedText(style.titleLocalized, language) : style.title;
  const brief = (style.descriptionLocalized ? pickLocalizedText(style.descriptionLocalized, language) : style.description).trim()
    || recognition?.selection.otherNotes
    || (language === 'zh-CN'
      ? '这个款式已由商家整理完成，可以直接作为你的预约参考。'
      : 'This style is merchant-reviewed and ready to use as your booking reference.');

  const initialBreakdown = buildCachedBreakdown(style.catalogBreakdown, quoteLines);
  const [currentBreakdown, setCurrentBreakdown] = useState<BreakdownResult>(initialBreakdown);

  function bookStyle() {
    saveCustomerBookingDraft({
      estimate: {
        source: 'pricing_rules',
        price: currentBreakdown.totalPrice,
        duration: currentBreakdown.totalDuration,
      },
      imageUrl: style.imageUrl,
      recognition: (recognition ?? mockAIResult) as AIRecognitionResult,
      catalogSelections: currentBreakdown.catalogSelections,
      styleId: style.id,
      styleTitle: style.title,
    });
    router.push(getCustomerBookingConfirmPath());
  }

  return (
    <article className="style-detail-panel">
      <Link className="detail-back-link detail-back-top" href={backHref}>← {t('style.detail.back')}</Link>
      <div className="style-detail-hero">
        <img alt={title} className="style-detail-image" src={style.imageUrl} />
        <div className="style-detail-summary">
          <h1>{title}</h1>
          <p>{brief}</p>
        </div>
      </div>

      <div className="analyze-summary-bar">
        <div className="analyze-summary-item">
          <span className="analyze-summary-label">{t('style.detail.totalPrice')}</span>
          <span className="analyze-summary-value">
            {style.previewQuote.price > 0
              ? formatCurrency({ cents: Math.round(style.previewQuote.price * 100), language })
              : '—'}
          </span>
        </div>
        <div className="analyze-summary-divider" />
        <div className="analyze-summary-item">
          <span className="analyze-summary-label">{t('style.detail.totalDuration')}</span>
          <span className="analyze-summary-value">
            {style.previewQuote.duration > 0 ? formatDuration({ minutes: style.previewQuote.duration, language }) : '—'}
          </span>
        </div>
      </div>

      <ComponentBreakdownPanel
        image={null}
        cachedResult={initialBreakdown}
        onResult={setCurrentBreakdown}
      />

      {facetGroups.length > 0 ? (
        <section className="detail-surface" aria-labelledby="style-detail-tags-title">
          <div className="detail-surface-header">
            <h2 id="style-detail-tags-title">{t('style.detail.tags')}</h2>
          </div>
          <div className="detail-selection-list">
            {facetGroups.map((group) => (
              <div className="detail-selection-group" key={group.kind}>
                <span>{group.label}</span>
                <div className="style-tag-row">
                  {group.values.map((value) => (
                    <span className="style-tag style-tag-readonly" key={value}>{value}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="detail-actions">
        <button className="button button-primary button-block" type="button" onClick={bookStyle}>
          {t('style.detail.book')}
        </button>
        <Link className="button button-secondary button-block" href={getCustomerTryOnPath(style.id)}>
          {t('style.detail.tryOn')}
        </Link>
      </div>
    </article>
  );
}
