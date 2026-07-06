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
import { mockMerchants, demoMerchantId } from '../src/mock/merchants';
import { resolveEffectivePricing } from '../src/domain/pricing-resolver';
import { mockBlockedTimes, mockWorkingPlans } from '../src/mock/scheduling';
import {
  mockBookingItems,
  mockIntervalBookings,
  mockStaffItemDurations,
} from '../src/mock/interval-bookings';
import type { BookingConversationThread } from '../src/domain/nail';
import { mockMerchantStyles } from '../src/mock/merchant-styles';
import { mockStyleAdCampaigns } from '../src/mock/style-ads';

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
    merchant_id: t.merchantId,
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
    default_price_cents: item.defaultPriceCents,
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

/** Persist catalog-default prices/durations into merchant_pricing so client + server agree without localStorage. */
async function seedMerchantPricing(): Promise<number> {
  const effective = resolveEffectivePricing(catalogItems, []);
  const rows = effective
    .filter((row) => row.source !== 'unresolved')
    .map((row) => ({
      merchant_id: demoMerchantId,
      catalog_item_id: row.catalogItemId,
      price_cents: row.priceCents,
      duration_min: row.durationMin,
      pricing_unit: row.pricingUnit,
      enabled: row.enabled,
    }));

  if (rows.length === 0) return 0;

  const { error } = await getServiceClient()
    .from('merchant_pricing')
    .upsert(rows, { onConflict: 'merchant_id,catalog_item_id' });
  if (error) throw new Error(`seed merchant_pricing failed: ${error.message}`);
  return rows.length;
}

async function seedMerchantStyles(): Promise<{ media: number; styles: number }> {
  const mediaRows = mockMerchantStyles.map((style) => ({
    id: style.media.id,
    merchant_id: style.media.merchantId,
    original_bucket: style.media.originalBucket,
    original_path: style.media.originalPath,
    published_bucket: style.media.publishedBucket,
    published_path: style.media.publishedPath,
    mime_type: style.media.mimeType,
    byte_size: style.media.byteSize,
    source: style.media.source,
    state: style.media.state,
    created_at: style.media.createdAt,
    updated_at: style.media.updatedAt,
  }));
  const { error: mediaError } = await getServiceClient()
    .from('media_asset')
    .upsert(mediaRows, { onConflict: 'id' });
  if (mediaError) throw new Error(`seed media_asset failed: ${mediaError.message}`);

  const styleRows = mockMerchantStyles.map((style) => ({
    id: style.id,
    merchant_id: style.merchantId,
    primary_media_asset_id: style.primaryMediaAssetId,
    title: style.title,
    description: style.description,
    status: style.status,
    discovery_facets: style.discoveryFacets,
    recognition: style.recognition,
    preview_price_cents: style.previewPriceCents,
    preview_duration_min: style.previewDurationMin,
    published_at: style.publishedAt,
    archived_at: style.archivedAt,
    created_at: style.createdAt,
    updated_at: style.updatedAt,
  }));
  const { error: styleError } = await getServiceClient()
    .from('merchant_style')
    .upsert(styleRows, { onConflict: 'id' });
  if (styleError) throw new Error(`seed merchant_style failed: ${styleError.message}`);

  return { media: mediaRows.length, styles: styleRows.length };
}

async function seedStyleAdCampaigns(): Promise<number> {
  const rows = mockStyleAdCampaigns.map((campaign) => ({
    id: campaign.id,
    merchant_id: demoMerchantId,
    merchant_style_id: campaign.styleId,
    status: campaign.status,
    daily_budget_cents: campaign.dailyBudgetCents,
    duration_days: 14,
    impressions: campaign.impressions,
    clicks: campaign.clicks,
    bookings: campaign.bookings,
    spend_cents: campaign.spendCents,
    updated_at: campaign.updatedAt,
  }));
  const { error } = await getServiceClient()
    .from('style_ad_campaign')
    .upsert(rows, { onConflict: 'merchant_id,merchant_style_id' });
  if (error) throw new Error(`seed style_ad_campaign failed: ${error.message}`);
  return rows.length;
}

async function seedWorkingPlans(): Promise<number> {
  const rows = mockWorkingPlans.map((p) => ({
    technician_id: p.technicianId,
    weekday: p.weekday,
    open_min: p.openMin,
    close_min: p.closeMin,
    breaks: p.breaks,
  }));
  const { error } = await getServiceClient()
    .from('working_plan')
    .upsert(rows, { onConflict: 'technician_id,weekday' });
  if (error) throw new Error(`seed working_plan failed: ${error.message}`);
  return rows.length;
}

