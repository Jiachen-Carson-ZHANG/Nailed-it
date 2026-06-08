import { describe, expect, it, vi } from 'vitest';
import { fetchAITrendingStyles, TrendingStylesError } from './trending-styles';

describe('fetchAITrendingStyles', () => {
  it('requires ARK_API_KEY for trending styles', async () => {
    await expect(fetchAITrendingStyles({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)).rejects.toMatchObject({
      code: 'missing_config'
    } satisfies Partial<TrendingStylesError>);
  });

  it('calls Ark responses and returns normalized trending styles', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        output: [
          {
            content: [
              {
                text: JSON.stringify([
                  {
                    rank: 1,
                    name: 'Glazed Chrome',
                    nameCn: '镜面奶油',
                    description: 'Soft chrome shine with clean neutral tones.',
                    tags: ['chrome', 'glazed', 'neutral']
                  }
                ])
              }
            ]
          }
        ]
      })
    }));

    vi.stubGlobal('fetch', fetchImpl);

    const result = await fetchAITrendingStyles({
      NODE_ENV: 'test',
      ARK_API_KEY: 'test-ark-key',
      ARK_TRENDING_MODEL: 'doubao-seed-2-0-lite-260428'
    } as unknown as NodeJS.ProcessEnv);

    expect(result.styles).toHaveLength(1);
    expect(result.styles[0]).toMatchObject({
      rank: 1,
      name: 'Glazed Chrome',
      nameCn: '镜面奶油'
    });

    const [url, request] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://ark.cn-beijing.volces.com/api/v3/responses');
    expect((request.headers as Record<string, string>).Authorization).toBe('Bearer test-ark-key');

    const body = JSON.parse(String(request.body));
    expect(body.model).toBe('doubao-seed-2-0-lite-260428');
    expect(body.input[0].content[0]).toEqual({
      type: 'input_text',
      text: expect.stringContaining('List the top 3 trending nail styles RIGHT NOW')
    });
  });
});
