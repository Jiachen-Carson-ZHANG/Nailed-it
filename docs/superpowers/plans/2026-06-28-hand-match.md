# Hand Match Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "上传款式" top-bar button with a "测肤荐甲 / Skin Match" entry point that lets customers upload a hand photo, get an AI skin-tone analysis, and see 3 personalised style recommendations from the published catalog.

**Architecture:** Two sequential Ark vision/text calls in a new `/api/ai/skin-match` route — first analysing skin tone from the photo, then filtering published styles by recommended palettes/shapes and ranking the top 3. The new `/customer/hand-match` page drives the full upload → loading → results flow as a client component. Booking stays accessible via the "预约" bottom tab.

**Tech Stack:** Next.js 15 App Router · TypeScript · Volcengine Ark (`postOpenRouterChat` / `extractTextContent` from `src/nail-ai/openrouter.ts`) · Vitest

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/nail-ai/skin-match.ts` | `analyzeSkinTone` + `rankStylesForSkin` + typed errors |
| Create | `src/nail-ai/skin-match.test.ts` | Unit tests for both AI functions |
| Create | `src/app/api/ai/skin-match/route.ts` | POST handler — orchestrates calls, filters candidates, returns hydrated results |
| Create | `src/features/customer/HandMatchClient.tsx` | Client component — upload/loading/results/error states |
| Create | `src/app/customer/hand-match/page.tsx` | Next.js page shell |
| Modify | `src/domain/session.ts` | Add `handMatch` path to `customerPaths`, export `getCustomerHandMatchPath()` |
| Modify | `src/components/layout/MobileLayout.tsx` | Point top-bar CTA at `/customer/hand-match` |
| Modify | `src/i18n/messages/ui/zh-CN.ts` | Add `handMatch.*` keys + update `layout.newNailDesign` |
| Modify | `src/i18n/messages/ui/en.ts` | Mirror zh-CN additions in English |

---

## Task 1: Add `handMatch` path and update i18n strings

**Files:**
- Modify: `src/domain/session.ts`
- Modify: `src/i18n/messages/ui/zh-CN.ts`
- Modify: `src/i18n/messages/ui/en.ts`

- [ ] **Step 1: Add `handMatch` to `customerPaths` in `src/domain/session.ts`**

The `customerPaths` object starts at line 39. Add one entry:

```ts
const customerPaths = {
  home: '/customer/home',
  booking: '/customer/booking',
  bookingConfirm: '/customer/booking/confirm',
  messages: '/customer/messages',
  profile: '/customer/profile',
  handMatch: '/customer/hand-match',                    // ← add this line
  styleDetail: (id: string) => `/customer/style/${id}`,
  messageDetail: (conversationId: string) => `/customer/messages/${conversationId}`,
  tryOn: (styleId?: string) => styleId ? `/customer/try-on?styleId=${styleId}` : '/customer/try-on'
};
```

Then add the exported helper after `getCustomerTryOnPath` (around line 242):

```ts
export function getCustomerHandMatchPath(): string {
  return customerPaths.handMatch;
}
```

- [ ] **Step 2: Add `handMatch.*` keys to the keys array in `src/i18n/messages/ui/zh-CN.ts`**

`uiMessageKeys` is the `as const` array. Add these entries (near the end, before the closing `]`):

```ts
  'handMatch.title',
  'handMatch.uploadPrompt',
  'handMatch.uploadSubtitle',
  'handMatch.analyzing',
  'handMatch.skinSummaryTitle',
  'handMatch.recommendedPalettes',
  'handMatch.recommendedShapes',
  'handMatch.viewDetail',
  'handMatch.retry',
  'handMatch.errorInvalidImage',
  'handMatch.errorNoStyles',
  'handMatch.errorGeneric',
