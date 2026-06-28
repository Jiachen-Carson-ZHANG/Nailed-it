import { NextResponse } from 'next/server';
import { SkinMatchError, analyzeSkinTone, rankStylesForSkin } from '@/nail-ai/skin-match';
import type { CandidateStyle } from '@/nail-ai/skin-match';
import { getRepositories } from '@/lib/repositories';
import { getStyleMediaStorage } from '@/lib/storage';
import { toPublishedMerchantStyle } from '@/domain/merchant-style';
import type { MerchantStyleRecord, PublishedMerchantStyle } from '@/domain/merchant-style';

const supportedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']);
const MAX_CANDIDATES = 50;

export async function POST(request: Request) {
  try {
    const body = parseRequestBody(await request.json());

    // Step 1: analyse skin tone from the hand photo
    const skinProfile = await analyzeSkinTone(body.imageBase64, body.mimeType);

    // Step 2: fetch published styles and build candidate set
    const { merchantStyles } = getRepositories();
    const allPublished = await merchantStyles.listPublished();

    if (allPublished.length === 0) {
      return NextResponse.json(
        { error: '暂无可用款式', code: 'no_candidates' },
        { status: 400 }
      );
    }

    // Step 3: pre-filter by skin-profile tags, cap at MAX_CANDIDATES (newest first)
    const profileTags = new Set([
      ...skinProfile.recommendedPalettes.map((p) => p.toLowerCase()),
      ...skinProfile.recommendedShapes.map((s) => s.toLowerCase()),
    ]);

    const sorted = [...allPublished].sort(
      (a, b) => new Date(b.publishedAt ?? b.createdAt).getTime() - new Date(a.publishedAt ?? a.createdAt).getTime()
    );

    const filtered = sorted.filter((s) =>
      s.discoveryFacets.some((f) => profileTags.has(f.label.toLowerCase()))
    );

    // Fall back to newest styles if no tag overlap
    const candidateRecords = (filtered.length > 0 ? filtered : sorted).slice(0, MAX_CANDIDATES);

    const candidates: CandidateStyle[] = candidateRecords.map((s) => ({
      id: s.id,
      nameCn: s.title,
      allTags: s.discoveryFacets.map((f) => f.label),
    }));

    // Step 4: rank top 3
    const ranked = await rankStylesForSkin(skinProfile, candidates);

    // Step 5: hydrate — fetch full published style records for the 3 IDs
    const styleById = new Map(candidateRecords.map((s) => [s.id, s]));
    const recommendations = ranked
      .map((r) => {
        const style = styleById.get(r.styleId);
        if (!style) return null;
        return {
          style: toPublishedStyle(style),
          reasonZh: r.reasonZh,
          reasonEn: r.reasonEn,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    return NextResponse.json({ skinProfile, recommendations });
  } catch (error) {
    if (error instanceof SkinMatchError) {
      const status =
        error.code === 'missing_config'    ? 500 :
        error.code === 'invalid_hand_image' ? 422 : 502;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid request.', code: 'invalid_request' },
      { status: 400 }
    );
  }
}

type SkinMatchRequest = { imageBase64: string; mimeType: string };

function parseRequestBody(value: unknown): SkinMatchRequest {
  const body = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim() : '';

  if (!imageBase64) throw new Error('imageBase64 is required.');
  if (!supportedMimeTypes.has(mimeType)) throw new Error('mimeType must be PNG, JPEG, WEBP, HEIC, or HEIF.');

  return { imageBase64, mimeType };
}

function toPublishedStyle(record: MerchantStyleRecord): PublishedMerchantStyle {
  const storage = getStyleMediaStorage();
  const imageUrl = storage.publicUrl(
    record.media.publishedBucket ?? '',
    record.media.publishedPath ?? '',
  );
  const mapped = toPublishedMerchantStyle(record, imageUrl);
  if (!mapped) {
    // This should not happen for candidate records (they come from listPublished which already
    // filters unpublishable records), but fall back to a minimal shape if it does.
    return {
      id: record.id,
      merchantId: record.merchantId,
      title: record.title,
      titleLocalized: record.titleLocalized,
      description: record.description,
      descriptionLocalized: record.descriptionLocalized,
      catalogBreakdown: structuredClone(record.catalogBreakdown),
      imageUrl,
      discoveryFacets: structuredClone(record.discoveryFacets),
      popularityScore: 0,
      recognition: record.recognition ? structuredClone(record.recognition) : null,
      previewQuote: {
        source: 'style_preview',
        price: (record.previewPriceCents ?? 0) / 100,
        duration: record.previewDurationMin ?? 0,
      },
    };
  }
  return mapped;
}
