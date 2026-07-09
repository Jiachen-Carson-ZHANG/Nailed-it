// Decision brain — A2 aggregation (ADR-0012 Phase 2). Pure glue between raw rows and the brain:
// analytics events → per-style funnel counts, and bookings → capacity busy-intervals. Kept pure so the
// read-model action stays a thin I/O shell.

import type { AnalyticsEvent } from '../analytics';
import type { FunnelCounts } from './funnel';
import type { BusyInterval, CapacityDay } from './capacity';

const emptyCounts = (): FunnelCounts => ({
  impressions: 0, clicks: 0, detailViews: 0, saves: 0, tryOns: 0, bookings: 0, completedOrders: 0,
});

/** Per-style funnel counts from the event log. `completedBookingIds` (bookings with status=completed)
 *  turns booking_confirmed events into the completion count, so completionRate is real, not a proxy. */
export function funnelCountsByStyle(
  events: AnalyticsEvent[],
  completedBookingIds: ReadonlySet<string>,
): Map<string, FunnelCounts> {
  const byStyle = new Map<string, FunnelCounts>();
  const bump = (styleId: string): FunnelCounts => {
    let c = byStyle.get(styleId);
    if (!c) { c = emptyCounts(); byStyle.set(styleId, c); }
    return c;
  };
  for (const e of events) {
    if (!e.styleId) continue;
    const c = bump(e.styleId);
    switch (e.eventType) {
      case 'style_impression': c.impressions += 1; break;
      case 'style_card_click': c.clicks += 1; break;
      case 'style_detail_view': c.detailViews += 1; break;
      case 'style_save': c.saves += 1; break;
      case 'try_on_completed': c.tryOns += 1; break;
      case 'booking_confirmed':
        c.bookings += 1;
        if (e.bookingId && completedBookingIds.has(e.bookingId)) c.completedOrders += 1;
        break;
      default: break; // search_* / recommended_style_sent don't feed the per-style funnel
    }
  }
  return byStyle;
}

const hmToMin = (hm: string): number => {
  const [h, m] = hm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

type BookingLike = {
  date: string; time: string; status: string;
  quote: { duration: number };
  technician: { id: string };
};

/** Bookings → capacity busy-intervals (local minutes). Bookings are already merchant-local (date + HH:mm),
 *  so no tz math; cancelled excluded; only the days in `days` are kept. */
export function bookingsToBusyIntervals(bookings: BookingLike[], days: CapacityDay[]): BusyInterval[] {
  const dates = new Set(days.map((d) => d.date));
  const out: BusyInterval[] = [];
  for (const b of bookings) {
    if (b.status === 'cancelled' || !dates.has(b.date)) continue;
    const startMin = hmToMin(b.time);
    out.push({ technicianId: b.technician.id, date: b.date, startMin, endMin: startMin + (b.quote.duration || 60) });
  }
  return out;
}
