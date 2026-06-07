'use client';

import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { getCustomerMessagesPath } from '@/domain/session';
import type { Conversation } from '@/domain/nail';
import { ChatRoom } from '@/features/messages/ChatRoom';
import { useLanguage } from '@/i18n/context';
import { getCustomerConversationAction, sendCustomerMessageAction } from '@/lib/actions/conversation-actions';
import Link from 'next/link';

type CustomerConversationClientProps = {
  conversationId: string;
};

export function CustomerConversationClient({ conversationId }: CustomerConversationClientProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    let active = true;
    getCustomerConversationAction(conversationId)
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
    const updated = await sendCustomerMessageAction(conversationId, body);
    if (updated) setConversation(updated);
  }

  if (loading) {
    return (
      <section className="page-heading">
        <LoadingState
          title={t('messages.thread.loadingTitle')}
          body={t('messages.customer.thread.loadingBody')}
        />
      </section>
    );
  }

  return conversation ? (
    <>
      <ChatRoom conversation={conversation} onSend={handleSend} />
      <Link className="button button-secondary" href={getCustomerMessagesPath()}>
        {t('messages.thread.back')}
      </Link>
    </>
  ) : (
    <section className="page-heading">
      <EmptyState
        body={t('messages.customer.thread.notFoundBody')}
        title={t('messages.thread.notFoundTitle')}
      />
      <Link className="button button-secondary" href={getCustomerMessagesPath()}>
        {t('messages.thread.back')}
      </Link>
    </section>
  );
}
