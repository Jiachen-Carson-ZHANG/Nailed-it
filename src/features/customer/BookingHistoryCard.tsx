'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Booking } from '@/domain/nail';
import { Button } from '@/components/ui/Button';

const statusLabels: Record<Booking['status'], string> = {
  pending_review: 'Awaiting confirmation',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

// A customer can withdraw a booking the studio hasn't completed yet.
const withdrawable = new Set<Booking['status']>(['pending_review', 'confirmed']);

type BookingHistoryCardProps = {
  booking: Booking;
  onWithdraw?: (id: string) => Promise<void> | void;
};

export function BookingHistoryCard({ booking, onWithdraw }: BookingHistoryCardProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const canWithdraw = Boolean(onWithdraw) && withdrawable.has(booking.status);

  async function handleWithdraw() {
    if (!onWithdraw) return;
    if (!window.confirm('Withdraw this booking?')) return;
    setBusy(true);
    try {
      await onWithdraw(booking.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="history-card">
      <button
        type="button"
        className="history-card-summary"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <img className="history-card-thumb" alt={booking.styleTitle} src={booking.styleImageUrl} />
        <span className="history-card-summary-text">
          <strong>{booking.styleTitle}</strong>
          <span>{booking.date} · {booking.time} · SGD {booking.quote.price}</span>
        </span>
        <span className="history-status-pill">{statusLabels[booking.status]}</span>
        <span aria-hidden="true" className="history-card-chevron">{open ? '▾' : '▸'}</span>
      </button>

      {open ? (
        <div className="history-card-detail">
          <img className="history-card-image" alt={booking.styleTitle} src={booking.styleImageUrl} />
          <dl className="history-card-facts">
            <div><dt>Time</dt><dd>{booking.date} · {booking.time}</dd></div>
            <div><dt>Studio</dt><dd>{booking.merchantName}</dd></div>
            <div><dt>Technician</dt><dd>{booking.technician.name}</dd></div>
            <div><dt>Quote</dt><dd>SGD {booking.quote.price} · {booking.quote.duration} min</dd></div>
            {booking.notes ? <div><dt>Notes</dt><dd>{booking.notes}</dd></div> : null}
          </dl>
          <div className="history-card-actions">
            {booking.conversationId ? (
              <Link className="button button-secondary button-default" href={`/customer/messages/${booking.conversationId}`}>
                Message studio
              </Link>
            ) : null}
            {canWithdraw ? (
              <Button variant="ghost" disabled={busy} onClick={handleWithdraw}>
                {busy ? 'Withdrawing…' : 'Withdraw booking'}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
