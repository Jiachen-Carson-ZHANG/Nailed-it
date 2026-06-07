'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { getMerchantMessagesPath, getMerchantOpsBotPath } from '@/domain/session';
import { ConversationListItem } from '@/features/messages/ConversationListItem';
import type { Conversation } from '@/domain/nail';
import { useLanguage } from '@/i18n/context';
import { listMerchantConversationsAction } from '@/lib/actions/conversation-actions';

export default function MerchantMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    let active = true;
    listMerchantConversationsAction()
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
        <p className="section-eyebrow">{t('messages.merchant.eyebrow')}</p>
        <h1>{t('messages.merchant.title')}</h1>
        <p className="section-copy">{t('messages.merchant.body')}</p>
      </section>

      {/* Pinned AI ops-assistant thread — always available, top of the inbox. */}
      <Link className="opsbot-entry" href={getMerchantOpsBotPath()}>
        <span className="opsbot-entry-avatar" aria-hidden>AI</span>
        <span className="opsbot-entry-body">
          <strong>{t('messages.merchant.opsTitle')}</strong>
          <span className="opsbot-entry-preview">{t('messages.merchant.opsPreview')}</span>
        </span>
        <span className="opsbot-entry-badge" aria-hidden>📊</span>
      </Link>

      {loading ? (
        <LoadingState
          title={t('messages.merchant.loadingTitle')}
          body={t('messages.merchant.loadingBody')}
        />
      ) : conversations.length === 0 ? (
        <EmptyState
          icon="✉︎"
          title={t('messages.merchant.emptyTitle')}
          body={t('messages.merchant.emptyBody')}
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
            {t('messages.merchant.footer')}
          </p>
        </>
      )}
    </MobileLayout>
  );
}
