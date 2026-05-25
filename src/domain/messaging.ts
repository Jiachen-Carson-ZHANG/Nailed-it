import type { BookingConversationThread, ChatMessage, Conversation, UserRole } from './nail';

export function toConversationForRole(
  thread: BookingConversationThread,
  viewerRole: UserRole
): Conversation {
  const participantName = viewerRole === 'customer' ? thread.merchantName : thread.customerName;
  const participantRole: UserRole = viewerRole === 'customer' ? 'merchant' : 'customer';
  const messages = thread.messages.map<ChatMessage>((message) => ({
    id: message.id,
    author:
      message.authorRole === 'system'
        ? 'system'
        : message.authorRole === viewerRole
          ? 'me'
          : 'them',
    body: message.body,
    sentAt: message.sentAt
  }));
  const lastMessage = messages.at(-1)?.body ?? '';

  return {
    id: thread.id,
    participantName,
    participantRole,
    avatarInitials: toInitials(participantName),
    lastMessage,
    unreadCount: thread.messages.filter(
      (message) => message.authorRole !== 'system' && message.authorRole !== viewerRole
    ).length,
    relatedBookingTime: thread.relatedBookingTime,
    messages
  };
}

function toInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
