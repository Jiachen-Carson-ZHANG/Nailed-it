// One-off: publish the merchant's ready-but-hidden needs_review designs (they were configured but the
// library has no drafts tab to publish them from). Copies the original image into the published bucket
// and flips status via publish_merchant_style. Usage: npx tsx scripts/publish-drafts.ts
import { config } from 'dotenv';
config({ path: '.env.local' });

import WebSocketImpl from 'ws';
import { createClient } from '@supabase/supabase-js';
import { demoMerchantId } from '@/mock/merchants';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocketImpl;
}
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const PUBLISHED_BUCKET = 'merchant-style-published';
const ext: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

type Row = {
  id: string;
  merchant_id: string;
  title: string;
  description: string | null;
  status: string;
  preview_price_cents: number | null;
  preview_duration_min: number | null;
  media_asset: { original_bucket: string; original_path: string; mime_type: string } | null;
};

async function main() {
  const { data, error } = await client
    .from('merchant_style')
    .select(
      'id, merchant_id, title, description, status, preview_price_cents, preview_duration_min, media_asset!merchant_style_media_same_merchant_fk(original_bucket, original_path, mime_type)',
    )
    .eq('merchant_id', demoMerchantId)
    .eq('status', 'needs_review');
  if (error) throw new Error(`fetch failed: ${error.message}`);

  const rows = (data ?? []) as unknown as Row[];
  console.log(`found ${rows.length} needs_review designs to publish`);

  for (const s of rows) {
    if (!s.media_asset || s.preview_price_cents == null || s.preview_duration_min == null) {
      console.log(`[skip] ${s.id} — missing media or preview`);
      continue;
    }
    const e = ext[s.media_asset.mime_type] ?? 'jpg';
    const publishedPath = `${s.merchant_id}/${s.id}.${e}`;

    const { data: blob, error: dErr } = await client.storage
      .from(s.media_asset.original_bucket)
      .download(s.media_asset.original_path);
    if (dErr || !blob) throw new Error(`download ${s.id} failed: ${dErr?.message ?? 'no data'}`);
    const bytes = new Uint8Array(await blob.arrayBuffer());

    const { error: uErr } = await client.storage
      .from(PUBLISHED_BUCKET)
      .upload(publishedPath, bytes, { contentType: s.media_asset.mime_type, upsert: true });
    if (uErr) throw new Error(`upload ${s.id} failed: ${uErr.message}`);

    const { error: rErr } = await client.rpc('publish_merchant_style', {
      p_style_id: s.id,
      p_merchant_id: s.merchant_id,
      p_title: s.title,
      p_description: s.description ?? '',
      p_preview_price_cents: s.preview_price_cents,
      p_preview_duration_min: s.preview_duration_min,
      p_published_bucket: PUBLISHED_BUCKET,
      p_published_path: publishedPath,
      p_published_at: new Date().toISOString(),
    });
    if (rErr) throw new Error(`publish ${s.id} failed: ${rErr.message}`);
    console.log(`[published] ${s.id} — ${s.title}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
