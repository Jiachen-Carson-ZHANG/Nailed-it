import { describe, expect, it } from 'vitest';
import type { BookingConversationThread } from './nail';
import { toConversationForRole } from './messaging';

const thread: BookingConversationThread = {
  id: 'thread-booking-123',
  bookingId: 'booking-123',
  customerName: 'Carson Lee',
  merchantName: 'Nailed-it Studio',
  relatedBookingTime: 'Today 10:00',
  customerLanguage: 'en',
  messages: [
    {
      id: 'msg-system',
      authorRole: 'system',
      body: 'Your appointment is confirmed.',
      sentAt: '10:00'
    },
    {
      id: 'msg-customer',
      authorRole: 'customer',
      body: 'Can I arrive 10 minutes early?',
      sentAt: '10:01'
    },
    {
      id: 'msg-merchant',
      authorRole: 'merchant',
      body: 'Yes, that works.',
      sentAt: '10:02'
    }
  ]
};

describe('toConversationForRole', () => {
  it('maps one booking thread into the customer conversation perspective', () => {
    const conversation = toConversationForRole(thread, 'customer');

    expect(conversation.participantName).toBe('Nailed-it Studio');
    expect(conversation.participantRole).toBe('merchant');
    expect(conversation.messages.map((message) => message.author)).toEqual([
      'system',
      'me',
      'them'
    ]);
    expect(conversation.lastMessage).toBe('Yes, that works.');
  });

  it('maps one booking thread into the merchant conversation perspective', () => {
    const conversation = toConversationForRole(thread, 'merchant');

    expect(conversation.participantName).toBe('Carson Lee');
    expect(conversation.participantRole).toBe('customer');
    expect(conversation.messages.map((message) => message.author)).toEqual([
      'system',
      'them',
      'me'
    ]);
  });

  it('carries a style attachment through to the view message (rich recommendation card)', () => {
    const withCard: BookingConversationThread = {
      ...thread,
      messages: [
        {
          id: 'msg-reco',
          authorRole: 'merchant',
          body: '为你推荐：碎钻冰花法式 · 法式风 · 裸色',
          sentAt: '10:03',
          attachment: {
            type: 'style',
            styleId: 'style-melissa-img-8265',
            title: '碎钻冰花法式',
            imageUrl: 'https://example.test/8265.jpg',
            reason: '法式风 · 裸色'
          }
        }
      ]
    };

    const [message] = toConversationForRole(withCard, 'customer').messages;
    expect(message.attachment).toEqual({
      type: 'style',
      styleId: 'style-melissa-img-8265',
      title: '碎钻冰花法式',
      imageUrl: 'https://example.test/8265.jpg',
      reason: '法式风 · 裸色'
    });
    // The customer is the recipient → the merchant's card shows as 'them'.
    expect(message.author).toBe('them');
  });
});
