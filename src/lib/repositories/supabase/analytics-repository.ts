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

const PAGE_SIZE = 1000; // PostgREST caps a single response at ~1000 rows — paginate past it.

/** Fetch ALL rows for a column filter, paging past the 1000-row cap. The intelligence read model
 *  computes over the full event history (ADR-0006); a silent 1000-row truncation undercounts every
 *  metric once a merchant accumulates >1000 events. */
async function listAllByColumn(column: 'merchant_id' | 'customer_id', value: string): Promise<AnalyticsEvent[]> {
  const out: AnalyticsEvent[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await getServiceClient()
      .from('analytics_events')
      .select('*')
      .eq(column, value)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`AnalyticsRepository read (${column}) failed: ${error.message}`);
    const rows = (data ?? []) as AnalyticsEventRow[];
    out.push(...rows.map(rowToAnalyticsEvent));
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
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
      return listAllByColumn('merchant_id', merchantId);
    },

    async listByCustomer(customerId: string): Promise<AnalyticsEvent[]> {
      return listAllByColumn('customer_id', customerId);
    },
  };
}
