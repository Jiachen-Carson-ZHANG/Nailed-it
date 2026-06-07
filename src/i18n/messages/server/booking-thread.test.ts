import { describe, expect, it } from 'vitest';
import type { AppLanguage } from '@/i18n/types';
import {
  bookingCompletedThankYouMessage,
  bookingPendingReviewMessage,
} from '@/i18n/messages/server/booking-thread';

describe('booking thread messages', () => {
  const langs: AppLanguage[] = ['zh-CN', 'en'];

  it('localizes pending-review system messages', () => {
    for (const language of langs) {
      const body = bookingPendingReviewMessage(language, 'Mei', '14:00');
      expect(body).toContain('Mei');
      expect(body).toContain('14:00');
    }
    expect(bookingPendingReviewMessage('en', 'Mei', '14:00')).toContain('pending');
    expect(bookingPendingReviewMessage('zh-CN', 'Mei', '14:00')).toContain('确认');
  });

  it('localizes completion thank-you messages', () => {
    expect(bookingCompletedThankYouMessage('en')).toContain('complete');
    expect(bookingCompletedThankYouMessage('zh-CN')).toContain('完成');
  });
});
