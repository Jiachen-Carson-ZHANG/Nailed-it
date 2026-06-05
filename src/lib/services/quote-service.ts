// quoteService — see ADR-0005 (P4b). Catalog ids + quantities + merchant pricing → priced,
// duration-aware quote lines. Fails closed: if any selected item requires a merchant price it
// does not have (effective source 'unresolved' or disabled), the whole quote throws rather than
// silently offering it free.

import type { PricingUnit } from '@/domain/catalog';
import { resolveEffectivePricing } from '@/domain/pricing-resolver';
import type { RepositoryBundle } from '@/lib/repositories/types';

export type QuoteSelection = { catalogItemId: string; quantity: number };

export type QuoteLine = {
  catalogItemId: string;
  label: string;
  unitPriceCents: number;
  quantity: number;
  linePriceCents: number;
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
        const item = catalogById.get(sel.catalogItemId);
        if (!item) throw new Error(`unknown_item: ${sel.catalogItemId}`);
        const eff = effById.get(sel.catalogItemId);
        if (!eff) continue; // non-billable selection contributes nothing
        if (eff.source === 'unresolved' || !eff.enabled) {
          unbookable.push(sel.catalogItemId);
          continue;
        }
        lines.push({
          catalogItemId: item.id,
          label: item.nameZh,
          unitPriceCents: eff.priceCents,
          quantity: sel.quantity,
          linePriceCents: eff.priceCents * sel.quantity,
          durationMin: staffDur.get(sel.catalogItemId) ?? eff.durationMin,
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
