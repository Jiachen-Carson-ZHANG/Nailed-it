import type { GlossaryEntrySettings } from '@/data/glossary-settings-store';

export type GroupbuyPriceSelection = {
  catalogItemId: string;
  enabled: boolean;
  quantity: number;
};

export type GroupbuyPriceLine = {
  catalogItemId: string;
  unitPrice: number;
  quantity: number;
  linePrice: number;
  pricingUnit: string;
};

export type CalculateGroupbuyOriginalPriceInput = {
  selections: GroupbuyPriceSelection[];
  settingsById: Map<string, GlossaryEntrySettings>;
};

function unitScalesWithQuantity(unit: string | undefined): boolean {
  return unit === 'per_finger' || unit === 'per_piece';
}

function normalizedQuantity(quantity: number, unit: string | undefined): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return 1;
  const whole = Math.floor(quantity);
  if (unit === 'per_finger') return Math.min(10, whole);
  if (unit === 'per_piece') return Math.min(99, whole);
  return 1;
}

export function calculateGroupbuyOriginalPrice({
  selections,
  settingsById,
}: CalculateGroupbuyOriginalPriceInput): { total: number; lines: GroupbuyPriceLine[] } {
  const lines = selections.flatMap((selection): GroupbuyPriceLine[] => {
    if (!selection.enabled) return [];
    const setting = settingsById.get(selection.catalogItemId);
    if (!setting || !setting.enabled || setting.price <= 0) return [];

    const quantity = normalizedQuantity(selection.quantity, setting.unit);
    const pricingQuantity = unitScalesWithQuantity(setting.unit) ? quantity : 1;
    const linePrice = setting.price * pricingQuantity;

    return [{
      catalogItemId: selection.catalogItemId,
      unitPrice: setting.price,
      quantity,
      linePrice,
      pricingUnit: setting.unit ?? 'per_set',
    }];
  });

  return {
    lines,
    total: lines.reduce((sum, line) => sum + line.linePrice, 0),
  };
}
