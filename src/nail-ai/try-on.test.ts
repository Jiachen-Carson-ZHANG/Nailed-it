import { describe, expect, it } from 'vitest';
import type { TryOnError as TryOnErrorType } from './try-on';
import { runTryOn } from './try-on';

describe('runTryOn', () => {
  it('requires at least one API key when try-on runs', async () => {
    await expect(
      runTryOn('hand', 'image/jpeg', 'style', 'image/jpeg', '', { NODE_ENV: 'test' } as NodeJS.ProcessEnv)
    ).rejects.toMatchObject({ code: 'missing_config' } satisfies Partial<TryOnErrorType>);
  });
});
