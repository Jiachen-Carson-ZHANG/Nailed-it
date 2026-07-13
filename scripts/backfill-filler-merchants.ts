// Narrow filler backfill (audit 2026-06-27 #2). Upserts ONLY the 4 filler merchants + their media +
// published styles into Supabase, so the deployed demo has the multi-merchant feed + cross-merchant
// platform-hot. Idempotent (upsert by id); does NOT touch the hero merchant, bookings, conversations,
// or analytics — unlike the broad `seed:supabase`.
//
//   npx tsx scripts/backfill-filler-merchants.ts   (or: npm run backfill:fillers)

import { config } from 'dotenv';
config({ path: '.env.local' });

import WebSocketImpl from 'ws';
import { createClient } from '@supabase/supabase-js';
import { demoMerchantId, mockMerchants } from '../src/mock/merchants';
import { fillerMerchantStyles } from '../src/mock/filler-merchant-styles';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
// @ts-expect-error - realtime ws shim under node (same as seed-agents.ts)
globalThis.WebSocket = WebSocketImpl;
const db = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const fillers = mockMerchants.filter((m) => m.id !== demoMerchantId);

  const { error: mErr } = await db.from('merchant').upsert(
    fillers.map((m) => ({ id: m.id, name: m.name, timezone: m.timezone, currency: m.currency })),
    { onConflict: 'id' },
  );
  if (mErr) throw new Error(`merchant: ${mErr.message}`);

  const media = fillerMerchantStyles.map((s) => ({
    id: s.media.id,
    merchant_id: s.media.merchantId,
    original_bucket: s.media.originalBucket,
    original_path: s.media.originalPath,
    published_bucket: s.media.publishedBucket,
    published_path: s.media.publishedPath,
    mime_type: s.media.mimeType,
    byte_size: s.media.byteSize,
    source: s.media.source,
    state: s.media.state,
    created_at: s.media.createdAt,
    updated_at: s.media.updatedAt,
  }));
  const { error: mediaErr } = await db.from('media_asset').upsert(media, { onConflict: 'id' });
  if (mediaErr) throw new Error(`media_asset: ${mediaErr.message}`);

  const styles = fillerMerchantStyles.map((s) => ({
    id: s.id,
    merchant_id: s.merchantId,
    primary_media_asset_id: s.primaryMediaAssetId,
    title: s.title,
    description: s.description,
    status: s.status,
    discovery_facets: s.discoveryFacets,
    recognition: s.recognition,
    preview_price_cents: s.previewPriceCents,
    preview_duration_min: s.previewDurationMin,
    published_at: s.publishedAt,
    archived_at: s.archivedAt,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  }));
  const { error: sErr } = await db.from('merchant_style').upsert(styles, { onConflict: 'id' });
  if (sErr) throw new Error(`merchant_style: ${sErr.message}`);

  console.log(`Backfilled ${fillers.length} filler merchants, ${media.length} media, ${styles.length} styles.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
