import { config } from 'dotenv';
config({ path: '.env.local' });

import WebSocketImpl from 'ws';
import { createClient } from '@supabase/supabase-js';
import { mockBookings } from '../src/mock/bookings';
import { seedConversationThreads } from '../src/mock/conversations';
import { defaultPricingRules } from '../src/mock/pricing';
import { mockTechnicians } from '../src/mock/technicians';
import { styleDefinitions } from '../src/mock/styles';
import { catalogItems } from '../src/mock/catalog';
import { mockMerchants } from '../src/mock/merchants';
import type { BookingConversationThread } from '../src/domain/nail';

// Standalone client for the seed script — does not import the server-only-guarded
// app client (src/lib/db/client.ts), which throws under plain node.
const seedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const seedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!seedUrl || !seedKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
// Node < 22 has no global WebSocket; supabase-js eagerly inits a realtime client.
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocketImpl;
}
const seedClient = createClient(seedUrl, seedKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
function getServiceClient() {
  return seedClient;
}

const BASE_CREATED_AT = '2026-05-01T00:00:00Z';

function addSeconds(isoBase: string, seconds: number): string {
  const d = new Date(isoBase);
  d.setSeconds(d.getSeconds() + seconds);
  return d.toISOString();
}

async function seedTechnicians(): Promise<number> {
  const rows = mockTechnicians.map((t) => ({
    id: t.id,
    name: t.name,
    initials: t.initials,
    title: t.title,
    active: t.active,
  }));
  const { error } = await getServiceClient()
    .from('technicians')
    .upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`seed technicians failed: ${error.message}`);
  return rows.length;
}

async function seedStyles(): Promise<number> {
  const rows = styleDefinitions.map((s) => ({
    id: s.id,
    title: s.title,
    image_url: s.imageUrl,
    popularity_score: s.popularityScore,
    discovery_facets: s.discoveryFacets,
    recognition: s.recognition,
  }));
  const { error } = await getServiceClient()
    .from('styles')
    .upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`seed styles failed: ${error.message}`);
  return rows.length;
}

async function seedPricingRules(): Promise<number> {
  const rows = defaultPricingRules.map((p) => ({
    id: p.id,
    category: p.category,
    target: p.target,
    price: p.price,
    duration: p.duration,
    enabled: p.enabled,
  }));
  const { error } = await getServiceClient()
    .from('pricing_rules')
    .upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`seed pricing_rules failed: ${error.message}`);
  return rows.length;
}

async function seedBookings(): Promise<number> {
  const rows = mockBookings.map((b) => ({
    id: b.id,
    customer_name: b.customerName,
    merchant_name: b.merchantName,
    style_title: b.styleTitle,
    style_image_url: b.styleImageUrl,
    date: b.date,
    time: b.time,
    quote: b.quote,
    status: b.status,
    technician: b.technician,
    conversation_id: b.conversationId ?? null,
    notes: b.notes,
    recognition: b.recognition,
  }));
  const { error } = await getServiceClient()
    .from('bookings')
    .upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`seed bookings failed: ${error.message}`);
  return rows.length;
}

async function seedCatalog(): Promise<number> {
  const rows = catalogItems.map((item) => ({
    id: item.id,
    name_zh: item.nameZh,
    type: item.type,
    category: item.category,
    parent_id: item.parentId,
    user_visible: item.userVisible,
    ai_detectable: item.aiDetectable,
    billable: item.billable,
    merchant_price_required: item.merchantPriceRequired,
    merchant_duration_required: item.merchantDurationRequired,
    duration_config_level: item.durationConfigLevel,
    affects_booking_duration: item.affectsBookingDuration,
    default_duration_min: item.defaultDurationMin,
    allowed_pricing_units: item.allowedPricingUnits,
    default_pricing_unit: item.defaultPricingUnit,
    quantity_supported: item.quantitySupported,
    complexity_supported: item.complexitySupported,
    notes: item.notes,
  }));
  const { error } = await getServiceClient()
    .from('catalog_item')
    .upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`seed catalog_item failed: ${error.message}`);
  return rows.length;
}

async function seedMerchants(): Promise<number> {
  const rows = mockMerchants.map((m) => ({
    id: m.id,
    name: m.name,
    timezone: m.timezone,
    currency: m.currency,
  }));
  const { error } = await getServiceClient()
    .from('merchant')
    .upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`seed merchant failed: ${error.message}`);
  return rows.length;
}

async function seedConversations(
  threads: BookingConversationThread[],
): Promise<{ threads: number; messages: number }> {
  const threadRows = threads.map((t) => ({
    id: t.id,
    booking_id: t.bookingId,
    customer_name: t.customerName,
    merchant_name: t.merchantName,
    related_booking_time: t.relatedBookingTime,
  }));
  const { error: threadError } = await getServiceClient()
    .from('conversation_threads')
    .upsert(threadRows, { onConflict: 'id' });
  if (threadError) {
    throw new Error(`seed conversation_threads failed: ${threadError.message}`);
  }

  const messageRows: Array<{
    id: string;
    thread_id: string;
    author_role: string;
    body: string;
    sent_at: string;
    created_at: string;
  }> = [];

  let globalIndex = 0;
  for (const thread of threads) {
    for (const msg of thread.messages) {
      messageRows.push({
        id: msg.id,
        thread_id: thread.id,
        author_role: msg.authorRole,
        body: msg.body,
        sent_at: msg.sentAt,
        created_at: addSeconds(BASE_CREATED_AT, globalIndex),
      });
      globalIndex += 1;
    }
  }

  if (messageRows.length > 0) {
    const { error: msgError } = await getServiceClient()
      .from('messages')
      .upsert(messageRows, { onConflict: 'id' });
    if (msgError) throw new Error(`seed messages failed: ${msgError.message}`);
  }

  return { threads: threadRows.length, messages: messageRows.length };
}

async function main(): Promise<void> {
  console.log('Seeding Supabase...');

  const [techCount, styleCount, pricingCount, bookingCount, convResult, catalogCount, merchantCount] =
    await Promise.all([
      seedTechnicians(),
      seedStyles(),
      seedPricingRules(),
      seedBookings(),
      seedConversations(seedConversationThreads),
      seedCatalog(),
      seedMerchants(),
    ]);

  console.log(`technicians:          ${techCount}`);
  console.log(`styles:               ${styleCount}`);
  console.log(`pricing_rules:        ${pricingCount}`);
  console.log(`bookings:             ${bookingCount}`);
  console.log(`conversation_threads: ${convResult.threads}`);
  console.log(`messages:             ${convResult.messages}`);
  console.log(`catalog_item:         ${catalogCount}`);
  console.log(`merchant:             ${merchantCount}`);
  console.log('Done.');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
