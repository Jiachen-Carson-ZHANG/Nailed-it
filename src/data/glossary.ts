// Glossary entries for the breakdown AI prompt. DERIVED from the canonical catalog
// (src/mock/catalog.ts) so the prompt can only ever name valid catalog ids — there is no
// hand-maintained second copy and no drift (the audit measured 114 glossary ids vs 109 catalog
// ids, with 7 dead ids the model could still emit). To change the glossary, edit the Lark
// Dictionary and regenerate catalog.ts.

import type { BilingualText, CatalogItem, CatalogItemType, TriState } from '@/domain/catalog';
import { catalogTypeLabels } from '@/domain/catalog';
import { catalogItems } from '@/mock/catalog';

export type GlossaryType = Extract<
  CatalogItemType,
  | 'service_module'
  | 'procedure'
  | 'billable_component'
  | 'visual_attribute'
  | 'style_tag'
  | 'complexity_level'
>;

export type AiDetectable = 'yes' | 'no' | 'weak' | 'user_confirmed';
export type BillableValue = boolean | 'optional';

export type GlossaryEntry = {
  id: string;
  name: BilingualText;
  name_zh: string;
  name_en: string;
  type: GlossaryType;
  typeLabel: BilingualText;
  type_zh: string;
  type_en: string;
  category: string;
  parent_id: string;
  user_visible: boolean;
  ai_detectable: AiDetectable;
  billable: BillableValue;
  merchant_price_required: BillableValue;
  merchant_duration_required: BillableValue;
  default_duration_min: number;
  default_pricing_unit: string;
  /** Platform default price in dollars (null = no platform default). */
  default_price_cents: number | null;
  quantity_supported: boolean | 'optional';
  complexity_supported: boolean | 'optional';
};

// CatalogItem tri-states ('yes' | 'no' | 'optional') → the glossary's boolean | 'optional'.
function triToBillable(value: TriState): BillableValue {
  if (value === 'optional') return 'optional';
  return value === 'yes';
}

function toGlossaryEntry(item: CatalogItem): GlossaryEntry {
  const type = item.type as GlossaryType;
  const name = item.name;
  const typeLabel = catalogTypeLabels[type];
  return {
    id: item.id,
    name,
    name_zh: name.zh,
    name_en: name.en,
    type,
    typeLabel,
    type_zh: typeLabel.zh,
    type_en: typeLabel.en,
    category: item.category,
    parent_id: item.parentId ?? 'na',
    user_visible: item.userVisible === 'yes',
    ai_detectable: item.aiDetectable,
    billable: triToBillable(item.billable),
    merchant_price_required: triToBillable(item.merchantPriceRequired),
    merchant_duration_required: triToBillable(item.merchantDurationRequired),
    default_duration_min: item.defaultDurationMin ?? 0,
    default_pricing_unit: item.defaultPricingUnit,
    default_price_cents: item.defaultPriceCents,
    quantity_supported: triToBillable(item.quantitySupported),
    complexity_supported: item.complexitySupported === 'yes',
  };
}

export const glossaryEntries: GlossaryEntry[] = catalogItems.map(toGlossaryEntry);

export const glossaryById = new Map<string, GlossaryEntry>(
  glossaryEntries.map((e) => [e.id, e])
);

export const serviceModules = glossaryEntries.filter((e) => e.type === 'service_module');

export const billableComponents = glossaryEntries.filter((e) => e.type === 'billable_component');

// visual_attribute entries that the merchant can optionally price (billable: true | 'optional')
export const billableVisualAttributes = glossaryEntries.filter(
  (e) => e.type === 'visual_attribute' && e.billable !== false
);

// Everything a merchant needs to configure: all billable_components + billable visual_attributes
export const configurableComponents = [...billableComponents, ...billableVisualAttributes];

// billable_components that AI can detect from a photo (ai_detectable === 'yes')
export const aiDetectableComponents = billableComponents.filter((e) => e.ai_detectable === 'yes');

// All procedures (always inferred — not AI-detected from image, derived from service modules present)
export const allProcedures = glossaryEntries.filter((e) => e.type === 'procedure');

// visual_attributes that AI can detect
export const aiDetectableVisualAttributes = glossaryEntries.filter(
  (e) => e.type === 'visual_attribute' && e.ai_detectable === 'yes'
);

// style_tags that AI can detect
export const aiDetectableStyleTags = glossaryEntries.filter(
  (e) => e.type === 'style_tag' && e.ai_detectable === 'yes'
);

// complexity levels
export const complexityLevels = glossaryEntries.filter((e) => e.type === 'complexity_level');

// time-only procedures that make up the base manicure (used by the merchant manage UI)
export const basicServiceProcedures = glossaryEntries.filter(
  (e) => e.type === 'procedure' && e.parent_id === 'basic_manicure_service'
);
