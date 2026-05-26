'use client';

import { useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { toConversationForRole } from '@/domain/messaging';
import type { Conversation } from '@/domain/nail';
import { ChatRoom } from '@/features/messages/ChatRoom';
import { getConversationForRole, sendMessage } from '@/mock/operations-store';

type MerchantConversationClientProps = {
  conversationId: string;
};

export function MerchantConversationClient({ conversationId }: MerchantConversationClientProps) {
  const [conversation, setConversation] = useState<Conversation | null>(() =>
    getConversationForRole(conversationId, 'merchant')
  );

  function handleSend(body: string) {
    const updatedThread = sendMessage({
      authorRole: 'merchant',
      body,
      conversationId
    });

    if (updatedThread) {
      setConversation(toConversationForRole(updatedThread, 'merchant'));
    }
  }

  return conversation ? (
    <ChatRoom conversation={conversation} onSend={handleSend} />
  ) : (
    <section className="page-heading">
      <EmptyState
        body="We couldn't find that thread. Try the inbox again."
        title="Conversation not found"
      />
    </section>
  );
}
