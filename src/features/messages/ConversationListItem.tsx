import Link from 'next/link';
import type { Conversation } from '@/domain/nail';

type ConversationListItemProps = {
  conversation: Conversation;
  href: string;
};

export function ConversationListItem({ conversation, href }: ConversationListItemProps) {
  return (
    <Link className="conversation-list-item" href={href}>
      <div className="conversation-avatar" aria-hidden="true">
        {conversation.avatarInitials}
      </div>
      <div className="conversation-copy">
        <div className="conversation-row">
          <strong>{conversation.participantName}</strong>
          {conversation.relatedBookingTime ? <span>{conversation.relatedBookingTime}</span> : null}
        </div>
        <p>{conversation.lastMessage}</p>
      </div>
      {conversation.unreadCount > 0 ? (
        <span className="conversation-unread-badge" aria-label={`${conversation.unreadCount} unread`}>
          {conversation.unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
