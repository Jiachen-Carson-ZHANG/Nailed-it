import { describe, it, expect, vi, beforeEach } from 'vitest';

const { record } = vi.hoisted(() => ({ record: vi.fn() }));
vi.mock('@/lib/repositories', () => ({
  getRepositories: () => ({ analytics: { record } }),
}));

import { trackEventAction } from './analytics-actions';

describe('trackEventAction', () => {
  beforeEach(() => {
    record.mockReset();
    record.mockResolvedValue(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('records a valid event', async () => {
    await trackEventAction({ eventType: 'style_save', merchantId: 'm', customerId: 'c', styleId: 's' });
    expect(record).toHaveBeenCalledOnce();
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'style_save', styleId: 's' }));
  });

  it('rejects an unknown event_type without recording', async () => {
    // @ts-expect-error — exercising the public server-action boundary with an invalid type
    await trackEventAction({ eventType: 'bogus', merchantId: 'm' });
    expect(record).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it('swallows a repository failure so capture never breaks the flow', async () => {
    record.mockRejectedValueOnce(new Error('db down'));
    await expect(
      trackEventAction({ eventType: 'booking_confirmed', merchantId: 'm' }),
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});
