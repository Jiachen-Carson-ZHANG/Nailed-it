'use client';

import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import type { Conversation } from '@/domain/nail';
import { ChatRoom } from '@/features/messages/ChatRoom';
import { getMerchantConversationAction, sendMerchantMessageAction } from '@/lib/actions/conversation-actions';

type MerchantConversationClientProps = {
  conversationId: string;
};

export function MerchantConversationClient({ conversationId }: MerchantConversationClientProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getMerchantConversationAction(conversationId)
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
    const updated = await sendMerchantMessageAction(conversationId, body);
    if (updated) setConversation(updated);
  }

  if (loading) {
    return (
      <section className="page-heading">
        <LoadingState title="Loading conversation" body="Fetching the thread." />
      </section>
    );
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
