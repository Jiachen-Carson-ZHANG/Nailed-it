'use client';

import { useEffect, useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ConversationListItem } from '@/features/messages/ConversationListItem';
import type { Conversation } from '@/domain/nail';
import { getCustomerMessagesPath } from '@/domain/session';
import { useLanguage } from '@/i18n/context';
import { listCustomerConversationsAction } from '@/lib/actions/conversation-actions';

export default function CustomerMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    let active = true;
    listCustomerConversationsAction()
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
        <p className="section-eyebrow">{t('messages.customer.eyebrow')}</p>
        <h1>{t('messages.customer.title')}</h1>
        <p className="section-copy">{t('messages.customer.body')}</p>
      </section>
      {loading ? (
        <LoadingState
          title={t('messages.customer.loadingTitle')}
          body={t('messages.customer.loadingBody')}
        />
      ) : conversations.length === 0 ? (
        <EmptyState
          icon="✉︎"
          title={t('messages.customer.emptyTitle')}
          body={t('messages.customer.emptyBody')}
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
            {t('messages.customer.footer')}
          </p>
        </>
      )}
    </MobileLayout>
  );
}
