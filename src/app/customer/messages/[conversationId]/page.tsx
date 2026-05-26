import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { getCustomerMessagesPath } from '@/domain/session';
import { CustomerConversationClient } from './conversation-client';

export default async function CustomerConversationPage({
  params
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;

  return (
    <MobileLayout
      role="customer"
      title="Nailed-it"
    >
      <CustomerConversationClient conversationId={conversationId} />
      <Link className="button button-secondary" href={getCustomerMessagesPath()}>
        Back to messages
      </Link>
    </MobileLayout>
  );
}
