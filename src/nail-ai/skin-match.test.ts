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
