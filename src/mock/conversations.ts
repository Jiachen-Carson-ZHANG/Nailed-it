import type { ChatMessage, Conversation } from '@/domain/nail';

const melissaThread: ChatMessage[] = [
  {
    id: 'm1',
    author: 'them',
    body: 'Hi Melissa, we reviewed your reference image and can keep the cat-eye shine soft.',
    sentAt: '13:10'
  },
  {
    id: 'm2',
    author: 'me',
    body: 'Can the rhinestones be a little more subtle?',
    sentAt: '13:12'
  },
  {
    id: 'm3',
    author: 'them',
    body: 'Yes, we can reduce the crystal count and keep the placement near the ring finger only.',
    sentAt: '13:14'
  }
];

export const customerConversations: Conversation[] = [
  {
    id: 'conv-merchant',
    participantName: 'Nailed-it Studio',
    participantRole: 'merchant',
    avatarInitials: 'NS',
    lastMessage: 'Yes, we can reduce the crystal count and keep the placement near the ring finger only.',
    unreadCount: 1,
    relatedBookingTime: 'Today 14:00',
    messages: melissaThread
  }
];

export const merchantConversations: Conversation[] = [
  {
    id: 'conv-melissa',
    participantName: 'Melissa Tan',
    participantRole: 'customer',
    avatarInitials: 'MT',
    lastMessage: 'Can the rhinestones be a little more subtle?',
    unreadCount: 2,
    relatedBookingTime: 'Today 14:00',
    messages: melissaThread
  },
  {
    id: 'conv-amy',
    participantName: 'Amy Lim',
    participantRole: 'customer',
    avatarInitials: 'AL',
    lastMessage: 'See you at 4pm.',
    unreadCount: 0,
    relatedBookingTime: 'Today 16:00',
    messages: [
      { id: 'a1', author: 'them', body: 'See you at 4pm.', sentAt: '10:08' },
      { id: 'a2', author: 'me', body: 'Confirmed. Thank you.', sentAt: '10:09' }
    ]
  },
  {
    id: 'conv-rachel',
    participantName: 'Rachel Goh',
    participantRole: 'customer',
    avatarInitials: 'RG',
    lastMessage: 'Could I switch to the 6pm slot if it opens up?',
    unreadCount: 1,
    relatedBookingTime: 'Tomorrow 15:30',
    messages: [
      {
        id: 'r1',
        author: 'them',
        body: 'Could I switch to the 6pm slot if it opens up?',
        sentAt: '18:41'
      },
      {
        id: 'r2',
        author: 'me',
        body: 'Noted. I will message you if the evening slot becomes available.',
        sentAt: '18:43'
      }
    ]
  }
];