```

- [ ] **Step 3: Add zh-CN values for the new keys and update `layout.newNailDesign`**

In the `zhCNMessages` object:

```ts
  'layout.newNailDesign': '测肤荐甲',   // was '上传款式'
  // ... all existing keys unchanged ...
  'handMatch.title': '测肤荐甲',
  'handMatch.uploadPrompt': '上传你的手部照片',
  'handMatch.uploadSubtitle': 'AI 帮你找最适合的美甲',
  'handMatch.analyzing': '正在分析肤色…',
  'handMatch.skinSummaryTitle': '你的肤色分析',
  'handMatch.recommendedPalettes': '推荐色系',
  'handMatch.recommendedShapes': '推荐甲型',
  'handMatch.viewDetail': '查看详情',
  'handMatch.retry': '重新上传',
  'handMatch.errorInvalidImage': '请上传清晰的手部照片',
  'handMatch.errorNoStyles': '暂无匹配款式，请稍后再试',
  'handMatch.errorGeneric': '出错了，请重试',
```

- [ ] **Step 4: Add en values for the new keys and update `layout.newNailDesign` in `src/i18n/messages/ui/en.ts`**

```ts
  'layout.newNailDesign': 'Skin Match',  // was 'New nail design'
  // ... all existing keys unchanged ...
  'handMatch.title': 'Skin Match',
  'handMatch.uploadPrompt': 'Upload a photo of your hand',
  'handMatch.uploadSubtitle': 'AI finds the best nail styles for your skin tone',
  'handMatch.analyzing': 'Analysing your skin tone…',
  'handMatch.skinSummaryTitle': 'Your Skin Tone',
  'handMatch.recommendedPalettes': 'Recommended palettes',
  'handMatch.recommendedShapes': 'Recommended shapes',
  'handMatch.viewDetail': 'View Details',
  'handMatch.retry': 'Try Again',
  'handMatch.errorInvalidImage': 'Please upload a clear photo of your hand',
  'handMatch.errorNoStyles': 'No matching styles found, please try again later',
  'handMatch.errorGeneric': 'Something went wrong, please try again',
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/domain/session.ts src/i18n/messages/ui/zh-CN.ts src/i18n/messages/ui/en.ts
git commit -m "feat: add handMatch path and i18n keys for skin-match feature"
```

---

## Task 2: Build the AI adapter (`skin-match.ts`)

**Files:**
- Create: `src/nail-ai/skin-match.ts`
- Create: `src/nail-ai/skin-match.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/nail-ai/skin-match.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { analyzeSkinTone, rankStylesForSkin, SkinMatchError } from './skin-match';
import type { SkinProfile, CandidateStyle } from './skin-match';

const HAND_IMAGE = 'base64handimage';
const MIME = 'image/jpeg';

function makeArkResponse(text: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      output: [{ content: [{ text }] }]
    })
  };
}

describe('analyzeSkinTone', () => {
  it('throws missing_config when ARK_API_KEY absent', async () => {
    await expect(
      analyzeSkinTone(HAND_IMAGE, MIME, { NODE_ENV: 'test' } as NodeJS.ProcessEnv)
    ).rejects.toMatchObject({ code: 'missing_config' } satisfies Partial<SkinMatchError>);
  });

  it('parses a valid skin profile from Ark response', async () => {
    const profile: SkinProfile = {
      toneCategory: 'warm',
      depth: 'light',
      recommendedPalettes: ['裸粉', '珊瑚'],
      recommendedShapes: ['杏仁形'],
      summaryZh: '暖调浅肤 · 适合裸粉、珊瑚色系',
      summaryEn: 'Warm light skin — best with nude pink and coral tones',
    };
    const fetchImpl = vi.fn(async () => makeArkResponse(JSON.stringify(profile)));
    vi.stubGlobal('fetch', fetchImpl);

    const result = await analyzeSkinTone(HAND_IMAGE, MIME, {
      NODE_ENV: 'test',
      ARK_API_KEY: 'test-key',
    } as unknown as NodeJS.ProcessEnv);

    expect(result).toMatchObject({
      toneCategory: 'warm',
      depth: 'light',
      recommendedPalettes: ['裸粉', '珊瑚'],
    });
  });

  it('throws invalid_hand_image when model returns handValid=false', async () => {
    const fetchImpl = vi.fn(async () =>
      makeArkResponse(JSON.stringify({ handValid: false, handError: '不是手部照片' }))
    );
    vi.stubGlobal('fetch', fetchImpl);

    await expect(
      analyzeSkinTone(HAND_IMAGE, MIME, {
        NODE_ENV: 'test',
        ARK_API_KEY: 'test-key',
      } as unknown as NodeJS.ProcessEnv)
    ).rejects.toMatchObject({ code: 'invalid_hand_image' } satisfies Partial<SkinMatchError>);
  });
});

