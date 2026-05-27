'use client';

import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { EmptyState } from '@/components/ui/EmptyState';
import { getMerchantMessagesPath } from '@/domain/session';
import { ConversationListItem } from '@/features/messages/ConversationListItem';
import { getConversationsForRole } from '@/mock/operations-store';

export default function MerchantMessagesPage() {
  const [conversations] = useState(() => getConversationsForRole('merchant'));

  return (
    <MobileLayout
      role="merchant"
      title="Nailed-it"
    >
      <section className="page-heading">
        <p className="section-eyebrow">Inbox</p>
        <h1>Messages inbox</h1>
        <p className="section-copy">Review customer updates before they turn into schedule changes.</p>
      </section>
      {conversations.length === 0 ? (
        <EmptyState
          icon="✉︎"
          title="No customer messages yet"
          body="Customer threads will appear here when bookings come in."
        />
      ) : (
        <>
          <section className="conversation-list">
            {conversations.map((conversation) => (
              <ConversationListItem
                key={conversation.id}
                conversation={conversation}
                href={getMerchantMessagesPath(conversation.id)}
              />
            ))}
          </section>
          <p className="messages-footer-hint">
            Replies post live to both sides of the thread.
          </p>
        </>
      )}
    </MobileLayout>
  );
}
