'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Booking } from '@/domain/nail';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/i18n/context';
import { formatCurrency, formatDuration, formatStatusLabel } from '@/i18n/format';

// A customer can withdraw a booking the studio hasn't completed yet.
const withdrawable = new Set<Booking['status']>(['pending_review', 'confirmed']);

type BookingHistoryCardProps = {
  booking: Booking;
  onWithdraw?: (id: string) => Promise<void> | void;
  /** Start expanded — used when deep-linked from a chat appointment card. */
  defaultOpen?: boolean;
};

export function BookingHistoryCard({ booking, onWithdraw, defaultOpen = false }: BookingHistoryCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [busy, setBusy] = useState(false);
  const { language } = useLanguage();
  const styleImageUrl = booking.styleImageUrl.trim();
  const copy = {
    'zh-CN': {
      confirmWithdraw: '确认撤销这个预约吗？',
      time: '时间',
      studio: '门店',
      technician: '技师',
      quote: '报价',
      notes: '备注',
      messageStudio: '联系门店',
      withdrawing: '撤销中…',
      withdrawBooking: '撤销预约',
    },
    en: {
      confirmWithdraw: 'Withdraw this booking?',
      time: 'Time',
      studio: 'Studio',
      technician: 'Technician',
      quote: 'Quote',
      notes: 'Notes',
      messageStudio: 'Message studio',
      withdrawing: 'Withdrawing…',
      withdrawBooking: 'Withdraw booking',
    },
  } as const;
  const labels = copy[language];

  const canWithdraw = Boolean(onWithdraw) && withdrawable.has(booking.status);

  async function handleWithdraw() {
    if (!onWithdraw) return;
    if (!window.confirm(labels.confirmWithdraw)) return;
    setBusy(true);
    try {
      await onWithdraw(booking.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="history-card" id={`booking-${booking.id}`}>
      <button
        type="button"
        className="history-card-summary"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {styleImageUrl ? <img className="history-card-thumb" alt={booking.styleTitle} src={styleImageUrl} /> : null}
        <span className="history-card-summary-text">
          <strong>{booking.styleTitle}</strong>
          <span>
            {booking.date} · {booking.time} · {formatCurrency({
              cents: Math.round(booking.quote.price * 100),
              language,
            })}
          </span>
        </span>
        <span className="history-status-pill">
          {formatStatusLabel({ status: booking.status, language })}
        </span>
        <span aria-hidden="true" className="history-card-chevron">{open ? '▾' : '▸'}</span>
      </button>

      {open ? (
        <div className="history-card-detail">
          {styleImageUrl ? <img className="history-card-image" alt={booking.styleTitle} src={styleImageUrl} /> : null}
          <dl className="history-card-facts">
            <div><dt>{labels.time}</dt><dd>{booking.date} · {booking.time}</dd></div>
            <div><dt>{labels.studio}</dt><dd>{booking.merchantName}</dd></div>
            <div><dt>{labels.technician}</dt><dd>{booking.technician.name}</dd></div>
            <div>
              <dt>{labels.quote}</dt>
              <dd>
                {formatCurrency({
                  cents: Math.round(booking.quote.price * 100),
                  language,
                })} · {formatDuration({ minutes: booking.quote.duration, language })}
              </dd>
            </div>
            {booking.notes ? <div><dt>{labels.notes}</dt><dd className="history-card-fact-long">{booking.notes}</dd></div> : null}
          </dl>
          <div className="history-card-actions">
            {booking.conversationId ? (
              <Link className="button button-secondary button-default" href={`/customer/messages/${booking.conversationId}`}>
                {labels.messageStudio}
              </Link>
            ) : null}
            {canWithdraw ? (
              <Button variant="ghost" disabled={busy} onClick={handleWithdraw}>
                {busy ? labels.withdrawing : labels.withdrawBooking}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
