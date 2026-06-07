// Usage: npx tsx scripts/query-style.ts [styleId]
import { config } from 'dotenv';
config({ path: '.env.local' });

import WebSocketImpl from 'ws';
import { createClient } from '@supabase/supabase-js';
import { demoMerchantId } from '../src/mock/merchants';

const styleId = process.argv[2] ?? 'style-melissa-img-8275';

if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocketImpl;
}

async function main(): Promise<void> {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: style, error } = await client
    .from('merchant_style')
    .select('id, title, preview_price_cents, preview_duration_min, discovery_facets')
    .eq('id', styleId)
    .single();
  if (error) throw error;

  const { data: items } = await client
    .from('merchant_style_item')
    .select('catalog_item_id, quantity, position')
    .eq('merchant_style_id', styleId)
    .order('position');

  console.log(JSON.stringify({ style, items }, null, 2));
  console.log('merchant_id filter:', demoMerchantId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