describe('rankStylesForSkin', () => {
  it('throws missing_config when ARK_API_KEY absent', async () => {
    const profile: SkinProfile = {
      toneCategory: 'warm', depth: 'light',
      recommendedPalettes: ['裸粉'], recommendedShapes: ['杏仁形'],
      summaryZh: '暖调', summaryEn: 'Warm',
    };
    await expect(
      rankStylesForSkin(profile, [], { NODE_ENV: 'test' } as NodeJS.ProcessEnv)
    ).rejects.toMatchObject({ code: 'missing_config' } satisfies Partial<SkinMatchError>);
  });

  it('returns top 3 ranked styles from Ark response', async () => {
    const profile: SkinProfile = {
      toneCategory: 'warm', depth: 'light',
      recommendedPalettes: ['裸粉'], recommendedShapes: ['杏仁形'],
      summaryZh: '暖调', summaryEn: 'Warm',
    };
    const candidates: CandidateStyle[] = [
      { id: 'style-1', nameCn: '法式裸粉', allTags: ['裸粉', '杏仁形'] },
      { id: 'style-2', nameCn: '奶油拿铁', allTags: ['奶油', '椭圆形'] },
      { id: 'style-3', nameCn: '珊瑚渐变', allTags: ['珊瑚', '杏仁形'] },
    ];
    const ranked = [
      { styleId: 'style-1', reasonZh: '裸粉与肤色相衬', reasonEn: 'Nude pink complements warm skin' },
      { styleId: 'style-3', reasonZh: '珊瑚提亮效果佳', reasonEn: 'Coral brightens warm tones' },
      { styleId: 'style-2', reasonZh: '奶油色清新自然', reasonEn: 'Cream tone is clean and natural' },
    ];
    const fetchImpl = vi.fn(async () => makeArkResponse(JSON.stringify(ranked)));
    vi.stubGlobal('fetch', fetchImpl);

    const result = await rankStylesForSkin(profile, candidates, {
      NODE_ENV: 'test',
      ARK_API_KEY: 'test-key',
    } as unknown as NodeJS.ProcessEnv);

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ styleId: 'style-1', reasonZh: '裸粉与肤色相衬' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test src/nail-ai/skin-match.test.ts
```

Expected: FAIL — `Cannot find module './skin-match'`

- [ ] **Step 3: Implement `src/nail-ai/skin-match.ts`**

```ts
import { postOpenRouterChat, extractTextContent, stripJsonFence, asRecord } from './openrouter';

export const defaultSkinMatchModel = 'doubao-seed-2-0-lite-260215';

export class SkinMatchError extends Error {
  constructor(
    public readonly code: 'missing_config' | 'provider_error' | 'invalid_model_output' | 'invalid_hand_image',
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'SkinMatchError';
  }
}

export type SkinProfile = {
  toneCategory: 'warm' | 'cool' | 'neutral';
  depth: 'light' | 'medium' | 'deep';
  recommendedPalettes: string[];
  recommendedShapes: string[];
  summaryZh: string;
  summaryEn: string;
};

export type CandidateStyle = {
  id: string;
  nameCn: string;
  allTags: string[];
};

export type RankedStyle = {
  styleId: string;
  reasonZh: string;
  reasonEn: string;
};

const analyzePrompt =
  'You are a nail salon AI assistant analysing a hand photo to understand skin tone.\n' +
  'Return ONLY a valid JSON object (no markdown fences) with exactly these fields:\n' +
  '{\n' +
  '  "handValid": true,\n' +
  '  "toneCategory": "warm" | "cool" | "neutral",\n' +
  '  "depth": "light" | "medium" | "deep",\n' +
  '  "recommendedPalettes": ["色系1", "色系2", "色系3"],\n' +
  '  "recommendedShapes": ["甲型1", "甲型2"],\n' +
  '  "summaryZh": "一句话概括（中文）",\n' +
  '  "summaryEn": "one-line summary (English)"\n' +
  '}\n' +
  'If the image does NOT show a human hand, return:\n' +
  '{"handValid": false, "handError": "reason in Chinese"}\n' +
  'Recommended palettes should be Chinese nail-salon colour names (e.g. 裸粉, 珊瑚, 薄荷绿).\n' +
  'Recommended shapes should be Chinese nail-shape names (e.g. 杏仁形, 椭圆形, 方形).';

export async function analyzeSkinTone(
  imageBase64: string,
  mimeType: string,
  env = process.env
): Promise<SkinProfile> {
  const apiKey = env.ARK_API_KEY;
  if (!apiKey) throw new SkinMatchError('missing_config', 'ARK_API_KEY is required for skin match.');

  const model = env.ARK_VISION_MODEL ?? defaultSkinMatchModel;

  let data: unknown;
  try {
    data = await postOpenRouterChat(
      {
        model,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            { type: 'text', text: analyzePrompt },
          ],
        }],
      },
      apiKey
    );
  } catch (error) {
    throw new SkinMatchError('provider_error', 'Ark skin analysis request failed.', { cause: error });
  }

  let result: Record<string, unknown>;
  try {
    const text = extractTextContent(data);
    result = JSON.parse(stripJsonFence(text)) as Record<string, unknown>;
  } catch (error) {
    throw new SkinMatchError('invalid_model_output', 'Ark response did not include valid JSON.', { cause: error });
  }

  if (result.handValid === false) {
    const msg = typeof result.handError === 'string' ? result.handError : '请上传清晰的手部照片';
    throw new SkinMatchError('invalid_hand_image', msg);
  }

  return normalizeSkinProfile(result);
}

function normalizeSkinProfile(raw: Record<string, unknown>): SkinProfile {
  const toneCategoryRaw = raw.toneCategory;
  const toneCategory: SkinProfile['toneCategory'] =
    toneCategoryRaw === 'warm' || toneCategoryRaw === 'cool' || toneCategoryRaw === 'neutral'
      ? toneCategoryRaw
      : 'neutral';

  const depthRaw = raw.depth;
  const depth: SkinProfile['depth'] =
    depthRaw === 'light' || depthRaw === 'medium' || depthRaw === 'deep' ? depthRaw : 'medium';

  const recommendedPalettes = Array.isArray(raw.recommendedPalettes)
    ? raw.recommendedPalettes.filter((p): p is string => typeof p === 'string')
    : [];
  const recommendedShapes = Array.isArray(raw.recommendedShapes)
    ? raw.recommendedShapes.filter((s): s is string => typeof s === 'string')
    : [];

  return {
    toneCategory,
    depth,
    recommendedPalettes,
    recommendedShapes,
    summaryZh: typeof raw.summaryZh === 'string' ? raw.summaryZh : '',
    summaryEn: typeof raw.summaryEn === 'string' ? raw.summaryEn : '',
  };
}

const rankPrompt = (profile: SkinProfile, candidates: CandidateStyle[]): string =>
  'You are a nail salon AI assistant helping pick nail styles that suit a customer\'s skin tone.\n' +
  `Skin profile: ${JSON.stringify({ toneCategory: profile.toneCategory, depth: profile.depth, recommendedPalettes: profile.recommendedPalettes, recommendedShapes: profile.recommendedShapes })}\n` +
  `Candidate styles (up to 50): ${JSON.stringify(candidates)}\n` +
  'Return ONLY a valid JSON array (no markdown) of exactly 3 objects, best match first:\n' +
  '[{"styleId":"<id>","reasonZh":"一句话理由（中文）","reasonEn":"one-line reason (English)"}]\n' +
  'Pick styles whose tags overlap most with the recommended palettes and shapes.\n' +
  'Each reason should be ≤15 Chinese characters or ≤10 English words.';

export async function rankStylesForSkin(
  profile: SkinProfile,
  candidates: CandidateStyle[],
  env = process.env
): Promise<RankedStyle[]> {
  const apiKey = env.ARK_API_KEY;
  if (!apiKey) throw new SkinMatchError('missing_config', 'ARK_API_KEY is required for skin match.');

  const model = env.ARK_VISION_MODEL ?? defaultSkinMatchModel;

  let data: unknown;
  try {
    data = await postOpenRouterChat(
      { model, messages: [{ role: 'user', content: rankPrompt(profile, candidates) }] },
      apiKey
    );
  } catch (error) {
    throw new SkinMatchError('provider_error', 'Ark ranking request failed.', { cause: error });
  }

  let raw: unknown[];
  try {
    const text = extractTextContent(data);
    const parsed = JSON.parse(stripJsonFence(text));
    if (!Array.isArray(parsed)) throw new Error('Expected array');
    raw = parsed;
  } catch (error) {
    throw new SkinMatchError('invalid_model_output', 'Ark ranking response did not include a valid JSON array.', { cause: error });
  }

  return raw.slice(0, 3).map(normalizeRankedStyle);
}

function normalizeRankedStyle(raw: unknown): RankedStyle {
  const r = asRecord(raw);
  return {
    styleId: typeof r.styleId === 'string' ? r.styleId : '',
    reasonZh: typeof r.reasonZh === 'string' ? r.reasonZh : '',
    reasonEn: typeof r.reasonEn === 'string' ? r.reasonEn : '',
  };
}
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
npm test src/nail-ai/skin-match.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
npm test
```

Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/nail-ai/skin-match.ts src/nail-ai/skin-match.test.ts
git commit -m "feat: add skin-match AI adapter (analyzeSkinTone + rankStylesForSkin)"
```

---

## Task 3: Build the API route (`/api/ai/skin-match`)

**Files:**
- Create: `src/app/api/ai/skin-match/route.ts`

The route must: validate input → call `analyzeSkinTone` → filter + cap candidates → call `rankStylesForSkin` → fetch full style records → return hydrated response.

- [ ] **Step 1: Create `src/app/api/ai/skin-match/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { SkinMatchError, analyzeSkinTone, rankStylesForSkin } from '@/nail-ai/skin-match';
import type { CandidateStyle } from '@/nail-ai/skin-match';
import { getRepositories } from '@/lib/repositories';
import type { PublishedMerchantStyle } from '@/domain/merchant-style';

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

// MerchantStyleRecord is the type returned by merchantStyles.listPublished()
// Mirror the mapping from getCustomerPublishedStyleAction in src/lib/actions/merchant-style-actions.ts
function toPublishedStyle(record: import('@/domain/merchant-style').MerchantStyleRecord): PublishedMerchantStyle {
  return {
    id: record.id,
    title: record.title,
    titleLocalized: record.titleLocalized,
    description: record.description,
    descriptionLocalized: record.descriptionLocalized,
    imageUrl: record.media.publishedPath
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${record.media.publishedBucket}/${record.media.publishedPath}`
      : '',
    discoveryFacets: record.discoveryFacets,
    previewQuote: {
      source: 'style_preview',
      price: record.previewPriceCents ?? 0,
      duration: record.previewDurationMin ?? 0,
    },
    popularityScore: 0,
    merchantId: record.merchantId,
    catalogBreakdown: record.catalogBreakdown,
    recognition: record.recognition,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. If `toPublishedStyle` has type issues, check how `getCustomerPublishedStyleAction` maps records in `src/lib/actions/merchant-style-actions.ts` and mirror that mapping.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/ai/skin-match/route.ts
git commit -m "feat: add /api/ai/skin-match route — skin analysis + catalog ranking"
```

---

## Task 4: Build `HandMatchClient` UI component

**Files:**
- Create: `src/features/customer/HandMatchClient.tsx`

The component manages four states: `idle | loading | results | error`. It reads locale from `useLanguage()` (same pattern as other customer components).

- [ ] **Step 1: Create `src/features/customer/HandMatchClient.tsx`**

```tsx
'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/i18n/context';
import { getCustomerStylePath } from '@/domain/session';
import type { SkinProfile, RankedStyle } from '@/nail-ai/skin-match';
import type { PublishedMerchantStyle } from '@/domain/merchant-style';

type Recommendation = {
  style: PublishedMerchantStyle;
  reasonZh: string;
  reasonEn: string;
};

type PageState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'results'; skinProfile: SkinProfile; recommendations: Recommendation[] }
  | { kind: 'error'; code: string; message: string };

const SUPPORTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];

export function HandMatchClient() {
  const { t, language } = useLanguage();
  const [state, setState] = useState<PageState>({ kind: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!SUPPORTED_TYPES.includes(file.type)) {
      setState({ kind: 'error', code: 'invalid_type', message: t('handMatch.errorInvalidImage') });
      return;
    }

    setState({ kind: 'loading' });

    const imageBase64 = await fileToBase64(file);

    try {
      const res = await fetch('/api/ai/skin-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType: file.type }),
      });

      const data = await res.json() as Record<string, unknown>;

      if (!res.ok) {
        const code = typeof data.code === 'string' ? data.code : 'unknown';
        const message =
          code === 'invalid_hand_image' ? t('handMatch.errorInvalidImage') :
          code === 'no_candidates'      ? t('handMatch.errorNoStyles') :
                                          t('handMatch.errorGeneric');
        setState({ kind: 'error', code, message });
        return;
      }

      setState({
        kind: 'results',
        skinProfile: data.skinProfile as SkinProfile,
        recommendations: data.recommendations as Recommendation[],
      });
    } catch {
      setState({ kind: 'error', code: 'network_error', message: t('handMatch.errorGeneric') });
    }
  }

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    // reset so same file can be re-uploaded
    e.target.value = '';
  }

  return (
    <div className="hand-match-page">
      <input
        ref={fileInputRef}
        accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
        aria-hidden="true"
        style={{ display: 'none' }}
        type="file"
        onChange={handleFileChange}
      />

      {state.kind === 'idle' && (
        <IdleView
          onUpload={handleUploadClick}
          subtitle={t('handMatch.uploadSubtitle')}
          title={t('handMatch.uploadPrompt')}
        />
      )}

      {state.kind === 'loading' && (
        <LoadingView label={t('handMatch.analyzing')} />
      )}

      {state.kind === 'results' && (
        <ResultsView
          language={language}
          recommendations={state.recommendations}
          skinProfile={state.skinProfile}
          onRetry={handleUploadClick}
          t={t}
        />
      )}

      {state.kind === 'error' && (
        <ErrorView
          message={state.message}
          retryLabel={t('handMatch.retry')}
          onRetry={handleUploadClick}
        />
      )}
    </div>
  );
}

