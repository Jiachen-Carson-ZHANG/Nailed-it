import type { BookingConversationThread } from '@/domain/nail';

export const seedConversationThreads: BookingConversationThread[] = [
  {
    id: 'conv-melissa',
    bookingId: 'booking-001',
    customerName: 'Melissa Tan',
    merchantName: 'Nailed-it Studio',
    relatedBookingTime: 'Today 14:00',
    customerLanguage: 'en',
    messages: [
      {
        id: 'm1',
        authorRole: 'system',
        body: 'Appointment confirmed for Today 14:00 with Mei Chen.',
        sentAt: '13:10'
      }
    ]
  },
  {
    id: 'conv-amy',
    bookingId: 'booking-002',
    customerName: 'Amy Lim',
    merchantName: 'Nailed-it Studio',
    relatedBookingTime: 'Today 16:00',
    customerLanguage: 'en',
    messages: [
      {
        id: 'a1',
        authorRole: 'system',
        body: 'Appointment confirmed for Today 16:00 with Lina Park.',
        sentAt: '10:09'
      }
    ]
  },
  {
    id: 'conv-rachel',
    bookingId: 'booking-004',
    customerName: 'Rachel Goh',
    merchantName: 'Nailed-it Studio',
    relatedBookingTime: 'Tomorrow 15:30',
    customerLanguage: 'zh-CN',
    messages: [
      {
        id: 'r1',
        authorRole: 'system',
        body: 'Appointment pending review for Tomorrow 15:30 with Mei Chen.',
        sentAt: '18:41'
      }
    ]
  }
];
