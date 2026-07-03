// Seed the intelligence layer demo dataset (ADR-0006, Phase C) into Supabase: the persona
// `customers` + a backdated ~2-week `analytics_events` history. Idempotent — upserts customers and
// resets the demo merchant's analytics_events by default so old rehearsal clicks/searches cannot make
// the rolling "this week vs last week" story stale. Pass --preserve-live-events only when you
// intentionally want to keep non-seed captured events and replace seed rows in place.
// Standalone service-role client (the app client imports `server-only`, which throws under node —
// same reason as seed-supabase.ts / check-db-gates.ts).
//
//   npx tsx scripts/seed-intelligence.ts   (or: npm run seed:intelligence)
//
// Run AFTER migration 0017 is applied. The narrative it produces is asserted by
// src/mock/intelligence-seed.test.ts.

import { config } from 'dotenv';
config({ path: '.env.local' });

import WebSocketImpl from 'ws';
import { createClient } from '@supabase/supabase-js';
import { seedCustomers, generateSeedEvents } from '../src/mock/intelligence-seed';
import type { Customer, NewAnalyticsEvent } from '../src/domain/analytics';
import { demoMerchantId } from '../src/mock/merchants';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocketImpl;
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const preserveLiveEvents = process.argv.includes('--preserve-live-events');

const customerRow = (c: Customer) => ({
  id: c.id,
  merchant_id: c.merchantId,
  handle: c.handle,
  name: c.name,
  avatar_url: c.avatarUrl,
  persona_note: c.personaNote,
});

const eventRow = (e: NewAnalyticsEvent) => ({
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
  created_at: e.createdAt,
});

async function main() {
  const customers = seedCustomers.map(customerRow);
  const upserted = await db.from('customers').upsert(customers, { onConflict: 'id' });
  if (upserted.error) throw new Error(`customers upsert failed: ${upserted.error.message}`);
  console.log(`✓ upserted ${customers.length} customers`);

  if (preserveLiveEvents) {
    const bySource = await db.from('analytics_events').delete().eq('event_source', 'seed');
    if (bySource.error) throw new Error(`clearing seed-source events failed: ${bySource.error.message}`);
    const bySession = await db.from('analytics_events').delete().like('session_id', 'seed-%');
    if (bySession.error) throw new Error(`clearing seed-session events failed: ${bySession.error.message}`);
    console.log('✓ cleared prior seeded events (live events preserved by flag)');
  } else {
    const cleared = await db.from('analytics_events').delete().eq('merchant_id', demoMerchantId);
    if (cleared.error) throw new Error(`clearing demo merchant events failed: ${cleared.error.message}`);
    console.log(`✓ cleared all prior analytics_events for ${demoMerchantId}`);
  }

  const events = generateSeedEvents(Date.now()).map(eventRow);
  const inserted = await db.from('analytics_events').insert(events);
  if (inserted.error) throw new Error(`events insert failed: ${inserted.error.message}`);
  console.log(`✓ inserted ${events.length} backdated analytics_events`);

  const { count } = await db.from('analytics_events').select('*', { count: 'exact', head: true });
  console.log(`analytics_events total now: ${count}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
