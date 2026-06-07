import { describe, it, expect } from 'vitest';
import type { AnalyticsEvent } from '@/domain/analytics';
import type { StyleDiscoveryFacet } from '@/domain/nail';
import { getCustomerIntelligence, type IntelBooking } from './customer-intel';

const NOW = '2026-06-07T00:00:00.000Z';
const f = (label: string): StyleDiscoveryFacet => ({ kind: 'style', label });

const styles = [
  { id: 's1', discoveryFacets: [f('裸色'), f('法式风')] },
  { id: 's2', discoveryFacets: [f('金属感')] },
];

const events: AnalyticsEvent[] = [
  {
    id: 'e1', merchantId: 'm1', customerId: 'cust-melissa', sessionId: null, eventSource: null,
    styleId: 's1', bookingId: null, technicianId: null, query: null, rankPosition: null,
    algorithmVersion: null, metadata: {}, eventType: 'style_save', createdAt: NOW,
  },
];

const booking = (o: Partial<IntelBooking> & Pick<IntelBooking, 'id' | 'startAt'>): IntelBooking => ({
  customerName: 'Melissa Tan',
  styleTitle: '裸色法式',
  status: 'confirmed',
  ...o,
});

const bookings: IntelBooking[] = [
  booking({ id: 'bk-past', startAt: '2026-06-01T00:00:00.000Z' }),
  booking({ id: 'bk-cancelled', startAt: '2026-06-08T00:00:00.000Z', status: 'cancelled' }),
  booking({ id: 'bk-upcoming', startAt: '2026-06-10T00:00:00.000Z' }),
  booking({ id: 'bk-later', startAt: '2026-06-15T00:00:00.000Z' }),
  booking({ id: 'bk-other', startAt: '2026-06-09T00:00:00.000Z', customerName: 'Someone Else' }),
];

describe('getCustomerIntelligence', () => {
  const intel = getCustomerIntelligence({
    events, styles, bookings, customer: { id: 'cust-melissa', name: 'Melissa Tan' }, now: NOW,
  });

  it("picks the soonest upcoming non-cancelled booking for the matched customer", () => {
    expect(intel.appointmentContext?.bookingId).toBe('bk-upcoming');
  });

  it('recommends the profile-matching style first', () => {
    expect(intel.recommendations[0].style.id).toBe('s1');
    expect(intel.profile.customerId).toBe('cust-melissa');
  });
});
