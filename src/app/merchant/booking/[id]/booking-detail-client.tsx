'use client';

import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Booking } from '@/domain/nail';
import { getMerchantMessagesPath } from '@/domain/session';
import { getBookingsSnapshot, getConversationThreads } from '@/mock/operations-store';

type MerchantBookingDetailClientProps = {
  id: string;
};

const bookingStatuses: Booking['status'][] = [
  'pending_review',
  'confirmed',
  'completed',
  'cancelled'
];

export function MerchantBookingDetailClient({ id }: MerchantBookingDetailClientProps) {
  const bookings = getBookingsSnapshot();
  const booking = bookings.find((item) => item.id === id);

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

  const conversationId =
    booking.conversationId ??
    getConversationThreads().find((thread) => thread.bookingId === booking.id)?.id;

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
      <p>Status: {booking.status}</p>
      <div className="chip-row" aria-label="Booking status">
        {bookingStatuses.map((status) => (
          <span key={status} className={booking.status === status ? 'chip chip-selected' : 'chip'}>
            {status}
          </span>
        ))}
      </div>
      {conversationId ? (
        <Link className="button button-secondary" href={getMerchantMessagesPath(conversationId)}>
          Open message thread
        </Link>
      ) : null}
    </section>
  );
}
