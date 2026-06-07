'use client';

import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { getCustomerMessagesPath } from '@/domain/session';
import type { Conversation } from '@/domain/nail';
import { ChatRoom, type ChatAppointment } from '@/features/messages/ChatRoom';
import { useLanguage } from '@/i18n/context';
import { getCustomerConversationAction, sendCustomerMessageAction } from '@/lib/actions/conversation-actions';
import { listCustomerBookingViewsAction } from '@/lib/actions/booking-actions';
import Link from 'next/link';

type CustomerConversationClientProps = {
  conversationId: string;
};

export function CustomerConversationClient({ conversationId }: CustomerConversationClientProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [appointment, setAppointment] = useState<ChatAppointment | null>(null);
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
    // The booking linked to this thread → att3 appointment card (date · time · staff · status).
    listCustomerBookingViewsAction()
      .then((bookings) => {
        if (!active) return;
        const b = bookings.find((bk) => bk.conversationId === conversationId);
        setAppointment(
          b
            ? {
                bookingId: b.id,
                styleTitle: b.styleTitle,
                dateLabel: b.date,
                timeLabel: b.time,
                status: b.status,
                staffName: b.technician.name,
              }
            : null,
        );
      })
      .catch(() => {/* no appointment card */});
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
      <ChatRoom conversation={conversation} onSend={handleSend} viewerRole="customer" appointment={appointment} />
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
