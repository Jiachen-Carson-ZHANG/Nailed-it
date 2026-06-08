import { describe, expect, it } from 'vitest';
import { extractImageFromArkGeneration, runTryOn, TryOnError } from './try-on';

describe('runTryOn', () => {
  it('requires ARK_API_KEY when try-on runs', async () => {
    await expect(
      runTryOn('hand', 'image/jpeg', 'style', 'image/jpeg', { NODE_ENV: 'test' } as NodeJS.ProcessEnv)
    ).rejects.toMatchObject({ code: 'missing_config' } satisfies Partial<TryOnError>);
  });
});

describe('extractImageFromArkGeneration', () => {
  it('reads b64_json output into the existing TryOnResult contract', () => {
    expect(
      extractImageFromArkGeneration({
        data: [{ b64_json: 'base64-image-data' }]
      })
    ).toEqual({
      imageBase64: 'base64-image-data',
      mimeType: 'image/png'
    });
  });
});
