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
