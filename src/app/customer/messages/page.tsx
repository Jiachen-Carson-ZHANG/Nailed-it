import { MobileLayout } from '@/components/layout/MobileLayout';
import { ConversationListItem } from '@/features/messages/ConversationListItem';
import { getCustomerMessagesPath } from '@/domain/session';
import { customerConversations } from '@/mock/conversations';

export default function CustomerMessagesPage() {
  return (
    <MobileLayout
      role="customer"
      subtitle="Booking-linked customer threads reuse the shared conversation snapshots."
      title="Nailed-it"
    >
      <section className="page-heading">
        <p className="section-eyebrow">Inbox</p>
        <h1>Messages</h1>
        <p className="section-copy">Stay aligned with your merchant before the appointment starts.</p>
      </section>
      <section className="conversation-list">
        {customerConversations.map((conversation) => (
          <ConversationListItem
            key={conversation.id}
            conversation={conversation}
            href={getCustomerMessagesPath(conversation.id)}
          />
        ))}
      </section>
    </MobileLayout>
  );
}
