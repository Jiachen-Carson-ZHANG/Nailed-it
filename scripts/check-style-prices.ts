// Read-only audit: merchant_style preview snapshots + item counts.
// Usage: npx tsx scripts/check-style-prices.ts

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

type StyleRow = {
  id: string;
  title: string;
  status: string;
  preview_price_cents: number | null;
  preview_duration_min: number | null;
};

async function main(): Promise<void> {
  const { data: styles, error } = await client
    .from('merchant_style')
    .select('id, title, status, preview_price_cents, preview_duration_min')
    .eq('merchant_id', demoMerchantId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);

  const { data: items, error: itemsError } = await client
    .from('merchant_style_item')
    .select('merchant_style_id, catalog_item_id');
  if (itemsError) throw new Error(itemsError.message);

  const itemCountByStyle = new Map<string, number>();
  const itemIdsByStyle = new Map<string, string[]>();
  for (const row of items ?? []) {
    const sid = row.merchant_style_id as string;
    itemCountByStyle.set(sid, (itemCountByStyle.get(sid) ?? 0) + 1);
    const list = itemIdsByStyle.get(sid) ?? [];
    list.push(row.catalog_item_id as string);
    itemIdsByStyle.set(sid, list);
  }

  const rows = (styles ?? []) as StyleRow[];
  const missingPreview = rows.filter(
    (s) => s.preview_price_cents === null || s.preview_duration_min === null,
  );
  const noItems = rows.filter((s) => (itemCountByStyle.get(s.id) ?? 0) === 0);
  const publishedMissingPreview = missingPreview.filter((s) => s.status === 'published');

  console.log(`merchant_id: ${demoMerchantId}`);
  console.log(`total styles: ${rows.length}`);
  console.log(`missing preview (price or duration null): ${missingPreview.length}`);
  console.log(`published but missing preview: ${publishedMissingPreview.length}`);
  console.log(`no merchant_style_item rows: ${noItems.length}`);
  console.log('');

  const byStatus = new Map<string, number>();
  for (const s of rows) byStatus.set(s.status, (byStatus.get(s.status) ?? 0) + 1);
  console.log('by status:', Object.fromEntries(byStatus));
  console.log('');

  if (missingPreview.length > 0) {
    console.log('--- missing preview (first 15) ---');
    for (const s of missingPreview.slice(0, 15)) {
      const n = itemCountByStyle.get(s.id) ?? 0;
      console.log(
        `${s.id} | ${s.status} | items=${n} | price=${s.preview_price_cents} | dur=${s.preview_duration_min} | ${s.title.slice(0, 40)}`,
      );
    }
    if (missingPreview.length > 15) console.log(`... and ${missingPreview.length - 15} more`);
    console.log('');
  }

  if (noItems.length > 0 && noItems.length <= 20) {
    console.log('--- no catalog items (first 10) ---');
    for (const s of noItems.slice(0, 10)) {
      console.log(
        `${s.id} | ${s.status} | price=${s.preview_price_cents} | dur=${s.preview_duration_min}`,
      );
    }
    console.log('');
  } else if (noItems.length > 20) {
    console.log(`--- ${noItems.length} styles have zero merchant_style_item rows ---`);
    const sample = noItems.slice(0, 5);
    for (const s of sample) {
      console.log(`${s.id} | ${s.status} | preview=${s.preview_price_cents}/${s.preview_duration_min}`);
    }
    console.log('...');
    console.log('');
  }

  const pricedPublished = rows.filter(
    (s) =>
      s.status === 'published' &&
      s.preview_price_cents !== null &&
      s.preview_duration_min !== null,
  );
  if (pricedPublished.length > 0) {
    const prices = pricedPublished.map((s) => s.preview_price_cents as number);
    const unique = [...new Set(prices)].sort((a, b) => a - b);
    console.log(`published with preview: ${pricedPublished.length}`);
    console.log(`unique preview_price_cents values: ${unique.map((p) => `$${p / 100}`).join(', ')}`);
  }

  // Sample what the library UI would render
  console.log('\n--- library preview strings (first 5 published) ---');
  for (const s of pricedPublished.slice(0, 5)) {
    const line = `$${((s.preview_price_cents as number) / 100).toFixed(2)} · ${s.preview_duration_min} min`;
    console.log(`${s.id}: ${line} | ${s.title.slice(0, 35)}`);
  }

  // Item-level audit: unknown catalog ids, container-only
  const containerIds = new Set([
    'removal_service', 'extension_service', 'builder_service', 'color_effect_service',
    'art_service', 'decoration_service', 'finish_service',
  ]);
  const { data: catalogRows } = await client.from('catalog_item').select('id');
  const catalogIds = new Set((catalogRows ?? []).map((r) => r.id as string));

  let containerOnlyStyles = 0;
  let unknownItemStyles = 0;
  for (const s of rows) {
    const ids = itemIdsByStyle.get(s.id) ?? [];
    if (ids.length > 0 && ids.every((id) => containerIds.has(id))) containerOnlyStyles += 1;
    if (ids.some((id) => !catalogIds.has(id))) unknownItemStyles += 1;
  }
  console.log(`\ncontainer-only item rows: ${containerOnlyStyles}`);
  console.log(`styles referencing unknown catalog_item ids: ${unknownItemStyles}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
