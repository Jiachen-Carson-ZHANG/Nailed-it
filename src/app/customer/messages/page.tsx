'use client';

import { useEffect, useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ConversationListItem } from '@/features/messages/ConversationListItem';
import type { Conversation } from '@/domain/nail';
import { getCustomerMessagesPath } from '@/domain/session';
import { listConversationsForRoleAction } from '@/lib/actions/conversation-actions';

export default function CustomerMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listConversationsForRoleAction('customer')
      .then((rows) => {
        if (active) setConversations(rows);
      })
      .catch(() => {
        /* leave empty */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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
      {loading ? (
        <LoadingState title="Loading messages" body="Fetching your conversations." />
      ) : conversations.length === 0 ? (
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
