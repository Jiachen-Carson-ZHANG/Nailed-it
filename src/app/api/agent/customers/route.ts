import { NextResponse } from 'next/server';
import { getRepositories } from '@/lib/repositories';
import { demoMerchantId } from '@/mock/merchants';

// Grounded customer roster for the agent team's 用户运营 (customer ops) agent. Like the briefing
// endpoint, this exposes pre-computed substrate (booking history) so the Python service never invents
// customer signals (ADR-0007 guardrail). Re-engagement targets surface first (most-lapsed).
export async function GET() {
  const repos = getRepositories();
  const [customers, bookings] = await Promise.all([
    repos.customers.listByMerchant(demoMerchantId),
    repos.intervalBookings.listByMerchant(demoMerchantId),
  ]);

  const now = Date.now();
  const DAY = 86_400_000;

  const roster = customers
    .map((c) => {
      const theirs = bookings
        .filter((b) => b.customerName === c.name)
        .sort((a, b) => Date.parse(b.startAt) - Date.parse(a.startAt));
      const last = theirs[0] ?? null;
      return {
        name: c.name,
        personaNote: c.personaNote,
        bookingCount: theirs.length,
        lastVisitDaysAgo: last ? Math.floor((now - Date.parse(last.startAt)) / DAY) : null,
        lastStyleTitle: last?.styleTitle ?? null,
      };
    })
    // most-lapsed first; never-booked (null) sort last as acquisition (not re-engagement) targets.
    .sort((a, b) => (b.lastVisitDaysAgo ?? -1) - (a.lastVisitDaysAgo ?? -1));

  return NextResponse.json({ merchantId: demoMerchantId, customers: roster });
}
