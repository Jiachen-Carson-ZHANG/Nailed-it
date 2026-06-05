'use client';

import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import type { Conversation } from '@/domain/nail';
import { ChatRoom } from '@/features/messages/ChatRoom';
import { getConversationForRoleAction, sendMessageAction } from '@/lib/actions/conversation-actions';

type CustomerConversationClientProps = {
  conversationId: string;
};

export function CustomerConversationClient({ conversationId }: CustomerConversationClientProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getConversationForRoleAction(conversationId, 'customer')
      .then((c) => {
        if (active) setConversation(c);
      })
      .catch(() => {
        /* leave null → not-found */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [conversationId]);

  async function handleSend(body: string) {
    const updated = await sendMessageAction({ conversationId, authorRole: 'customer', role: 'customer', body });
    if (updated) setConversation(updated);
  }

  if (loading) {
    return (
      <section className="page-heading">
        <LoadingState title="Loading conversation" body="Fetching your messages." />
      </section>
    );
  }

  return conversation ? (
    <ChatRoom conversation={conversation} onSend={handleSend} />
  ) : (
    <section className="page-heading">
      <EmptyState
        body="We couldn't find that conversation. Try the list again."
        title="Conversation not found"
      />
    </section>
  );
}
