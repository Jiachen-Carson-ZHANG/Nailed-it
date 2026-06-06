// Catalog domain contract — see ADR-0005. Source of truth is the Lark "Disctionary" sheet,
// generated into src/mock/catalog.ts. Catalog = what CAN be priced (platform level);
// per-merchant values live separately in merchant_pricing (P2).
//
// Enums are declared as const arrays so they are runtime-checkable (used by the catalog
// integrity tests and mirrored by the DB CHECK constraints in migration 0002).

export const catalogItemTypes = [
  'service_module',
  'procedure',
  'billable_component',
  'visual_attribute',
  'complexity_level',
  'style_tag'
] as const;
export type CatalogItemType = (typeof catalogItemTypes)[number];

export const triStates = ['yes', 'no', 'optional'] as const;
export type TriState = (typeof triStates)[number];

export const yesNoValues = ['yes', 'no'] as const;
export type YesNo = (typeof yesNoValues)[number];

export const aiDetectableValues = ['yes', 'no', 'weak', 'user_confirmed'] as const;
export type AiDetectable = (typeof aiDetectableValues)[number];

export const durationConfigLevels = [
  'platform_default',
  'merchant_optional',
  'merchant_level',
  'staff_level',
  'none'
] as const;
export type DurationConfigLevel = (typeof durationConfigLevels)[number];

export const pricingUnits = [
  'fixed',
  'included',
  'per_finger',
  'per_level',
  'per_piece',
  'per_set',
  'tag_only'
] as const;
export type PricingUnit = (typeof pricingUnits)[number];

/** A chosen catalog item + quantity — the unit a quote is built from. */
export type CatalogSelection = {
  catalogItemId: string;
  quantity: number;
};

export type CatalogItem = {
  id: string;
  nameZh: string;
  type: CatalogItemType;
  category: string;
  parentId: string | null;
  userVisible: YesNo;
  aiDetectable: AiDetectable;
  billable: TriState;
  merchantPriceRequired: TriState;
  merchantDurationRequired: TriState;
  durationConfigLevel: DurationConfigLevel;
  affectsBookingDuration: TriState;
  defaultDurationMin: number | null;
  allowedPricingUnits: PricingUnit[];
  defaultPricingUnit: PricingUnit;
  /** Platform default price in cents (null = no platform default; merchant must price it). */
  defaultPriceCents: number | null;
  quantitySupported: TriState;
  complexitySupported: YesNo;
  notes: string;
};

/**
 * Packages whose booking time is the SUM of their non-billable, time-only child steps rather than
 * their own stored duration. This is an EXPLICIT policy, not inferred from child billability:
 * other container parents (color_effect_service, finish_service) also have billable='no' children
 * but must keep their own duration. Eventually this belongs in the Lark Dictionary as a column;
 * until then it is a curated allowlist (product decision 2026-06-06).
 */
export const durationAggregatingPackageIds = new Set<string>(['basic_manicure_service']);

/**
 * The effective service duration of selecting this item, in minutes.
 *
 * For an aggregating package (see `durationAggregatingPackageIds`) — e.g. the base manicure, whose
 * clean / cuticle / prep / shaping sub-steps each carry time but no price — the booking time is the
 * SUM of those child steps. For every other item it is the item's own default duration.
 */
export function effectiveDurationMin(item: CatalogItem, catalog: CatalogItem[]): number {
  if (durationAggregatingPackageIds.has(item.id)) {
    const timeOnlyChildren = catalog.filter((c) => c.parentId === item.id && c.billable === 'no');
    if (timeOnlyChildren.length > 0) {
      return timeOnlyChildren.reduce((sum, c) => sum + (c.defaultDurationMin ?? 0), 0);
    }
  }
  return item.defaultDurationMin ?? 0;
}
