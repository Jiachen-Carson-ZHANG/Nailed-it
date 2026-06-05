'use client';

import { useEffect, useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { getMerchantMessagesPath } from '@/domain/session';
import { ConversationListItem } from '@/features/messages/ConversationListItem';
import type { Conversation } from '@/domain/nail';
import { listConversationsForRoleAction } from '@/lib/actions/conversation-actions';

export default function MerchantMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listConversationsForRoleAction('merchant')
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
      role="merchant"
      title="Nailed-it"
    >
      <section className="page-heading">
        <p className="section-eyebrow">Inbox</p>
        <h1>Messages inbox</h1>
        <p className="section-copy">Review customer updates before they turn into schedule changes.</p>
      </section>
      {loading ? (
        <LoadingState title="Loading inbox" body="Fetching customer conversations." />
      ) : conversations.length === 0 ? (
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
