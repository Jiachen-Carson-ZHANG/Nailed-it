import { describe, expect, it, vi, beforeEach } from 'vitest';

// postImageGeneration is mocked so runCollageGen can be tested without a provider.
vi.mock('./openrouter', () => ({
  postImageGeneration: vi.fn(async () => 'FAKE_BASE64'),
}));

import { postImageGeneration } from './openrouter';
import { buildNailPrompt, runCollageGen, type CollageIngredient } from './collage-nail-gen';

const ings: CollageIngredient[] = [
  { category: 'color', label: '裸色甲油' },
  { category: 'art', label: '法式白边' },
];

describe('buildNailPrompt', () => {
  it('initial 模式加入严格约束：只渲染所列元素、不得自行添加装饰', () => {
    const prompt = buildNailPrompt(ings, '', { kind: 'initial' });
    expect(prompt).toContain('EXACTLY');
    expect(prompt).toMatch(/Do NOT (invent|add)/i);
    // 必须维度缺省默认
    expect(prompt).toMatch(/round/i);
    expect(prompt).toMatch(/nude/i);
  });

  it('initial 模式默认（不传 mode）也带严格约束', () => {
    const prompt = buildNailPrompt(ings, '');
    expect(prompt).toContain('EXACTLY');
  });

  it('regen 模式指示保持参考图一致、仅改选中类目', () => {
    const prompt = buildNailPrompt(ings, '', { kind: 'regen', changedCategories: ['nail art'] });
    expect(prompt).toMatch(/IDENTICAL to the reference/i);
    expect(prompt).toContain('nail art');
    // regen 不应再喊 initial 的「不得添加任何装饰」硬约束（避免与"参考图已有装饰"冲突）
    expect(prompt).not.toMatch(/Do NOT invent/i);
  });

  it('把所选元素按类目描述写进 prompt', () => {
    const prompt = buildNailPrompt(ings, '额外要求测试', { kind: 'initial' });
    expect(prompt).toContain('裸色甲油');
    expect(prompt).toContain('法式白边');
    expect(prompt).toContain('额外要求测试');
  });
});

describe('runCollageGen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const env = { ARK_API_KEY: 'test-key' } as unknown as NodeJS.ProcessEnv;

  it('无参考图时 images 为空数组（首次生成）', async () => {
    await runCollageGen(ings, '', {}, env);
    const call = vi.mocked(postImageGeneration).mock.calls[0][0];
    expect(call.images).toEqual([]);
  });

  it('有参考图时把它放进 images（重新生成）', async () => {
    await runCollageGen(ings, '', {
      referenceImage: { base64: 'REFB64', mimeType: 'image/png' },
      mode: { kind: 'regen', changedCategories: ['decoration'] },
    }, env);
    const call = vi.mocked(postImageGeneration).mock.calls[0][0];
    expect(call.images).toEqual([{ base64: 'REFB64', mimeType: 'image/png' }]);
    expect(call.prompt).toMatch(/IDENTICAL to the reference/i);
    expect(call.prompt).toContain('decoration');
  });

  it('缺少 API key 时抛 missing_config', async () => {
    await expect(
      runCollageGen(ings, '', {}, { NODE_ENV: 'test' } as NodeJS.ProcessEnv),
    ).rejects.toThrow('OPENROUTER_API_KEY or ARK_API_KEY');
  });
});
