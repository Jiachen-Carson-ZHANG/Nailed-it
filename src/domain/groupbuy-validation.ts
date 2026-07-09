// Group-buy terms validator (ADR-0012 Phase 2, audit #4). One pure parser the propose path + the wizard
// share, so an agent-created deal can't persist nonsense (end before start, discount above original, a
// low-peak window with no real time range). Structural only — catalog-item existence is the DB FK's job.

import type { GroupbuyDeal } from './groupbuy';

export type GroupbuyValidation = { ok: boolean; errors: string[] };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const toMin = (hm: string): number => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));

/** Validate a deal's commercial + temporal terms. `requirePublishable` adds the stricter rules a deal must
 *  satisfy to go live (non-empty title, at least one enabled service) vs. a still-editable draft. */
export function validateGroupbuyDeal(deal: GroupbuyDeal, requirePublishable = false): GroupbuyValidation {
  const errors: string[] = [];

  if (requirePublishable && deal.title.trim() === '') errors.push('title_required');

  if (!(deal.originalPrice > 0)) errors.push('original_price_must_be_positive');
  if (deal.dealPrice !== null) {
    if (!(deal.dealPrice > 0)) errors.push('deal_price_must_be_positive');
    else if (deal.dealPrice > deal.originalPrice) errors.push('deal_price_above_original');
  }

  if (deal.validity.type === 'days') {
    if (!Number.isInteger(deal.validity.days) || deal.validity.days <= 0) errors.push('validity_days_must_be_positive');
  } else {
    if (!DATE.test(deal.validity.start) || !DATE.test(deal.validity.end)) errors.push('validity_dates_malformed');
    else if (deal.validity.end <= deal.validity.start) errors.push('validity_end_before_start');
  }

  if (deal.saleStart.type === 'scheduled' && !DATE.test(deal.saleStart.value)) errors.push('sale_start_malformed');
  if (deal.saleEnd.type === 'scheduled') {
    if (!DATE.test(deal.saleEnd.value)) errors.push('sale_end_malformed');
    else if (deal.saleStart.type === 'scheduled' && deal.saleEnd.value <= deal.saleStart.value) errors.push('sale_end_before_start');
  }

  if (deal.availability.type === 'limited') {
    if (deal.availability.windows.length === 0) errors.push('availability_windows_empty');
    for (const w of deal.availability.windows) {
      if (w.day.trim() === '') errors.push('availability_day_required');
      if (!HHMM.test(w.startTime) || !HHMM.test(w.endTime)) errors.push('availability_time_malformed');
      else if (toMin(w.endTime) <= toMin(w.startTime)) errors.push('availability_end_before_start');
    }
  }

  const enabled = deal.serviceSelections.filter((s) => s.enabled);
  if (requirePublishable && enabled.length === 0) errors.push('at_least_one_service_required');
  if (enabled.some((s) => !Number.isInteger(s.quantity) || s.quantity <= 0)) errors.push('service_quantity_must_be_positive');

  return { ok: errors.length === 0, errors };
}
