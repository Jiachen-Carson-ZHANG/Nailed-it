import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { EmptyState } from '@/components/ui/EmptyState';
import { getMerchantMessagesPath } from '@/domain/session';
import { ChatRoom } from '@/features/messages/ChatRoom';
import { merchantConversations } from '@/mock/conversations';

export default async function MerchantConversationPage({
  params
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const conversation = merchantConversations.find((item) => item.id === conversationId);

  return (
    <MobileLayout
      role="merchant"
      subtitle="Merchant chat threads surface customer intent without splitting data away from the shared mock source."
      title="Nailed-it"
    >
      {conversation ? (
        <ChatRoom conversation={conversation} />
      ) : (
        <section className="page-heading">
          <EmptyState
            body="The selected customer thread is not available in the current merchant inbox snapshot."
            title="Conversation not found"
          />
        </section>
      )}
      <Link className="button button-secondary" href={getMerchantMessagesPath()}>
        Back to messages
      </Link>
    </MobileLayout>
  );
}
