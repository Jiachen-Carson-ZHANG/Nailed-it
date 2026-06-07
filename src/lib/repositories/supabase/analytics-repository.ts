import { getServiceClient } from '@/lib/db/client';
import type { AnalyticsEvent, AnalyticsEventType, NewAnalyticsEvent } from '@/domain/analytics';
import type { AnalyticsRepository } from '../types';

export interface AnalyticsEventRow {
  id: string;
  merchant_id: string | null;
  customer_id: string | null;
  session_id: string | null;
  event_type: string;
  event_source: string | null;
  style_id: string | null;
  booking_id: string | null;
  technician_id: string | null;
  query: string | null;
  rank_position: number | null;
  algorithm_version: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export function rowToAnalyticsEvent(row: AnalyticsEventRow): AnalyticsEvent {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    customerId: row.customer_id,
    sessionId: row.session_id,
    eventType: row.event_type as AnalyticsEventType,
    eventSource: row.event_source,
    styleId: row.style_id,
    bookingId: row.booking_id,
    technicianId: row.technician_id,
    query: row.query,
    rankPosition: row.rank_position,
    algorithmVersion: row.algorithm_version,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

/** Map a record() input to an insert payload. id + created_at are left to DB defaults unless the
 *  caller supplies created_at (the seed backdates history). */
function newEventToPayload(e: NewAnalyticsEvent): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    merchant_id: e.merchantId ?? null,
    customer_id: e.customerId ?? null,
    session_id: e.sessionId ?? null,
    event_type: e.eventType,
    event_source: e.eventSource ?? null,
    style_id: e.styleId ?? null,
    booking_id: e.bookingId ?? null,
    technician_id: e.technicianId ?? null,
    query: e.query ?? null,
    rank_position: e.rankPosition ?? null,
    algorithm_version: e.algorithmVersion ?? null,
    metadata: e.metadata ?? {},
  };
  if (e.createdAt) payload.created_at = e.createdAt;
  return payload;
}

export function createSupabaseAnalyticsRepository(): AnalyticsRepository {
  return {
    async record(event: NewAnalyticsEvent): Promise<void> {
      const { error } = await getServiceClient()
        .from('analytics_events')
        .insert(newEventToPayload(event));
      if (error) {
        throw new Error(`AnalyticsRepository.record failed: ${error.message}`);
      }
    },

    async listByMerchant(merchantId: string): Promise<AnalyticsEvent[]> {
      const { data, error } = await getServiceClient()
        .from('analytics_events')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: true });
      if (error) {
        throw new Error(`AnalyticsRepository.listByMerchant failed: ${error.message}`);
      }
      return (data as AnalyticsEventRow[]).map(rowToAnalyticsEvent);
    },

    async listByCustomer(customerId: string): Promise<AnalyticsEvent[]> {
      const { data, error } = await getServiceClient()
        .from('analytics_events')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: true });
      if (error) {
        throw new Error(`AnalyticsRepository.listByCustomer failed: ${error.message}`);
      }
      return (data as AnalyticsEventRow[]).map(rowToAnalyticsEvent);
    },
  };
}
