import { config } from 'dotenv';
config({ path: '.env.local' });

import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import WebSocketImpl from 'ws';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocketImpl;
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const merchantId = 'merchant-nailed-it';
const merchantName = 'Nailed-it Studio';
const merchantTimezone = 'Asia/Singapore';
const merchantCurrency = 'SGD';
const assetsDir = 'nail_assets';
const originalsBucket = 'merchant-style-originals';
const publishedBucket = 'merchant-style-published';
const backfilledAt = '2026-06-06T00:00:00.000Z';
const previewPriceCents = 8800;
const previewDurationMin = 90;

type BackfillRow = {
  fileName: string;
  bytes: Uint8Array;
  byteSize: number;
  mediaRow: Record<string, unknown>;
  styleRow: Record<string, unknown>;
  originalPath: string;
  publishedPath: string;
};

function addSeconds(iso: string, seconds: number): string {
  const d = new Date(iso);
  d.setSeconds(d.getSeconds() + seconds);
  return d.toISOString();
}

function idFromFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

async function readMelissaRows(): Promise<BackfillRow[]> {
  const fileNames = (await readdir(assetsDir))
    .filter((fileName) => /\.jpe?g$/i.test(fileName))
    .sort((a, b) => a.localeCompare(b));

  if (fileNames.length === 0) {
    throw new Error(`No Melissa JPEG assets found in ${assetsDir}`);
  }

  return Promise.all(
    fileNames.map(async (fileName, index) => {
      const localPath = join(assetsDir, fileName);
      const bytes = await readFile(localPath);
      const fileStat = await stat(localPath);
      const slug = idFromFileName(fileName);
      const styleId = `style-melissa-${slug}`;
      const mediaId = `media-melissa-${slug}`;
      const title = `Melissa Design ${slug.replace('img-', '').toUpperCase()}`;
      const timestamp = addSeconds(backfilledAt, index);
      const originalPath = `${merchantId}/melissa/originals/${fileName}`;
      const publishedPath = `${merchantId}/melissa/published/${fileName}`;

      return {
        fileName,
        bytes: new Uint8Array(bytes),
        byteSize: fileStat.size,
        originalPath,
        publishedPath,
        mediaRow: {
          id: mediaId,
          merchant_id: merchantId,
          original_bucket: originalsBucket,
          original_path: originalPath,
          published_bucket: publishedBucket,
          published_path: publishedPath,
          mime_type: 'image/jpeg',
          byte_size: fileStat.size,
          source: 'seed',
          state: 'published',
          created_at: timestamp,
          updated_at: timestamp,
        },
        styleRow: {
          id: styleId,
          merchant_id: merchantId,
          primary_media_asset_id: mediaId,
          title,
          status: 'published',
          discovery_facets: [
            { kind: 'style', label: 'Melissa' },
            { kind: 'mood', label: 'Showcase' },
          ],
          recognition: null,
          catalog_breakdown: [],
          preview_price_cents: previewPriceCents,
          preview_duration_min: previewDurationMin,
          published_at: timestamp,
          archived_at: null,
          created_at: timestamp,
          updated_at: timestamp,
        },
      };
    }),
  );
}

async function assertBucket(name: string): Promise<void> {
  const { data, error } = await supabase.storage.getBucket(name);
  if (error || !data) {
    throw new Error(`Storage bucket ${name} is missing. Run migration 0009 first.`);
  }
}

async function uploadObject(bucket: string, path: string, bytes: Uint8Array): Promise<void> {
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
    upsert: true,
  });
  if (error) {
    throw new Error(`Upload failed for ${bucket}/${path}: ${error.message}`);
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const rows = await readMelissaRows();

  console.log(`Melissa assets found: ${rows.length}`);
  console.log(`Preview values: $${previewPriceCents / 100}, ${previewDurationMin} min`);

  if (dryRun) {
    console.log('Dry run only. First row:');
    console.log(JSON.stringify({
      fileName: rows[0].fileName,
      media: rows[0].mediaRow,
      style: rows[0].styleRow,
    }, null, 2));
    return;
  }

  await assertBucket(originalsBucket);
  await assertBucket(publishedBucket);

  const { error: merchantError } = await supabase
    .from('merchant')
    .upsert({
      id: merchantId,
      name: merchantName,
      timezone: merchantTimezone,
      currency: merchantCurrency,
    }, { onConflict: 'id' });
  if (merchantError) {
    throw new Error(`Merchant upsert failed: ${merchantError.message}`);
  }

  for (const row of rows) {
    await uploadObject(originalsBucket, row.originalPath, row.bytes);
    await uploadObject(publishedBucket, row.publishedPath, row.bytes);
    console.log(`Uploaded ${basename(row.originalPath)}`);
  }

  const { error: mediaError } = await supabase
    .from('media_asset')
    .upsert(rows.map((row) => row.mediaRow), { onConflict: 'id' });
  if (mediaError) {
    throw new Error(`media_asset upsert failed: ${mediaError.message}`);
  }

  const { error: styleError } = await supabase
    .from('merchant_style')
    .upsert(rows.map((row) => row.styleRow), { onConflict: 'id' });
  if (styleError) {
    throw new Error(`merchant_style upsert failed: ${styleError.message}`);
  }

  const [{ count: mediaCount }, { count: styleCount }] = await Promise.all([
    supabase
      .from('media_asset')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      .like('id', 'media-melissa-%'),
    supabase
      .from('merchant_style')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      .like('id', 'style-melissa-%')
      .eq('status', 'published'),
  ]);

  console.log(`media_asset Melissa rows:    ${mediaCount ?? 0}`);
  console.log(`merchant_style Melissa rows: ${styleCount ?? 0}`);
  console.log('Melissa asset backfill complete.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
