// Live Postgres gate check (P4b). Proves the DB-only guarantees that the in-memory service
// tests cannot: gate 1 (the exclusion constraint rejects concurrent overlapping creates) and
// gate 4 (cancelling frees the interval). Run against the live project:
//
//   npx tsx scripts/check-db-gates.ts
//
// Uses a standalone service-role client (the app client imports `server-only`, which throws
// under plain node — same reason the seed script has its own client). Cleans up its rows.

import { config } from 'dotenv';
config({ path: '.env.local' });

import WebSocketImpl from 'ws';
import { createClient } from '@supabase/supabase-js';

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

const MERCHANT = 'merchant-nailed-it';
const TECH = 'tech-mei';
const IDS = ['gatecheck-a', 'gatecheck-b', 'gatecheck-c', 'gatecheck-c2'];

function booking(id: string, startAt: string, endAt: string) {
  return {
    id,
    merchant_id: MERCHANT,
    technician_id: TECH,
    customer_name: 'gatecheck',
    style_title: '',
    style_image_url: '',
    start_at: startAt,
    end_at: endAt,
    duration_min: 60,
    status: 'confirmed',
    notes: '',
  };
}

async function cleanup() {
  await db.from('booking').delete().in('id', IDS);
}

async function main() {
  await cleanup();
  let pass = true;

  // Gate 1: two concurrent overlapping creates — exactly one survives.
  const a = '2030-01-01T10:00:00+08:00';
  const aEnd = '2030-01-01T11:00:00+08:00';
  const bStart = '2030-01-01T10:30:00+08:00';
  const bEnd = '2030-01-01T11:30:00+08:00';
  const settled = await Promise.all([
    db.rpc('create_booking', { p_booking: booking('gatecheck-a', a, aEnd), p_items: [] }),
    db.rpc('create_booking', { p_booking: booking('gatecheck-b', bStart, bEnd), p_items: [] }),
  ]);
  const succeeded = settled.filter((r) => !r.error).length;
  const gate1 = succeeded === 1;
  pass = pass && gate1;
  console.log(`gate 1 (concurrent overlap): ${succeeded} of 2 survived -> ${gate1 ? 'PASS' : 'FAIL'}`);

  // Gate 4: cancelling frees the interval.
  const c = '2030-01-02T10:00:00+08:00';
  const cEnd = '2030-01-02T11:00:00+08:00';
  await db.rpc('create_booking', { p_booking: booking('gatecheck-c', c, cEnd), p_items: [] });
  await db.from('booking').update({ status: 'cancelled' }).eq('id', 'gatecheck-c');
  const rebook = await db.rpc('create_booking', { p_booking: booking('gatecheck-c2', c, cEnd), p_items: [] });
  const gate4 = !rebook.error;
  pass = pass && gate4;
  console.log(`gate 4 (cancel releases interval): ${gate4 ? 'PASS' : 'FAIL'}${rebook.error ? ' — ' + rebook.error.message : ''}`);

  await cleanup();
  console.log(pass ? 'ALL DB GATES PASS' : 'SOME DB GATES FAILED');
  process.exit(pass ? 0 : 1);
}

main().catch(async (err: unknown) => {
  console.error(err);
  await cleanup();
  process.exit(1);
});
