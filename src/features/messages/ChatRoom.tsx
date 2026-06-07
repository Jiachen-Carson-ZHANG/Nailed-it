'use client';

import { useState } from 'react';
import type { Conversation } from '@/domain/nail';
import { useLanguage } from '@/i18n/context';

type ChatRoomProps = {
  conversation: Conversation;
  onSend?: (body: string) => void;
};

export function ChatRoom({ conversation, onSend }: ChatRoomProps) {
  const [draftMessage, setDraftMessage] = useState('');
  const { language, t } = useLanguage();

  function sendDraftMessage() {
    if (!onSend) {
      return;
    }

    const trimmedMessage = draftMessage.trim();

    if (!trimmedMessage) {
      return;
    }

    onSend(trimmedMessage);
    setDraftMessage('');
  }

  return (
    <section className="chat-room" aria-labelledby={`chat-room-${conversation.id}`}>
      <div className="chat-room-header">
        <div>
          <p className="section-eyebrow">{t('messages.chat.eyebrow')}</p>
          <h1 id={`chat-room-${conversation.id}`}>{conversation.participantName}</h1>
        </div>
        {conversation.relatedBookingTime ? (
          <span className="chat-room-booking-pill">{conversation.relatedBookingTime}</span>
        ) : null}
      </div>

      <div
        className="chat-thread"
        aria-label={
          language === 'zh-CN'
            ? `${conversation.participantName}${t('messages.chat.aria')}`
            : `${conversation.participantName} ${t('messages.chat.aria')}`
        }
      >
        {conversation.messages.map((message) => {
          // 中文注释：消息展示只依赖 author 这个稳定字段，避免页面层重复维护左右气泡规则。
          const bubbleClassName =
            message.author === 'me'
              ? 'chat-bubble chat-bubble-me'
              : message.author === 'system'
                ? 'chat-bubble chat-bubble-system'
                : 'chat-bubble chat-bubble-them';

          return (
            <article key={message.id} className={`chat-message chat-message-${message.author}`}>
              <div className={bubbleClassName}>
                <p>{message.body}</p>
                <span>{message.sentAt}</span>
              </div>
            </article>
          );
        })}
      </div>
      {onSend ? (
        <div className="chat-composer">
          <label className="field">
            <span>{t('messages.chat.input')}</span>
            <textarea
              value={draftMessage}
              onChange={(event) => setDraftMessage(event.target.value)}
            />
          </label>
          <button
            className="button"
            disabled={!draftMessage.trim()}
            type="button"
            onClick={sendDraftMessage}
          >
            {t('messages.chat.send')}
          </button>
        </div>
      ) : null}
    </section>
  );
}