async function seedBlockedTimes(): Promise<number> {
  const rows = mockBlockedTimes.map((b) => ({
    id: b.id,
    technician_id: b.technicianId,
    start_at: b.startAt,
    end_at: b.endAt,
    reason: b.reason,
  }));
  const { error } = await getServiceClient()
    .from('blocked_time')
    .upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`seed blocked_time failed: ${error.message}`);
  return rows.length;
}

async function seedIntervalBookings(): Promise<{ bookings: number; items: number }> {
  const bookingRows = mockIntervalBookings.map((b) => ({
    id: b.id,
    merchant_id: b.merchantId,
    technician_id: b.technicianId,
    customer_name: b.customerName,
    style_title: b.styleTitle,
    style_image_url: b.styleImageUrl,
    start_at: b.startAt,
    end_at: b.endAt,
    duration_min: b.durationMin,
    status: b.status,
    notes: b.notes,
  }));
  const { error: bErr } = await getServiceClient()
    .from('booking')
    .upsert(bookingRows, { onConflict: 'id' });
  if (bErr) throw new Error(`seed booking failed: ${bErr.message}`);

  const itemRows = mockBookingItems.map((i) => ({
    id: i.id,
    booking_id: i.bookingId,
    catalog_item_id: i.catalogItemId,
    label: i.label,
    price_cents: i.priceCents,
    duration_min: i.durationMin,
    quantity: i.quantity,
    pricing_unit: i.pricingUnit,
    affects_duration: i.affectsDuration,
  }));
  const { error: iErr } = await getServiceClient()
    .from('booking_item')
    .upsert(itemRows, { onConflict: 'id' });
  if (iErr) throw new Error(`seed booking_item failed: ${iErr.message}`);

  return { bookings: bookingRows.length, items: itemRows.length };
}

async function seedStaffItemDurations(): Promise<number> {
  const rows = mockStaffItemDurations.map((s) => ({
    technician_id: s.technicianId,
    catalog_item_id: s.catalogItemId,
    duration_min: s.durationMin,
  }));
  const { error } = await getServiceClient()
    .from('staff_item_duration')
    .upsert(rows, { onConflict: 'technician_id,catalog_item_id' });
  if (error) throw new Error(`seed staff_item_duration failed: ${error.message}`);
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

  // FK order: merchant -> technicians (technicians.merchant_id) -> working_plan/blocked_time
  // (both FK technicians). Everything else is independent.
  const merchantCount = await seedMerchants();
  const techCount = await seedTechnicians();
  const [
    styleCount,
    pricingCount,
    bookingCount,
    convResult,
    catalogCount,
    workingPlanCount,
    blockedTimeCount,
  ] = await Promise.all([
    seedStyles(),
    seedPricingRules(),
    seedBookings(),
    seedConversations(seedConversationThreads),
    seedCatalog(),
    seedWorkingPlans(),
    seedBlockedTimes(),
  ]);

  // booking/booking_item FK catalog_item + technicians; staff_item_duration FKs both.
  const intervalResult = await seedIntervalBookings();
  const staffDurationCount = await seedStaffItemDurations();
  const merchantStyleResult = await seedMerchantStyles();
  const styleAdCampaignCount = await seedStyleAdCampaigns();
  const merchantPricingCount = await seedMerchantPricing();

  console.log(`technicians:          ${techCount}`);
  console.log(`styles:               ${styleCount}`);
  console.log(`pricing_rules:        ${pricingCount}`);
  console.log(`bookings:             ${bookingCount}`);
  console.log(`conversation_threads: ${convResult.threads}`);
  console.log(`messages:             ${convResult.messages}`);
  console.log(`catalog_item:         ${catalogCount}`);
  console.log(`merchant:             ${merchantCount}`);
  console.log(`working_plan:         ${workingPlanCount}`);
  console.log(`blocked_time:         ${blockedTimeCount}`);
  console.log(`booking:              ${intervalResult.bookings}`);
  console.log(`booking_item:         ${intervalResult.items}`);
  console.log(`staff_item_duration:  ${staffDurationCount}`);
  console.log(`media_asset:          ${merchantStyleResult.media}`);
  console.log(`merchant_style:       ${merchantStyleResult.styles}`);
  console.log(`style_ad_campaign:    ${styleAdCampaignCount}`);
  console.log(`merchant_pricing:     ${merchantPricingCount}`);
  console.log('Done.');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
