import { MobileLayout } from '@/components/layout/MobileLayout';
import { MerchantConversationClient } from './conversation-client';

export default async function MerchantConversationPage({
  params
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;

  return (
    <MobileLayout
      role="merchant"
      title="Nailed-it"
    >
      <MerchantConversationClient conversationId={conversationId} />
    </MobileLayout>
  );
}
