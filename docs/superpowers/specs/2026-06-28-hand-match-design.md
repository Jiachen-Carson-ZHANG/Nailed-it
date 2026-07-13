# Hand Match Feature — Design Spec

_Date: 2026-06-28_

## Context

The "上传款式" button in the top-right corner of the customer home page currently navigates to `/customer/booking` (the style upload → AI recognition → quote flow). We are replacing this entry point with a new AI-powered personalisation feature: the user uploads a photo of their hand, the AI analyses their skin tone, and the app recommends 3 published styles from the merchant catalog that will complement their complexion. Each recommendation links to the existing style detail / booking prefill flow.

The booking flow remains accessible via the "预约" tab in the bottom navigation bar.

---

## Navigation Change

**File:** `src/components/layout/MobileLayout.tsx`

- Change the `href` on the top-right CTA from `getCustomerBookingPath()` to `/customer/hand-match`
- Change the label:
  - zh-CN: `上传款式` → `测肤荐甲`
  - en: `Upload Style` → `Skin Match`
- i18n keys live in `src/i18n/messages/ui/zh-CN.ts` and the English equivalent

---

## New Page

**Route:** `/customer/hand-match`

**Files to create:**
- `src/app/customer/hand-match/page.tsx` — Next.js page shell (server component, uses `MobileLayout`)
- `src/features/customer/HandMatchClient.tsx` — all interactive state lives here

**Page states (managed in HandMatchClient):**

| State | What the user sees |
|---|---|
| `idle` | Upload slot, brief copy ("上传你的手部照片，AI 帮你找最适合的美甲"), upload button |
| `loading` | Spinner + copy ("正在分析肤色…") while API call runs |
| `results` | Skin tone summary card + 3 style recommendation cards |
| `error` | Error message + retry button |

**Results layout:**
- **Skin tone summary card** at top: displays `skinProfile.summaryZh`, recommended palettes as chips, recommended shapes as chips
- **3 recommendation cards** below: style image thumbnail, style name, one-line reason (`recommendationReasonZh`), "查看详情" button → navigates to existing style detail page (with booking prefill)

Both zh and en strings are present in the API response; HandMatchClient selects based on active locale.

---

## AI Layer

**New file:** `src/nail-ai/skin-match.ts`

### `analyzeSkinTone(imageBase64: string, mimeType: string): Promise<SkinProfile>`

Calls Ark vision model (`doubao-seed-2-0-lite-260215`). Returns:

```ts
interface SkinProfile {
  toneCategory: 'warm' | 'cool' | 'neutral'
  depth: 'light' | 'medium' | 'deep'
  recommendedPalettes: string[]   // e.g. ["裸粉", "珊瑚", "薄荷绿"]
  recommendedShapes: string[]     // e.g. ["杏仁形", "椭圆形"]
  summaryZh: string               // e.g. "暖调浅肤 · 适合裸粉、珊瑚色系"
  summaryEn: string
}
```

Invalid / non-hand image: retries once, then throws a typed error `{ code: 'invalid_hand_image' }` so the route can return a user-facing 422.

### `rankStylesForSkin(skinProfile: SkinProfile, candidates: CandidateStyle[]): Promise<RankedStyle[]>`

Second Ark call (text-only, same model). Input: skin profile + compact JSON array of up to 50 candidate styles. Returns top 3 style IDs each with a one-line reason (zh + en).

```ts
interface CandidateStyle {
  id: string
  nameCn: string
  colorTags: string[]
  shapeTags: string[]
  styleTags: string[]
}

interface RankedStyle {
  styleId: string
  reasonZh: string
  reasonEn: string
}
```

---

## API Route

**New file:** `src/app/api/ai/skin-match/route.ts`

**Method:** `POST`  
**Body:** `{ imageBase64: string, mimeType: string }`

**Execution sequence:**

1. Call `analyzeSkinTone(imageBase64, mimeType)` → `skinProfile`
2. Fetch all published styles via `getRepositories().styleRepository`
3. Pre-filter candidates: keep styles whose color or shape facets overlap with `skinProfile.recommendedPalettes` or `skinProfile.recommendedShapes`
4. Cap filtered result at 50 (sorted by newest)
5. Call `rankStylesForSkin(skinProfile, candidates)` → top 3 `RankedStyle[]`
6. Fetch full style records for the 3 IDs from the repository
7. Return `{ skinProfile, recommendations: [{ style: FullStyle, reasonZh, reasonEn }] }`

**Error responses:**

| Code | HTTP | Condition |
|---|---|---|
| `invalid_hand_image` | 422 | AI rejects the uploaded image |
| `no_candidates` | 400 | Filtered candidate set is empty (no styles published yet) |
| `ai_error` | 502 | Ark API failure after retry |

---

## Data Flow Summary

```
HandMatchClient
  → POST /api/ai/skin-match { imageBase64, mimeType }
  → analyzeSkinTone()          (Ark vision call)
  → filter + cap published styles
  → rankStylesForSkin()        (Ark text call)
  → fetch full style records
  → { skinProfile, recommendations }
HandMatchClient renders results
  → tap style card → existing style detail page (booking prefill)
```

No new DB tables. Reads from existing `published_styles` via `getRepositories()`.

---

## i18n

New keys needed in both `zh-CN.ts` and `en.ts`:

| Key | zh-CN | en |
|---|---|---|
| `layout.newNailDesign` | `测肤荐甲` | `Skin Match` |
| `handMatch.title` | `测肤荐甲` | `Skin Match` |
| `handMatch.uploadPrompt` | `上传你的手部照片` | `Upload a photo of your hand` |
| `handMatch.uploadSubtitle` | `AI 帮你找最适合的美甲` | `AI finds the best nail styles for your skin tone` |
| `handMatch.analyzing` | `正在分析肤色…` | `Analysing your skin tone…` |
| `handMatch.skinSummaryTitle` | `你的肤色分析` | `Your Skin Tone` |
| `handMatch.viewDetail` | `查看详情` | `View Details` |
| `handMatch.retry` | `重新上传` | `Try Again` |
| `handMatch.errorInvalidImage` | `请上传清晰的手部照片` | `Please upload a clear photo of your hand` |
| `handMatch.errorNoStyles` | `暂无匹配款式，请稍后再试` | `No matching styles found, please try again later` |

---

## Verification

1. Start dev server: `./dev`
2. Navigate to customer home — confirm top-right button now reads "测肤荐甲" and links to `/customer/hand-match`
3. Confirm "预约" bottom tab still navigates to `/customer/booking`
4. On `/customer/hand-match`: upload a hand photo → loading spinner appears → results show skin summary + 3 style cards with reasons
5. Upload a non-hand image → user-facing error message appears
6. Tap a style card → navigates to style detail page
7. Switch language (中/EN) → all strings on the page switch correctly
8. Run `npm test` — no regressions
