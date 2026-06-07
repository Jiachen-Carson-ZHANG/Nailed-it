// Merchant Intelligence Layer domain contracts (ADR-0006). Only two things are stored: a seeded
// `customers` table and a real `analytics_events` log. Profiles, demand trends, catalog gaps,
// low-conversion flags, and ranking are computed on read from events — never modelled here.

export const analyticsEventTypes = [
  'style_impression',
  'style_card_click',
  'style_detail_view',
  'style_save',
  'search_submitted',
  'search_no_result',
  'try_on_completed',
  'booking_confirmed',
  'recommended_style_sent',
] as const;
export type AnalyticsEventType = (typeof analyticsEventTypes)[number];

export function isAnalyticsEventType(value: unknown): value is AnalyticsEventType {
  return typeof value === 'string' && (analyticsEventTypes as readonly string[]).includes(value);
}

/** A behavioural event as stored. id + createdAt are server-assigned; everything else is nullable
 *  because a given surface only carries the dimensions relevant to it. */
export type AnalyticsEvent = {
  id: string;
  merchantId: string | null;
  customerId: string | null;
  sessionId: string | null;
  eventType: AnalyticsEventType;
  eventSource: string | null;
  styleId: string | null;
  bookingId: string | null;
  technicianId: string | null;
  query: string | null;
  rankPosition: number | null;
  algorithmVersion: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

/** Input to record an event. `createdAt` is optional so the seed can backdate ~2 weeks of history;
 *  omit it and the DB stamps now(). Everything but `eventType` defaults to null/{}. */
export type NewAnalyticsEvent = {
  eventType: AnalyticsEventType;
  merchantId?: string | null;
  customerId?: string | null;
  sessionId?: string | null;
  eventSource?: string | null;
  styleId?: string | null;
  bookingId?: string | null;
  technicianId?: string | null;
  query?: string | null;
  rankPosition?: number | null;
  algorithmVersion?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

/** A seeded customer persona. The live demo customer maps the mock session to one via `handle`. */
export type Customer = {
  id: string;
  merchantId: string;
  handle: string | null;
  name: string;
  avatarUrl: string | null;
  personaNote: string | null;
  createdAt?: string;
};
