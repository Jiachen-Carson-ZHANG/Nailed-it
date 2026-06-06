import Link from 'next/link';
import type { CatalogItemType, CatalogSelection, PricingUnit } from '@/domain/catalog';
import type { PublishedMerchantStyle } from '@/domain/merchant-style';
import type { AIRecognitionResult, StyleDiscoveryFacet, StyleDiscoveryFacetKind } from '@/domain/nail';
import { getCustomerBookingPath, getCustomerTryOnPath } from '@/domain/session';
import { catalogItems } from '@/mock/catalog';

const catalogById = new Map(catalogItems.map((item) => [item.id, item]));

const TYPE_ZH: Record<CatalogItemType, string> = {
  service_module: '服务',
  procedure: '工序',
  billable_component: '收费项',
  visual_attribute: '视觉',
  complexity_level: '复杂度',
  style_tag: '风格',
};

const TYPE_BADGE_CLASS: Record<CatalogItemType, string> = {
  service_module: 'breakdown-category-base',
  billable_component: 'breakdown-category-color_style',
  procedure: 'breakdown-category-other',
  visual_attribute: 'breakdown-category-shape',
  complexity_level: 'breakdown-category-addon',
  style_tag: 'breakdown-category-addon',
};

const UNIT_ZH: Partial<Record<PricingUnit, string>> = {
  per_piece: '颗',
  per_finger: '指',
  per_set: '套',
};

type StyleLayer = {
  id: string;
  nameZh: string;
  quantity: number;
  type: CatalogItemType;
  typeZh: string;
  unitZh: string;
};

function buildLayers(breakdown: CatalogSelection[]): StyleLayer[] {
  return breakdown.flatMap((selection) => {
    const item = catalogById.get(selection.catalogItemId);
    if (!item) return [];
    return [{
      id: selection.catalogItemId,
      nameZh: item.nameZh,
      quantity: selection.quantity,
      type: item.type,
      typeZh: TYPE_ZH[item.type],
      unitZh: UNIT_ZH[item.defaultPricingUnit] ?? '',
    }];
  });
}

const FACET_KIND_ZH: Record<StyleDiscoveryFacetKind, string> = {
  shape: '甲形',
  style: '风格',
  addon: '加项',
  mood: '氛围',
  lifestyle: '场景',
};
const FACET_KIND_ORDER: StyleDiscoveryFacetKind[] = ['shape', 'style', 'addon', 'mood', 'lifestyle'];

function groupFacets(facets: StyleDiscoveryFacet[]) {
  return FACET_KIND_ORDER.flatMap((kind) => {
    const values = Array.from(new Set(facets.filter((facet) => facet.kind === kind).map((facet) => facet.label)));
    return values.length > 0 ? [{ kind, label: FACET_KIND_ZH[kind], values }] : [];
  });
}

type StyleDetailPanelProps = {
  backHref: string;
  recognition: AIRecognitionResult | null;
  style: PublishedMerchantStyle;
};

export function StyleDetailPanel({ backHref, recognition, style }: StyleDetailPanelProps) {
  const layers = buildLayers(style.catalogBreakdown);
  const facetGroups = groupFacets(style.discoveryFacets);
  const brief = style.description.trim()
    || recognition?.selection.otherNotes
    || 'Published by the merchant and ready to use as your booking reference.';

  return (
    <article className="style-detail-panel">
      <div className="style-detail-hero">
        <img alt={style.title} className="style-detail-image" src={style.imageUrl} />
        <div className="style-detail-summary">
          <h1>{style.title}</h1>
          <p>{brief}</p>
        </div>
      </div>

      <div className="analyze-summary-bar">
        <div className="analyze-summary-item">
          <span className="analyze-summary-label">参考总价</span>
          <span className="analyze-summary-value">
            {style.previewQuote.price > 0 ? `$${style.previewQuote.price.toFixed(2)}` : '—'}
          </span>
        </div>
        <div className="analyze-summary-divider" />
        <div className="analyze-summary-item">
          <span className="analyze-summary-label">参考时长</span>
          <span className="analyze-summary-value">
            {style.previewQuote.duration > 0 ? `${style.previewQuote.duration} 分钟` : '—'}
          </span>
        </div>
      </div>

      {layers.length > 0 ? (
        <section className="detail-surface" aria-labelledby="style-detail-layers-title">
          <div className="detail-surface-header">
            <h2 id="style-detail-layers-title">款式构成</h2>
          </div>
          <ul className="detail-layer-list">
            {layers.map((layer) => (
              <li className="detail-layer" key={layer.id}>
                <span className={`breakdown-category-badge ${TYPE_BADGE_CLASS[layer.type]}`}>{layer.typeZh}</span>
                <span className="detail-layer-name">{layer.nameZh}</span>
                {layer.quantity > 1 ? (
                  <span className="detail-layer-qty">×{layer.quantity}{layer.unitZh}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {facetGroups.length > 0 ? (
        <section className="detail-surface" aria-labelledby="style-detail-tags-title">
          <div className="detail-surface-header">
            <h2 id="style-detail-tags-title">风格标签</h2>
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
          Book this look
        </Link>
        <Link className="button button-ghost button-block" href={getCustomerTryOnPath(style.id)}>
          Try on this look
        </Link>
        <p className="detail-merchant-line">At <strong>Nailed-it Studio</strong> · Free cancellation up to 24 h before</p>
        <Link className="detail-back-link" href={backHref}>← Back to discovery</Link>
      </div>
    </article>
  );
}
