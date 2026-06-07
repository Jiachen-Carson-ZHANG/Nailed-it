import { MobileLayout } from '@/components/layout/MobileLayout';
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
    </MobileLayout>
  );
}
