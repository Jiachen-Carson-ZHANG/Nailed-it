'use client';

import { useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { toConversationForRole } from '@/domain/messaging';
import type { Conversation } from '@/domain/nail';
import { ChatRoom } from '@/features/messages/ChatRoom';
import { getConversationForRole, sendMessage } from '@/mock/operations-store';

type CustomerConversationClientProps = {
  conversationId: string;
};

export function CustomerConversationClient({ conversationId }: CustomerConversationClientProps) {
  const [conversation, setConversation] = useState<Conversation | null>(() =>
    getConversationForRole(conversationId, 'customer')
  );

  function handleSend(body: string) {
    const updatedThread = sendMessage({
      authorRole: 'customer',
      body,
      conversationId
    });

    if (updatedThread) {
      setConversation(toConversationForRole(updatedThread, 'customer'));
    }
  }

  return conversation ? (
    <ChatRoom conversation={conversation} onSend={handleSend} />
  ) : (
    <section className="page-heading">
      <EmptyState
        body="The requested booking conversation is not available in the current mock dataset."
        title="Conversation not found"
      />
    </section>
  );
}
