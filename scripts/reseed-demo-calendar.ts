// Demo-day calendar reseed: bookings anchored from DEMO_DAY (default 2026-07-16) with per-day varied
// workload, using the LIVE style names + durations so calendar entries match the library. Surgical —
// touches ONLY capseed-% booking rows; analytics events, styles and agent data stay untouched
// (unlike seed-intelligence, which clears analytics and re-anchors to "now").
// Run: npx tsx scripts/reseed-demo-calendar.ts
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { generateRollingBookings } from '../src/mock/capacity-booking-seed';
import { demoMerchantId } from '../src/mock/merchants';
import { mockTechnicians } from '../src/mock/technicians';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing supabase env in .env.local'); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });

// Per-day utilization: demo day busy (capacity gates bite), surrounding days varied so the week reads real.
const DAY_PLAN: Array<{ date: string; target: number }> = [
  { date: '2026-07-16', target: 0.85 }, // demo day — busy
  { date: '2026-07-17', target: 0.6 },
  { date: '2026-07-18', target: 0.95 }, // weekend rush
  { date: '2026-07-19', target: 0.9 },
  { date: '2026-07-20', target: 0.35 }, // quiet Monday
  { date: '2026-07-21', target: 0.55 },
  { date: '2026-07-22', target: 0.75 },
];

async function main() {
  const technicianIds = mockTechnicians.filter((t) => t.merchantId === demoMerchantId && t.active).map((t) => t.id);
  const { data: styleRows, error: sErr } = await db.from('merchant_style')
    .select('title, preview_duration_min')
    .eq('merchant_id', demoMerchantId).eq('status', 'published');
  if (sErr) throw sErr;
  const styles = (styleRows ?? [])
    .filter((s) => typeof s.preview_duration_min === 'number' && s.preview_duration_min > 0)
    .map((s) => ({ title: s.title as string, durationMin: s.preview_duration_min as number }));

  const rows: Record<string, unknown>[] = [];
  DAY_PLAN.forEach(({ date, target }, di) => {
    const bookings = generateRollingBookings({
      dates: [date], technicianIds, merchantId: demoMerchantId, styles,
      seed: 20_260_716 + di, targetUtilization: target,
    });
    bookings.forEach((b, i) => rows.push({
      id: `capseed-${date}-${i}`, merchant_id: b.merchantId, technician_id: b.technicianId,
      customer_name: b.customerName, style_title: b.styleTitle, style_image_url: b.styleImageUrl,
      start_at: b.startAt, end_at: b.endAt, duration_min: b.durationMin, status: b.status, notes: 'seed:capacity',
    }));
  });

  const del = await db.from('booking').delete().like('id', 'capseed-%');
  if (del.error) throw del.error;
  const ins = await db.from('booking').insert(rows);
  if (ins.error) throw ins.error;
  const byDate: Record<string, number> = {};
  rows.forEach((r) => { const d = String(r.start_at).slice(0, 10); byDate[d] = (byDate[d] ?? 0) + 1; });
  console.log(`inserted ${rows.length} bookings across ${technicianIds.length} techs`);
  console.log('per-day:', JSON.stringify(byDate));
}
main().catch((e) => { console.error(e); process.exit(1); });
