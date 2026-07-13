import type { BookingConversationThread } from '@/domain/nail';

export const seedConversationThreads: BookingConversationThread[] = [
  {
    id: 'conv-melissa',
    bookingId: 'booking-001',
    customerName: 'Melissa Tan',
    merchantName: 'Nailed-it Studio',
    relatedBookingTime: 'Today 14:00',
    customerLanguage: 'zh-CN',
    messages: [
      {
        id: 'm1',
        authorRole: 'system',
        body: '预约已确认，技师 Mei Chen，时间 今天 14:00。',
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
    customerLanguage: 'zh-CN',
    messages: [
      {
        id: 'a1',
        authorRole: 'system',
        body: '预约已确认，技师 Lina Park，时间 今天 16:00。',
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
        body: '你的预约正在等待商家确认，技师 Mei Chen，时间 明天 15:30。',
        sentAt: '18:41'
      }
    ]
  }
];
