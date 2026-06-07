'use client';

import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { getMerchantMessagesPath } from '@/domain/session';
import type { Conversation } from '@/domain/nail';
import { ChatRoom, type ChatAppointment } from '@/features/messages/ChatRoom';
import { CustomerIntelPanel } from '@/features/merchant/CustomerIntelPanel';
import { useLanguage } from '@/i18n/context';
import { getMerchantConversationAction, sendMerchantMessageAction } from '@/lib/actions/conversation-actions';
import { getCustomerIntelligenceAction } from '@/lib/actions/customer-intel-actions';
import Link from 'next/link';

type MerchantConversationClientProps = {
  conversationId: string;
};

export function MerchantConversationClient({ conversationId }: MerchantConversationClientProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [appointment, setAppointment] = useState<ChatAppointment | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    let active = true;
    getMerchantConversationAction(conversationId)
      .then((c) => {
        if (!active) return;
        setConversation(c);
        // Linked appointment for the header button + inline card. Same compute-on-read source the
        // intel panel uses (kept as a separate read so the shared panel stays self-contained).
        if (c) {
          getCustomerIntelligenceAction(c.participantName)
            .then((intel) => active && setAppointment(intel?.appointmentContext ?? null))
            .catch(() => {/* no appointment card */});
        }
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
        <LoadingState
          title={t('messages.thread.loadingTitle')}
          body={t('messages.merchant.thread.loadingBody')}
        />
      </section>
    );
  }

  return conversation ? (
    <>
      <ChatRoom conversation={conversation} onSend={handleSend} viewerRole="merchant" appointment={appointment} />
      <CustomerIntelPanel
        customerName={conversation.participantName}
        conversationId={conversationId}
        onRecommendSent={setConversation}
      />
      <Link className="button button-secondary" href={getMerchantMessagesPath()}>
        {t('messages.thread.back')}
      </Link>
    </>
  ) : (
    <section className="page-heading">
      <EmptyState
        body={t('messages.merchant.thread.notFoundBody')}
        title={t('messages.thread.notFoundTitle')}
      />
      <Link className="button button-secondary" href={getMerchantMessagesPath()}>
        {t('messages.thread.back')}
      </Link>
    </section>
  );
}
