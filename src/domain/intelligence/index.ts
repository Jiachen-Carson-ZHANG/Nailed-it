// Intelligence read model (ADR-0006): pure, compute-on-read functions over analytics_events + the
// published styles, resolved through the catalog-tags adapter. No stored profiles/metrics.

export * from './types';
export {
  EVENT_WEIGHTS,
  buildStyleTagIndex,
  buildPopularityIndex,
  type StyleTagIndex,
} from './shared';
export { getCustomerProfile } from './profile';
export { getMerchantInsights, type InsightsRange } from './insights';
export { rankStyles, type RankContext } from './ranking';
export { getCustomerIntelligence, type CustomerIntelInput, type IntelBooking } from './customer-intel';
