import type { AnalyticsEvent } from '@/domain/analytics';
import type { AppointmentContext, CustomerIntelligence, RankCandidate } from './types';
import { buildPopularityIndex, buildStyleTagIndex, resolveNowMs } from './shared';
import { getCustomerProfile } from './profile';
import { rankStyles } from './ranking';

/** Minimal booking shape for appointment-context matching (IntervalBooking satisfies it). */
export type IntelBooking = {
  id: string;
  customerName: string;
  styleTitle: string;
  startAt: string;
  status: string;
};

export type CustomerIntelInput<T extends RankCandidate> = {
  events: AnalyticsEvent[];
  /** Published candidate styles — also the source of the tag index + popularity for ranking. */
  styles: T[];
  bookings: IntelBooking[];
  /** The persona being inspected. `name` joins to booking.customer_name (ADR-0006). */
  customer: { id: string; name: string };
  now?: string | number | Date;
  /** Max recommendations to return (default 6). */
  limit?: number;
};

/**
 * The merchant's customer-intelligence panel payload: the customer's profile, reason-coded styles to
 * recommend, and the linked appointment. Composed from the same pure read-model pieces (profile +
 * ranking) so the panel and the feed never disagree.
 */
export function getCustomerIntelligence<T extends RankCandidate>(
  input: CustomerIntelInput<T>,
): CustomerIntelligence<T> {
  const styleIndex = buildStyleTagIndex(input.styles);
  const profile = getCustomerProfile(input.events, styleIndex, input.customer.id, input.now);
  const popularityByStyle = buildPopularityIndex(input.events);
  const recommendations = rankStyles(profile, input.styles, {
    now: input.now,
    popularityByStyle,
  }).slice(0, input.limit ?? 6);

  return {
    profile,
    recommendations,
    appointmentContext: pickAppointment(input.bookings, input.customer.name, resolveNowMs(input.now)),
  };
}

/** The most relevant booking for this customer: soonest upcoming (non-cancelled), else most recent. */
function pickAppointment(
  bookings: IntelBooking[],
  customerName: string,
  nowMs: number,
): AppointmentContext {
  const mine = bookings.filter((b) => b.customerName === customerName && b.status !== 'cancelled');
  if (mine.length === 0) return null;

  const upcoming = mine
    .filter((b) => new Date(b.startAt).getTime() >= nowMs)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const chosen =
    upcoming[0] ??
    [...mine].sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())[0];

  return {
    bookingId: chosen.id,
    styleTitle: chosen.styleTitle,
    startAt: chosen.startAt,
    status: chosen.status,
  };
}