function IdleView({ title, subtitle, onUpload }: { title: string; subtitle: string; onUpload: () => void }) {
  return (
    <div className="hand-match-idle">
      <div className="hand-match-upload-slot" role="button" tabIndex={0} onClick={onUpload} onKeyDown={(e) => e.key === 'Enter' && onUpload()}>
        <span className="hand-match-upload-icon" aria-hidden="true">🤚</span>
        <p className="hand-match-upload-title">{title}</p>
        <p className="hand-match-upload-subtitle">{subtitle}</p>
        <button className="hand-match-btn" type="button" onClick={(e) => { e.stopPropagation(); onUpload(); }}>
          + {title}
        </button>
      </div>
    </div>
  );
}

function LoadingView({ label }: { label: string }) {
  return (
    <div className="hand-match-loading" aria-live="polite">
      <div className="hand-match-spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

function ResultsView({
  skinProfile,
  recommendations,
  language,
  onRetry,
  t,
}: {
  skinProfile: SkinProfile;
  recommendations: Recommendation[];
  language: string;
  onRetry: () => void;
  t: (key: string) => string;
}) {
  const summary = language === 'zh-CN' ? skinProfile.summaryZh : skinProfile.summaryEn;
  return (
    <div className="hand-match-results">
      <section className="hand-match-skin-card" aria-label={t('handMatch.skinSummaryTitle')}>
        <h2 className="hand-match-skin-title">{t('handMatch.skinSummaryTitle')}</h2>
        <p className="hand-match-skin-summary">{summary}</p>
        {skinProfile.recommendedPalettes.length > 0 && (
          <div className="hand-match-chips">
            <span className="hand-match-chip-label">{t('handMatch.recommendedPalettes')}</span>
            {skinProfile.recommendedPalettes.map((p) => (
              <span key={p} className="hand-match-chip">{p}</span>
            ))}
          </div>
        )}
        {skinProfile.recommendedShapes.length > 0 && (
          <div className="hand-match-chips">
            <span className="hand-match-chip-label">{t('handMatch.recommendedShapes')}</span>
            {skinProfile.recommendedShapes.map((s) => (
              <span key={s} className="hand-match-chip">{s}</span>
            ))}
          </div>
        )}
      </section>

      <ul className="hand-match-recs" aria-label="recommendations">
        {recommendations.map(({ style, reasonZh, reasonEn }) => {
          const reason = language === 'zh-CN' ? reasonZh : reasonEn;
          const title = (language === 'zh-CN' && style.titleLocalized?.zh) ? style.titleLocalized.zh : style.title;
          return (
            <li key={style.id} className="hand-match-rec-card">
              {style.imageUrl && (
                <img alt={title} className="hand-match-rec-img" src={style.imageUrl} />
              )}
              <div className="hand-match-rec-body">
                <p className="hand-match-rec-name">{title}</p>
                <p className="hand-match-rec-reason">{reason}</p>
                <Link className="hand-match-rec-cta" href={getCustomerStylePath(style.id)}>
                  {t('handMatch.viewDetail')}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      <button className="hand-match-retry-btn" type="button" onClick={onRetry}>
        {t('handMatch.retry')}
      </button>
    </div>
  );
}

function ErrorView({ message, retryLabel, onRetry }: { message: string; retryLabel: string; onRetry: () => void }) {
  return (
    <div className="hand-match-error" role="alert">
      <p>{message}</p>
      <button className="hand-match-retry-btn" type="button" onClick={onRetry}>
        {retryLabel}
      </button>
    </div>
  );
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip the data URL prefix (data:<mime>;base64,)
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/customer/HandMatchClient.tsx
git commit -m "feat: add HandMatchClient — upload/loading/results/error states"
```

---

## Task 5: Wire up the page and update the nav button

**Files:**
- Create: `src/app/customer/hand-match/page.tsx`
- Modify: `src/components/layout/MobileLayout.tsx`

- [ ] **Step 1: Create `src/app/customer/hand-match/page.tsx`**

```tsx
import { MobileLayout } from '@/components/layout/MobileLayout';
import { HandMatchClient } from '@/features/customer/HandMatchClient';

export default function HandMatchPage() {
  return (
    <MobileLayout role="customer" title="Nailed-it">
      <HandMatchClient />
    </MobileLayout>
  );
}
```

- [ ] **Step 2: Update the CTA in `src/components/layout/MobileLayout.tsx`**

Change line 55 — swap `getCustomerBookingPath()` for `getCustomerHandMatchPath()`:

```tsx
import {
  getCustomerHandMatchPath,   // ← add
  getCustomerProfilePath,
  getMerchantProfilePath,
  getMockSession
} from '@/domain/session';
```

And update the `rightSlot` JSX:

```tsx
<ResetLink aria-label={newNailDesignLabel} className="top-bar-cta" href={getCustomerHandMatchPath()}>
  <span aria-hidden="true">＋ </span>
  {newNailDesignLabel}
</ResetLink>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/customer/hand-match/page.tsx src/components/layout/MobileLayout.tsx
git commit -m "feat: add /customer/hand-match page and wire top-bar CTA to skin-match"
```

---

## Task 6: Add basic CSS for the new page

**Files:**
- Modify: `src/app/globals.css`

The existing `globals.css` contains all custom CSS. Add a `/* Hand Match */` section at the end.

- [ ] **Step 1: Append hand-match styles to `src/app/globals.css`**

Add at the very end of the file:

```css
/* Hand Match */
.hand-match-page {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-height: 100%;
}

.hand-match-idle {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

.hand-match-upload-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-6);
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  text-align: center;
  width: 100%;
  max-width: 320px;
}

.hand-match-upload-icon {
  font-size: 3rem;
}

.hand-match-upload-title {
  font-weight: 600;
  font-size: var(--text-lg);
  color: var(--color-text);
}

.hand-match-upload-subtitle {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.hand-match-btn {
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--color-brand);
  color: #fff;
  border: none;
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
}

.hand-match-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: var(--space-4);
  color: var(--color-text-secondary);
}

.hand-match-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-brand);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.hand-match-results {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.hand-match-skin-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.hand-match-skin-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-text);
}

.hand-match-skin-summary {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.hand-match-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1);
}

.hand-match-chip-label {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  margin-right: var(--space-1);
}

.hand-match-chip {
  padding: 2px 10px;
  background: var(--color-brand-subtle, #fce7f3);
  color: var(--color-brand);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 500;
}

.hand-match-recs {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.hand-match-rec-card {
  display: flex;
  gap: var(--space-3);
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  overflow: hidden;
  padding: var(--space-3);
}

.hand-match-rec-img {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: var(--radius-md);
  flex-shrink: 0;
}

.hand-match-rec-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
}

.hand-match-rec-name {
  font-weight: 600;
  font-size: var(--text-sm);
  color: var(--color-text);
}

.hand-match-rec-reason {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.hand-match-rec-cta {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-brand);
  text-decoration: none;
  margin-top: auto;
}

.hand-match-retry-btn {
  align-self: center;
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.hand-match-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: var(--space-4);
  text-align: center;
  color: var(--color-text-secondary);
}
```

- [ ] **Step 2: Start the dev server and verify the page renders**

```bash
./dev
```

Navigate to `http://localhost:3000/customer/home`. Confirm:
1. Top-right button now reads "测肤荐甲" (zh) or "Skin Match" (en)
2. Clicking it navigates to `/customer/hand-match`
3. The upload slot is visible on the new page
4. "预约" bottom tab still navigates to `/customer/booking`

- [ ] **Step 3: Test the upload flow manually**

1. On `/customer/hand-match`, tap the upload slot and choose a hand photo
2. Loading spinner appears with "正在分析肤色…" text
3. Results appear: skin tone summary card with palettes/shapes chips + 3 recommendation cards with reasons
4. Tapping "查看详情" on a card navigates to `/customer/style/[id]`
5. Upload a non-hand image (e.g. a landscape photo) → error message "请上传清晰的手部照片" appears with retry button

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add hand-match page styles"
```

---

## Verification Checklist

- [ ] `npm test` passes with no regressions
- [ ] `npx tsc --noEmit` reports no type errors
- [ ] Top-bar CTA on customer home shows "测肤荐甲" / "Skin Match"
- [ ] CTA links to `/customer/hand-match` (not `/customer/booking`)
- [ ] "预约" bottom tab still goes to `/customer/booking`
- [ ] Upload → loading → results flow works end-to-end
- [ ] Non-hand image shows the invalid-image error
- [ ] "查看详情" on a recommendation card opens the correct style detail page
- [ ] Language switch (zh ↔ en) reflects on all new strings
