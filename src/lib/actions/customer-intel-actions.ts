'use server';

import { getRepositories } from '@/lib/repositories';
import {
  buildPopularityIndex,
  buildStyleTagIndex,
  getCustomerIntelligence,
  getCustomerProfile,
  rankStyles,
  type CustomerIntelligence,
} from '@/domain/intelligence';
import type { PublishedMerchantStyle } from '@/domain/merchant-style';
import { listCustomerPublishedStylesAction } from '@/lib/actions/merchant-style-actions';
import { demoMerchantId } from '@/mock/merchants';
import { demoCustomerId } from '@/mock/customers';

export type CustomerIntelResult = CustomerIntelligence<PublishedMerchantStyle>;

/** Merchant customer-intelligence panel payload for the customer of a thread (matched by name). */
export async function getCustomerIntelligenceAction(customerName: string): Promise<CustomerIntelResult | null> {
  const repos = getRepositories();
  const customer = (await repos.customers.listByMerchant(demoMerchantId)).find((c) => c.name === customerName);
  if (!customer) return null;

  const [events, styles, bookings] = await Promise.all([
    repos.analytics.listByCustomer(customer.id),
    listCustomerPublishedStylesAction(),
    repos.intervalBookings.listByMerchant(demoMerchantId),
  ]);

  return getCustomerIntelligence({
    events,
    styles,
    bookings, // IntervalBooking satisfies IntelBooking (id/customerName/styleTitle/startAt/status)
    customer: { id: customer.id, name: customer.name },
    now: Date.now(),
    limit: 4,
  });
}

export type RankedFeed = { styles: PublishedMerchantStyle[]; reasons: Record<string, string> };

/** The customer feed re-ordered for the demo customer (Melissa) via the ranking function, with a
 *  localized reason chip per style that matches her profile. Falls back to popularity/freshness when
 *  she has no profile yet. */
export async function getRankedFeedAction(): Promise<RankedFeed> {
  const repos = getRepositories();
  const [customerEvents, styles, merchantEvents] = await Promise.all([
    repos.analytics.listByCustomer(demoCustomerId),
    listCustomerPublishedStylesAction(),
    repos.analytics.listByMerchant(demoMerchantId),
  ]);

  const profile = getCustomerProfile(customerEvents, buildStyleTagIndex(styles), demoCustomerId);
  const ranked = rankStyles(profile, styles, { popularityByStyle: buildPopularityIndex(merchantEvents) });

  const reasons: Record<string, string> = {};
  for (const item of ranked) {
    const tags = item.reasonCodes.filter((c) => c.startsWith('tag:')).map((c) => c.slice(4));
    if (tags.length > 0) reasons[item.style.id] = `匹配你的 ${tags.join(' · ')}`;
  }

  return { styles: ranked.map((item) => item.style), reasons };
}
