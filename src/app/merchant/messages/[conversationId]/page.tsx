import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { getMerchantMessagesPath } from '@/domain/session';
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
      subtitle="Merchant chat threads surface customer intent without splitting data away from the shared mock source."
      title="Nailed-it"
    >
      <MerchantConversationClient conversationId={conversationId} />
      <Link className="button button-secondary" href={getMerchantMessagesPath()}>
        Back to messages
      </Link>
    </MobileLayout>
  );
}
