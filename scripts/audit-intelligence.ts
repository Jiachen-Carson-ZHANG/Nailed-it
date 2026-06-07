// Phase 0 (Merchant Intelligence Layer) — read-only demo-truth audit. Dumps the live published
// merchant_style set + per-facet-label published-style counts so we can pick an HONEST catalog-gap
// tag (count <= 1) and find the 金属感 low-conversion + 裸色法式 top-converter anchor style_ids.
// Standalone service-role client (same reason as check-db-gates.ts: app client imports server-only).
//
//   npx tsx scripts/audit-intelligence.ts
//
// Read-only. Writes nothing.

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
// Tags the demo narrative leans on — spotlight their counts explicitly.
const NARRATIVE_TAGS = ['甜美', '金属感', '裸色', '法式', '韩系', '极简', '镜面'];

type Facet = { kind?: string; label: string };
type StyleRow = { id: string; title: string | null; status: string; discovery_facets: Facet[] | null };

async function main() {
  const { data: styles, error } = await db
    .from('merchant_style')
    .select('id, title, status, discovery_facets')
    .eq('merchant_id', MERCHANT)
    .eq('status', 'published')
    .order('id');
  if (error) throw error;
  const rows = (styles ?? []) as StyleRow[];

  console.log(`\n=== Published merchant_style for ${MERCHANT}: ${rows.length} ===`);
  for (const s of rows) {
    const labels = (s.discovery_facets ?? []).map((f) => f.label);
    console.log(`  ${s.id}  «${s.title ?? ''}»`);
    console.log(`     facets: ${labels.join(' · ') || '(none)'}`);
  }

  // label -> style ids carrying it (among published styles)
  const byLabel = new Map<string, string[]>();
  for (const s of rows) {
    for (const f of s.discovery_facets ?? []) {
      const arr = byLabel.get(f.label) ?? [];
      if (!arr.includes(s.id)) arr.push(s.id);
      byLabel.set(f.label, arr);
    }
  }

  const sorted = [...byLabel.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  console.log(`\n=== Facet label → #published styles (${byLabel.size} distinct labels) ===`);
  for (const [label, ids] of sorted) {
    console.log(`  ${String(ids.length).padStart(2)}  ${label}`);
  }

  console.log(`\n=== Gap candidates: labels on EXACTLY ≤1 published style ===`);
  for (const [label, ids] of sorted) {
    if (ids.length <= 1) console.log(`  ${ids.length}  ${label}   [${ids.join(', ')}]`);
  }

  console.log(`\n=== Narrative-tag spotlight (does each have the count the story needs?) ===`);
  for (const tag of NARRATIVE_TAGS) {
    const ids = byLabel.get(tag) ?? [];
    console.log(`  ${tag.padEnd(4)} → ${ids.length} published   [${ids.join(', ')}]`);
  }

  // Sanity: which booking table actually has demo rows.
  for (const table of ['booking', 'bookings']) {
    const { count, error: e } = await db
      .from(table)
      .select('*', { count: 'exact', head: true });
    console.log(`\n[booking-table] ${table}: ${e ? 'ERR ' + e.message : (count ?? 0) + ' rows'}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
