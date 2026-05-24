import { MobileLayout } from '@/components/layout/MobileLayout';
import { getMerchantMessagesPath } from '@/domain/session';
import { ConversationListItem } from '@/features/messages/ConversationListItem';
import { merchantConversations } from '@/mock/conversations';

export default function MerchantMessagesPage() {
  return (
    <MobileLayout
      role="merchant"
      subtitle="Merchant inbox keeps each conversation tied to a nearby appointment context."
      title="Nailed-it"
    >
      <section className="page-heading">
        <p className="section-eyebrow">Inbox</p>
        <h1>Messages inbox</h1>
        <p className="section-copy">Review customer updates before they turn into schedule changes.</p>
      </section>
      <section className="conversation-list">
        {merchantConversations.map((conversation) => (
          <ConversationListItem
            key={conversation.id}
            conversation={conversation}
            href={getMerchantMessagesPath(conversation.id)}
          />
        ))}
      </section>
    </MobileLayout>
  );
}
