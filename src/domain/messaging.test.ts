import { describe, expect, it } from 'vitest';
import type { BookingConversationThread } from './nail';
import { toConversationForRole } from './messaging';

const thread: BookingConversationThread = {
  id: 'thread-booking-123',
  bookingId: 'booking-123',
  customerName: 'Carson Lee',
  merchantName: 'Nailed-it Studio',
  relatedBookingTime: 'Today 10:00',
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
});
