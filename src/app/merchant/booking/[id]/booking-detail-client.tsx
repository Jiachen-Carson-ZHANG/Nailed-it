'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import type { Booking } from '@/domain/nail';
import { getMerchantMessagesPath } from '@/domain/session';
import { listMerchantBookingViewsAction, setBookingStatusAction } from '@/lib/actions/booking-actions';

type MerchantBookingDetailClientProps = {
  id: string;
};

const statusLabels: Record<Booking['status'], string> = {
  pending_review: 'Pending review',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

// A booking moves forward through its lifecycle; it can't jump arbitrarily (e.g. straight to completed,
// or back to pending). Each state only offers its valid next steps; completed/cancelled are terminal.
const nextActions: Record<Booking['status'], Booking['status'][]> = {
  pending_review: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

const actionLabel: Record<Booking['status'], string> = {
  pending_review: 'Reopen',
  confirmed: 'Confirm',
  completed: 'Mark completed',
  cancelled: 'Cancel booking',
};

export function MerchantBookingDetailClient({ id }: MerchantBookingDetailClientProps) {
  const [booking, setBooking] = useState<Booking | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Booking['status'] | undefined>(undefined);

  useEffect(() => {
    let active = true;
    listMerchantBookingViewsAction()
      .then((rows) => {
        if (!active) return;
        const found = rows.find((item) => item.id === id);
        setBooking(found);
        setStatus(found?.status);
      })
      .catch(() => {
        /* leave undefined → not-found state */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <section className="page-heading">
        <LoadingState title="Loading booking" body="Fetching the appointment from the booking service." />
      </section>
    );
  }

  if (!booking) {
    return (
      <section className="page-heading">
        <EmptyState
          body="The selected appointment is not available in the current booking session."
          title="Booking not found"
        />
      </section>
    );
  }

  const conversationId = booking.conversationId;
  const currentStatus = status ?? booking.status;

  async function changeStatus(option: Booking['status']) {
    setStatus(option); // optimistic
    await setBookingStatusAction(id, option); // persist to the DB
  }

  return (
    <section className="booking-detail">
      <img alt={booking.styleTitle} src={booking.styleImageUrl} />
      <div className="booking-detail-copy">
        <h1>{booking.customerName}</h1>
        <p>
          {booking.date} · {booking.time} · {booking.quote.duration} min
        </p>
        <p>SGD {booking.quote.price}</p>
      </div>
      <p>{booking.styleTitle}</p>
      <p>{booking.notes}</p>
      <p>Technician: {booking.technician.name}</p>
      <p>Status: {statusLabels[currentStatus]}</p>
      {nextActions[currentStatus].length > 0 ? (
        <div className="booking-step-actions" aria-label="Update booking status">
          {nextActions[currentStatus].map((option) => (
            <button
              key={option}
              type="button"
              className={`button button-default ${option === 'cancelled' ? 'button-ghost merchant-style-delete' : 'button-primary'}`}
              onClick={() => changeStatus(option)}
            >
              {actionLabel[option]}
            </button>
          ))}
        </div>
      ) : (
        <p className="helper-copy">This booking is {statusLabels[currentStatus].toLowerCase()} — no further changes.</p>
      )}
      {conversationId ? (
        <Link className="button button-secondary button-block" href={getMerchantMessagesPath(conversationId)}>
          Open message thread
        </Link>
      ) : null}
      <Link className="detail-back-link" href="/merchant/calendar">
        ← Back to calendar
      </Link>
    </section>
  );
}
