import { GET } from './route';

describe('Pinterest callback placeholder route', () => {
  it('returns a public ready response for the registered redirect URI', async () => {
    const response = GET(
      new Request('https://nailed-it.example/api/integrations/pinterest/callback')
    );

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      provider: 'pinterest'
    });
    expect(response.status).toBe(200);
  });

  it('surfaces OAuth provider errors without attempting token exchange', async () => {
    const response = GET(
      new Request('https://nailed-it.example/api/integrations/pinterest/callback?error=access_denied')
    );

    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'access_denied',
      provider: 'pinterest'
    });
    expect(response.status).toBe(400);
  });
});
