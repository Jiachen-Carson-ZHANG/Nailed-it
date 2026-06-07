'use client';

import Link from 'next/link';
import { formatCurrency, formatDuration } from '@/i18n/format';
import { pickLocalizedText } from '@/i18n/localized';
import { useLanguage } from '@/i18n/context';
import {
  getCatalogItemName,
  getCatalogTypeLabel,
  type CatalogItemType,
  type CatalogSelection,
  type PricingUnit
} from '@/domain/catalog';
import type { PublishedMerchantStyle } from '@/domain/merchant-style';
import { BASE_MANICURE_CATALOG_ID } from '@/domain/style-selections';
import type { AIRecognitionResult, StyleDiscoveryFacet, StyleDiscoveryFacetKind } from '@/domain/nail';
import type { QuoteLine } from '@/lib/services/quote-service';
import { getCustomerBookingPath, getCustomerTryOnPath } from '@/domain/session';
import { catalogItems } from '@/mock/catalog';
import { demoCustomerId } from '@/mock/customers';
import { TrackOnMount } from '@/features/analytics/TrackOnMount';

const catalogById = new Map(catalogItems.map((item) => [item.id, item]));

const TYPE_BADGE_CLASS: Record<CatalogItemType, string> = {
  service_module: 'breakdown-category-base',
  billable_component: 'breakdown-category-color_style',
  procedure: 'breakdown-category-other',
  visual_attribute: 'breakdown-category-shape',
  complexity_level: 'breakdown-category-addon',
  style_tag: 'breakdown-category-addon',
};

const unitLabels: Record<'zh-CN' | 'en', Partial<Record<PricingUnit, string>>> = {
  'zh-CN': {
    per_piece: '颗',
    per_finger: '指',
    per_set: '套',
  },
  en: {
    per_piece: ' pcs',
    per_finger: ' fingers',
    per_set: ' sets',
  },
};

type StyleLayer = {
  id: string;
  name: string;
  quantity: number;
  type: CatalogItemType;
  typeLabel: string;
  unitLabel: string;
};

function buildLayers(
  breakdown: CatalogSelection[],
  language: 'zh-CN' | 'en',
): StyleLayer[] {
  return breakdown.flatMap((selection) => {
    const item = catalogById.get(selection.catalogItemId);
    if (!item) return [];
    return [{
      id: selection.catalogItemId,
      name: getCatalogItemName(item, language),
      quantity: selection.quantity,
      type: item.type,
      typeLabel: getCatalogTypeLabel(item.type, language),
      unitLabel: unitLabels[language][item.defaultPricingUnit] ?? '',
    }];
  });
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

function groupFacets(
  facets: StyleDiscoveryFacet[],
  language: 'zh-CN' | 'en',
) {
  return FACET_KIND_ORDER.flatMap((kind) => {
    const values = Array.from(new Set(facets.filter((facet) => facet.kind === kind).map((facet) => facet.label)));
    return values.length > 0 ? [{ kind, label: facetKindLabels[language][kind], values }] : [];
  });
}

type StyleDetailPanelProps = {
  backHref: string;
  recognition: AIRecognitionResult | null;
  style: PublishedMerchantStyle;
  /** Reference per-line price/duration for the breakdown, derived server-side (see page.tsx). */
  quoteLines?: QuoteLine[];
};

export function StyleDetailPanel({ backHref, recognition, style, quoteLines = [] }: StyleDetailPanelProps) {
  const { language, t } = useLanguage();
  const layers = buildLayers(style.catalogBreakdown, language);
  const lineById = new Map(quoteLines.map((line) => [line.catalogItemId, line]));
  // Drop container service modules (颜色与效果服务 / 美术设计服务 / 建构服务 …) — they are grouping parents,
  // not real line items. Only the base manicure is a genuine service_module row.
  const visibleLayers = layers.filter(
    (layer) => layer.type !== 'service_module' || layer.id === BASE_MANICURE_CATALOG_ID,
  );
  const facetGroups = groupFacets(style.discoveryFacets, language);
  const title = style.titleLocalized ? pickLocalizedText(style.titleLocalized, language) : style.title;
  const brief = (style.descriptionLocalized ? pickLocalizedText(style.descriptionLocalized, language) : style.description).trim()
    || recognition?.selection.otherNotes
    || (language === 'zh-CN'
      ? '这个款式已由商家整理完成，可以直接作为你的预约参考。'
      : 'This style is merchant-reviewed and ready to use as your booking reference.');

  return (
    <article className="style-detail-panel">
      <TrackOnMount
        eventType="style_detail_view"
        styleId={style.id}
        customerId={demoCustomerId}
        eventSource="style_detail"
      />
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

      {visibleLayers.length > 0 ? (
        <section className="detail-surface" aria-labelledby="style-detail-layers-title">
          <div className="detail-surface-header">
            <h2 id="style-detail-layers-title">{t('style.detail.breakdown')}</h2>
          </div>
          <table className="breakdown-table" aria-label={t('style.detail.breakdownTable')}>
            <tbody>
              {visibleLayers.map((layer) => {
                const line = lineById.get(layer.id);
                const durationMin = line && line.affectsDuration ? line.durationMin : 0;
                const priceCents = line ? line.linePriceCents : 0;
                return (
                  <tr key={layer.id}>
                    <td>
                      <span className={`breakdown-category-badge ${TYPE_BADGE_CLASS[layer.type]}`}>{layer.typeLabel}</span>
                      <span className="breakdown-label">{layer.name}</span>
                      {layer.quantity > 1 ? (
                        <span className="breakdown-qty"> ×{layer.quantity}{layer.unitLabel}</span>
                      ) : null}
                    </td>
                    <td className="breakdown-duration">{durationMin > 0 ? formatDuration({ minutes: durationMin, language }) : '—'}</td>
                    <td className="breakdown-price">{priceCents > 0 ? formatCurrency({ cents: priceCents, language }) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="breakdown-total">
                <td>{t('style.detail.total')}</td>
                <td className="breakdown-duration">{formatDuration({ minutes: style.previewQuote.duration, language })}</td>
                <td className="breakdown-price">{formatCurrency({ cents: Math.round(style.previewQuote.price * 100), language })}</td>
              </tr>
            </tfoot>
          </table>
        </section>
      ) : null}

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
        <Link className="button button-primary button-block" href={`${getCustomerBookingPath()}?styleId=${style.id}`}>
          {t('style.detail.book')}
        </Link>
        <Link className="button button-secondary button-block" href={getCustomerTryOnPath(style.id)}>
          {t('style.detail.tryOn')}
        </Link>
      </div>
    </article>
  );
}
