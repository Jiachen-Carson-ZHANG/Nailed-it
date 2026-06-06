// quoteService — see ADR-0005 (P4b). Catalog ids + quantities + merchant pricing → priced,
// duration-aware quote lines. Fails closed: if any selected item requires a merchant price it
// does not have (effective source 'unresolved' or disabled), the whole quote throws rather than
// silently offering it free.

import type { CatalogSelection, PricingUnit } from '@/domain/catalog';
import { resolveEffectivePricing } from '@/domain/pricing-resolver';
import type { RepositoryBundle } from '@/lib/repositories/types';

const MAX_SELECTION_QUANTITY = 100;

/** A quote is built from catalog selections — see `CatalogSelection` in the domain layer. */
export type QuoteSelection = CatalogSelection;

/**
 * Whether a pricing unit's booking time scales with quantity. Per-finger (one nail) and per-piece
 * (one topping) accrue time per unit: 5 hand-painted nails take ~5x one nail's time. A per_set /
 * fixed / included / tag_only line is a whole-hand or flat service whose time is counted once.
 */
function durationScalesWithQuantity(unit: PricingUnit): boolean {
  return unit === 'per_finger' || unit === 'per_piece';
}

export type QuoteLine = {
  catalogItemId: string;
  label: string;
  unitPriceCents: number;
  quantity: number;
  linePriceCents: number;
  /** Line total duration: per-unit duration x quantity for per_finger/per_piece, counted once otherwise. */
  durationMin: number;
  pricingUnit: PricingUnit;
  affectsDuration: boolean;
};

export type Quote = {
  lines: QuoteLine[];
  totalPriceCents: number;
  totalDurationMin: number;
};

export type BuildQuoteInput = {
  merchantId: string;
  technicianId?: string;
  selections: QuoteSelection[];
};

export type QuoteService = {
  buildQuote(input: BuildQuoteInput): Promise<Quote>;
};

export function createQuoteService(repos: RepositoryBundle): QuoteService {
  return {
    async buildQuote({ merchantId, technicianId, selections }: BuildQuoteInput): Promise<Quote> {
      const catalog = await repos.catalog.list();
      const catalogById = new Map(catalog.map((c) => [c.id, c]));
      const effective = resolveEffectivePricing(
        catalog,
        await repos.merchantPricing.listByMerchant(merchantId),
      );
      const effById = new Map(effective.map((e) => [e.catalogItemId, e]));
      const staff = technicianId ? await repos.staffItemDurations.listByTechnician(technicianId) : [];
      const staffDur = new Map(staff.map((s) => [s.catalogItemId, s.durationMin]));

      const lines: QuoteLine[] = [];
      const unbookable: string[] = [];

      for (const sel of selections) {
        if (
          !Number.isFinite(sel.quantity) ||
          !Number.isInteger(sel.quantity) ||
          sel.quantity <= 0 ||
          sel.quantity > MAX_SELECTION_QUANTITY
        ) {
          throw new Error(`invalid_quantity: ${sel.catalogItemId}`);
        }
        const item = catalogById.get(sel.catalogItemId);
        if (!item) throw new Error(`unknown_item: ${sel.catalogItemId}`);
        const eff = effById.get(sel.catalogItemId);
        if (!eff) continue; // non-billable selection contributes nothing
        if (eff.source === 'unresolved' || !eff.enabled) {
          unbookable.push(sel.catalogItemId);
          continue;
        }
        const unitDurationMin = staffDur.get(sel.catalogItemId) ?? eff.durationMin;
        // durationMin is the LINE total: scaled by quantity for per-finger / per-piece units so the
        // reserved booking time matches the work (5 painted nails = 5x), counted once otherwise.
        const lineDurationMin = durationScalesWithQuantity(eff.pricingUnit)
          ? unitDurationMin * sel.quantity
          : unitDurationMin;
        lines.push({
          catalogItemId: item.id,
          label: item.nameZh,
          unitPriceCents: eff.priceCents,
          quantity: sel.quantity,
          linePriceCents: eff.priceCents * sel.quantity,
          durationMin: lineDurationMin,
          pricingUnit: eff.pricingUnit,
          affectsDuration: item.affectsBookingDuration === 'yes',
        });
      }

      if (unbookable.length > 0) {
        throw new Error(`unresolved_pricing: ${unbookable.join(',')}`);
      }

      return {
        lines,
        totalPriceCents: lines.reduce((s, l) => s + l.linePriceCents, 0),
        totalDurationMin: lines
          .filter((l) => l.affectsDuration)
          .reduce((s, l) => s + l.durationMin, 0),
      };
    },
  };
}
