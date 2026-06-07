'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Conversation, UserRole } from '@/domain/nail';
import {
  getCustomerStylePath,
  getMerchantStylePath,
  getMerchantBookingPath,
  getCustomerProfilePath,
} from '@/domain/session';
import { useLanguage } from '@/i18n/context';
import { formatStatusLabel } from '@/i18n/format';
import type { BookingStatusLabel } from '@/i18n/types';

/**
 * The linked appointment, shown as a header button + an inline details card. Presentation-ready:
 * each caller formats its own date/time labels (merchant from the booking's startAt, customer from
 * the booking view). `staffName` renders the att3 Staff column when known (customer side).
 */
export type ChatAppointment = {
  bookingId: string;
  styleTitle?: string;
  dateLabel: string;
  timeLabel: string;
  status: string;
  staffName?: string;
};

type ChatRoomProps = {
  conversation: Conversation;
  onSend?: (body: string) => void;
  /** Who is viewing — decides where a style card links (merchant → library, customer → style page). */
  viewerRole?: UserRole;
  /** The thread's appointment; renders the header button + inline card for both roles. */
  appointment?: ChatAppointment | null;
};

const chatRoomCopy = {
  'zh-CN': {
    threadAria: (name: string, label: string) => `${name}${label}`,
    styleMatch: (reason: string) => `匹配 ${reason}`,
    role: { customer: '顾客', merchant: '商家' },
    viewAppointment: '查看预约',
    today: '今天',
    apptTitle: '预约详情',
    date: '日期',
    time: '时间',
    staff: '员工',
    staffRole: '美甲师',
    viewFull: '查看完整预约 ›',
  },
  en: {
    threadAria: (name: string, label: string) => `${name} ${label}`,
    styleMatch: (reason: string) => `Matches ${reason}`,
    role: { customer: 'Customer', merchant: 'Merchant' },
    viewAppointment: 'View appointment',
    today: 'Today',
    apptTitle: 'Appointment details',
    date: 'Date',
    time: 'Time',
    staff: 'Staff',
    staffRole: 'Beautician',
    viewFull: 'View full appointment ›',
  },
} as const;

export function ChatRoom({ conversation, onSend, viewerRole = 'customer', appointment }: ChatRoomProps) {
  const [draftMessage, setDraftMessage] = useState('');
  const { language, t } = useLanguage();
  const copy = chatRoomCopy[language];
  const styleHref = viewerRole === 'merchant' ? getMerchantStylePath : getCustomerStylePath;
  const appt = appointment ?? null;
  // Where "View (full) appointment" goes: merchant → the booking detail; customer → their booking
  // history (no per-booking customer route exists).
  const apptHref =
    appt && viewerRole === 'merchant' ? getMerchantBookingPath(appt.bookingId) : getCustomerProfilePath();

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
        <div className="chat-room-peer">
          <span className="chat-room-avatar" aria-hidden>{conversation.avatarInitials}</span>
          <div>
            <h1 id={`chat-room-${conversation.id}`}>{conversation.participantName}</h1>
            <p className="chat-room-peer-role">{copy.role[conversation.participantRole]}</p>
          </div>
        </div>
        {appt ? (
          <Link className="chat-room-appt-btn" href={apptHref}>
            <span aria-hidden>📅</span> {copy.viewAppointment}
          </Link>
        ) : conversation.relatedBookingTime ? (
          <span className="chat-room-booking-pill">{conversation.relatedBookingTime}</span>
        ) : null}
      </div>

      <div
        className="chat-thread"
        aria-label={copy.threadAria(conversation.participantName, t('messages.chat.aria'))}
      >
        <div className="chat-day-divider">
          <span>{copy.today}</span>
        </div>
        {conversation.messages.map((message) => {
          // 中文注释：消息展示只依赖 author 这个稳定字段，避免页面层重复维护左右气泡规则。
          const bubbleClassName =
            message.author === 'me'
              ? 'chat-bubble chat-bubble-me'
              : message.author === 'system'
                ? 'chat-bubble chat-bubble-system'
                : 'chat-bubble chat-bubble-them';

          const style = message.attachment?.type === 'style' ? message.attachment : null;

          return (
            <article key={message.id} className={`chat-message chat-message-${message.author}`}>
              <div className={bubbleClassName}>
                {style ? (
                  <Link className="chat-style-card" href={styleHref(style.styleId)}>
                    <img className="chat-style-card-thumb" src={style.imageUrl} alt={style.title} loading="lazy" />
                    <div className="chat-style-card-body">
                      <p className="chat-style-card-title">{style.title}</p>
                      {style.reason ? <p className="chat-style-card-reason">{copy.styleMatch(style.reason)}</p> : null}
                      <span className="chat-style-card-cta">{t('messages.chat.viewStyle')}</span>
                    </div>
                  </Link>
                ) : (
                  <p>{message.body}</p>
                )}
                <span className="chat-bubble-meta">
                  {message.sentAt}
                  {message.author === 'me' ? <span className="chat-receipt" aria-hidden> ✓✓</span> : null}
                </span>
              </div>
            </article>
          );
        })}
      </div>

      {onSend ? (
        <div className="chat-composer">
          <span className="chat-composer-icon" aria-hidden>📎</span>
          <textarea
            className="chat-composer-input"
            aria-label={t('messages.chat.input')}
            placeholder={t('messages.chat.input')}
            value={draftMessage}
            rows={1}
            onChange={(event) => setDraftMessage(event.target.value)}
          />
          <button
            className="chat-composer-send"
            disabled={!draftMessage.trim()}
            type="button"
            onClick={sendDraftMessage}
            aria-label={t('messages.chat.send')}
          >
            <span aria-hidden>➤</span>
          </button>
        </div>
      ) : null}

      {appt ? (
        <Link className="chat-appt-card" href={apptHref}>
          <div className="chat-appt-card-head">
            <span aria-hidden>📅</span>
            <strong>{copy.apptTitle}</strong>
            <span className={`chat-appt-status chat-appt-status-${appt.status}`}>
              {formatStatusLabel({ status: appt.status as BookingStatusLabel, language })}
            </span>
          </div>
          {appt.styleTitle ? <p className="chat-appt-style">{appt.styleTitle}</p> : null}
          <div className={`chat-appt-grid${appt.staffName ? ' chat-appt-grid-3' : ''}`}>
            <div><span>{copy.date}</span><strong>{appt.dateLabel}</strong></div>
            <div><span>{copy.time}</span><strong>{appt.timeLabel}</strong></div>
            {appt.staffName ? (
              <div>
                <span>{copy.staff}</span>
                <strong>{appt.staffName}</strong>
                <span className="chat-appt-staff-role">{copy.staffRole}</span>
              </div>
            ) : null}
          </div>
          <span className="chat-appt-viewfull">{copy.viewFull}</span>
        </Link>
      ) : null}
    </section>
  );
}
