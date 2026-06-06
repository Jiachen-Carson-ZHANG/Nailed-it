import Link from 'next/link';
import type { CatalogItemType, CatalogSelection, PricingUnit } from '@/domain/catalog';
import type { PublishedMerchantStyle } from '@/domain/merchant-style';
import type { AIRecognitionResult, PricingItem, StyleDiscoveryFacet, StyleDiscoveryFacetKind } from '@/domain/nail';
import { pricingTargetLabels } from '@/domain/nail';
import { getCustomerBookingPath, getCustomerTryOnPath } from '@/domain/session';
import { catalogItems } from '@/mock/catalog';
import { defaultPricingRules } from '@/mock/pricing';

type BreakdownRow = { label: string; price: number; duration: number };

const rulesByTarget = new Map<string, PricingItem>(
  defaultPricingRules.map((r) => [r.target, r])
);

function buildBreakdown(recognition: AIRecognitionResult): BreakdownRow[] {
  const rows: BreakdownRow[] = [];

  const candidates = [
    ...recognition.selection.baseServices,
    recognition.selection.nailShape,
    ...recognition.selection.styles,
    ...recognition.selection.addons
  ];

  for (const key of candidates) {
    const rule = rulesByTarget.get(key);
    if (rule && rule.price > 0) {
      rows.push({ label: pricingTargetLabels[key as keyof typeof pricingTargetLabels] ?? key, price: rule.price, duration: rule.duration });
    }
  }
  return rows;
}

// ── Catalog layers: what the look is composed of (from the published catalogBreakdown) ─────────
const catalogById = new Map(catalogItems.map((c) => [c.id, c]));

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

// per_piece → 颗, per_finger → 指, per_set → 套; everything else has no countable unit suffix.
const UNIT_ZH: Partial<Record<PricingUnit, string>> = {
  per_piece: '颗',
  per_finger: '指',
  per_set: '套',
};

type StyleLayer = { id: string; nameZh: string; type: CatalogItemType; typeZh: string; quantity: number; unitZh: string };

function buildLayers(breakdown: CatalogSelection[]): StyleLayer[] {
  return breakdown.flatMap((sel) => {
    const item = catalogById.get(sel.catalogItemId);
    if (!item) return [];
    return [{
      id: sel.catalogItemId,
      nameZh: item.nameZh,
      type: item.type,
      typeZh: TYPE_ZH[item.type],
      quantity: sel.quantity,
      unitZh: UNIT_ZH[item.defaultPricingUnit] ?? '',
    }];
  });
}

// ── Discovery facets: descriptive style tags, grouped by kind ──────────────────────────────────
const FACET_KIND_ZH: Record<StyleDiscoveryFacetKind, string> = {
  shape: '甲形',
  style: '风格',
  addon: '加项',
  mood: '氛围',
  lifestyle: '场景',
};
const FACET_KIND_ORDER: StyleDiscoveryFacetKind[] = ['shape', 'style', 'addon', 'mood', 'lifestyle'];

function groupFacets(facets: StyleDiscoveryFacet[]): { kind: StyleDiscoveryFacetKind; label: string; values: string[] }[] {
  return FACET_KIND_ORDER.flatMap((kind) => {
    const values = Array.from(
      new Set(facets.filter((f) => f.kind === kind).map((f) => f.label)),
    );
    return values.length > 0 ? [{ kind, label: FACET_KIND_ZH[kind], values }] : [];
  });
}

type StyleDetailPanelProps = {
  backHref: string;
  recognition: AIRecognitionResult | null;
  style: PublishedMerchantStyle;
};

export function StyleDetailPanel({
  backHref,
  recognition,
  style
}: StyleDetailPanelProps) {
  const breakdown = recognition ? buildBreakdown(recognition) : [];
  const breakdownTotal = breakdown.reduce((s, r) => s + r.price, 0);
  const breakdownDuration = breakdown.reduce((s, r) => s + r.duration, 0);

  // Composition + tags come from the published merchant config (catalog breakdown + discovery
  // facets), not the legacy recognition shape — the latter is null for AI-configured styles.
  const layers = buildLayers(style.catalogBreakdown);
  const facetGroups = groupFacets(style.discoveryFacets);
  const brief = style.description.trim() || recognition?.selection.otherNotes
    || 'Published by the merchant and ready to use as your booking reference.';

  return (
    <article className="style-detail-panel">
      <div className="style-detail-hero">
        <img alt={style.title} className="style-detail-image" src={style.imageUrl} />
        <div className="style-detail-summary">
          <p className="section-eyebrow">Style brief</p>
          <h1>{style.title}</h1>
          <p>{brief}</p>
        </div>
      </div>

      <section className="detail-surface" aria-labelledby="style-detail-pricing-title">
        <div className="detail-surface-header">
          <h2 id="style-detail-pricing-title">Your quote</h2>
        </div>

        {breakdown.length > 0 && (
          <table className="breakdown-table" aria-label="Price breakdown">
            <tbody>
              {breakdown.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td className="breakdown-duration">{row.duration} min</td>
                  <td className="breakdown-price">${row.price}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="breakdown-total">
                <td>Total</td>
                <td className="breakdown-duration">{breakdownDuration} min</td>
                <td className="breakdown-price">${breakdownTotal}</td>
              </tr>
            </tfoot>
          </table>
        )}

        <div className="detail-final-quote">
          <strong>${style.previewQuote.price}</strong>
          <p>{style.previewQuote.duration} min · merchant price</p>
        </div>
      </section>

      {layers.length > 0 && (
        <section className="detail-surface" aria-labelledby="style-detail-layers-title">
          <div className="detail-surface-header">
            <h2 id="style-detail-layers-title">款式构成</h2>
          </div>
          <ul className="detail-layer-list">
            {layers.map((layer) => (
              <li key={layer.id} className="detail-layer">
                <span className={`breakdown-category-badge ${TYPE_BADGE_CLASS[layer.type]}`}>{layer.typeZh}</span>
                <span className="detail-layer-name">{layer.nameZh}</span>
                {layer.quantity > 1 && (
                  <span className="detail-layer-qty">×{layer.quantity}{layer.unitZh}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {facetGroups.length > 0 && (
        <section className="detail-surface" aria-labelledby="style-detail-tags-title">
          <div className="detail-surface-header">
            <h2 id="style-detail-tags-title">风格标签</h2>
          </div>
          <div className="detail-selection-list">
            {facetGroups.map((group) => (
              <div key={group.kind} className="detail-selection-group">
                <span>{group.label}</span>
                <div className="style-tag-row">
                  {group.values.map((value) => (
                    <span key={value} className="style-tag style-tag-readonly">
                      {value}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="detail-actions">
        <Link className="button button-primary button-block" href={`${getCustomerBookingPath()}?styleId=${style.id}`}>
          {recognition ? 'Book this look' : 'Analyze and book this look'}
        </Link>
        <Link className="button button-ghost button-block" href={getCustomerTryOnPath(style.id)}>
          Try on this look
        </Link>
        <p className="detail-merchant-line">At <strong>Nailed-it Studio</strong> · Free cancellation up to 24 h before</p>
        <Link className="detail-back-link" href={backHref}>
          ← Back to discovery
        </Link>
      </div>
    </article>
  );
}
