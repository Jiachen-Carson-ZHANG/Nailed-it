import type { AnalyticsEvent, NewAnalyticsEvent } from '@/domain/analytics';
import type { AnalyticsRepository } from '../types';

/** In-memory analytics log mirroring the Supabase variant. Seeds empty by default; tests/seed
 *  generators pass a deterministic event list. record() assigns a synthetic id and stamps
 *  createdAt = now() only when the caller did not supply one (the seed always supplies it). */
export function createMemoryAnalyticsRepository(
  seed: AnalyticsEvent[] = [],
): AnalyticsRepository {
  const events: AnalyticsEvent[] = structuredClone(seed);
  let seq = events.length;

  function normalize(e: NewAnalyticsEvent): AnalyticsEvent {
    seq += 1;
    return {
      id: `evt-mem-${seq}`,
      merchantId: e.merchantId ?? null,
      customerId: e.customerId ?? null,
      sessionId: e.sessionId ?? null,
      eventType: e.eventType,
      eventSource: e.eventSource ?? null,
      styleId: e.styleId ?? null,
      bookingId: e.bookingId ?? null,
      technicianId: e.technicianId ?? null,
      query: e.query ?? null,
      rankPosition: e.rankPosition ?? null,
      algorithmVersion: e.algorithmVersion ?? null,
      metadata: e.metadata ?? {},
      createdAt: e.createdAt ?? new Date().toISOString(),
    };
  }

  return {
    async record(event: NewAnalyticsEvent): Promise<void> {
      events.push(normalize(event));
    },

    async listByMerchant(merchantId: string): Promise<AnalyticsEvent[]> {
      return structuredClone(events.filter((e) => e.merchantId === merchantId));
    },

    async listByCustomer(customerId: string): Promise<AnalyticsEvent[]> {
      return structuredClone(events.filter((e) => e.customerId === customerId));
    },
  };
}
