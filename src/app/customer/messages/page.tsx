'use client';

import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConversationListItem } from '@/features/messages/ConversationListItem';
import { getCustomerMessagesPath } from '@/domain/session';
import { getConversationsForRole } from '@/mock/operations-store';

export default function CustomerMessagesPage() {
  const [conversations] = useState(() => getConversationsForRole('customer'));

  return (
    <MobileLayout
      role="customer"
      title="Nailed-it"
    >
      <section className="page-heading">
        <p className="section-eyebrow">Inbox</p>
        <h1>Messages</h1>
        <p className="section-copy">Stay aligned with your merchant before the appointment starts.</p>
      </section>
      {conversations.length === 0 ? (
        <EmptyState
          icon="✉︎"
          title="No messages yet"
          body="Once you confirm a booking, your studio replies will land here."
        />
      ) : (
        <>
          <section className="conversation-list">
            {conversations.map((conversation) => (
              <ConversationListItem
                key={conversation.id}
                conversation={conversation}
                href={getCustomerMessagesPath(conversation.id)}
              />
            ))}
          </section>
          <p className="messages-footer-hint">
            New replies from your studio appear here automatically.
          </p>
        </>
      )}
    </MobileLayout>
  );
}
