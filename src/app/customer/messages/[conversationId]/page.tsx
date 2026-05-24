import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChatRoom } from '@/features/messages/ChatRoom';
import { getCustomerMessagesPath } from '@/domain/session';
import { customerConversations } from '@/mock/conversations';

export default async function CustomerConversationPage({
  params
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const conversation = customerConversations.find((item) => item.id === conversationId);

  return (
    <MobileLayout
      role="customer"
      subtitle="Each message thread stays anchored to its booking snapshot and merchant context."
      title="Nailed-it"
    >
      {conversation ? (
        <ChatRoom conversation={conversation} />
      ) : (
        <section className="page-heading">
          <EmptyState
            body="The requested booking conversation is not available in the current mock dataset."
            title="Conversation not found"
          />
        </section>
      )}
      <Link className="button button-secondary" href={getCustomerMessagesPath()}>
        Back to messages
      </Link>
    </MobileLayout>
  );
}
