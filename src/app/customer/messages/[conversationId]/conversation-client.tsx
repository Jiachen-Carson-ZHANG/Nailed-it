'use client';

import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { getCustomerMessagesPath } from '@/domain/session';
import type { Conversation } from '@/domain/nail';
import { ChatRoom, type ChatAppointment, type AttachableStyle } from '@/features/messages/ChatRoom';
import { useSavedStyles } from '@/features/customer/SavedStylesContext';
import { cardFacetLabels } from '@/features/customer/style-facets';
import { useLanguage } from '@/i18n/context';
import {
  getCustomerConversationAction,
  sendCustomerMessageAction,
  sendCustomerStyleAttachmentAction,
} from '@/lib/actions/conversation-actions';
import { listCustomerBookingViewsAction } from '@/lib/actions/booking-actions';
import { listCustomerPublishedStylesAction } from '@/lib/actions/merchant-style-actions';
import Link from 'next/link';

type CustomerConversationClientProps = {
  conversationId: string;
};

export function CustomerConversationClient({ conversationId }: CustomerConversationClientProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [appointment, setAppointment] = useState<ChatAppointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishedStyles, setPublishedStyles] = useState<AttachableStyle[]>([]);
  const { t, language } = useLanguage();
  const { savedIds } = useSavedStyles();

  // The customer can attach one of their saved looks; resolve saved ids → style cards on read.
  const attachableStyles = useMemo(
    () => publishedStyles.filter((style) => savedIds.has(style.styleId)),
    [publishedStyles, savedIds],
  );

  useEffect(() => {
    let active = true;
    listCustomerPublishedStylesAction()
      .then((styles) => {
        if (!active) return;
        setPublishedStyles(
          styles.map((style) => ({
            styleId: style.id,
            title: style.title,
            imageUrl: style.imageUrl,
            reason: cardFacetLabels(style.discoveryFacets).join(' · ') || undefined,
          })),
        );
      })
      .catch(() => {/* no attachable styles */});
    return () => {
      active = false;
    };
  }, []);

  async function handleAttachStyle(style: AttachableStyle) {
    const updated = await sendCustomerStyleAttachmentAction(conversationId, { ...style, language });
    if (updated) setConversation(updated);
  }

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
      <ChatRoom
        conversation={conversation}
        onSend={handleSend}
        viewerRole="customer"
        appointment={appointment}
        attachableStyles={attachableStyles}
        onAttachStyle={handleAttachStyle}
      />
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
