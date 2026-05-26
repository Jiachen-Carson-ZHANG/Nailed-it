import type { Booking } from '@/domain/nail';

const statusLabels: Record<Booking['status'], string> = {
  pending_review: 'Awaiting confirmation',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

export function BookingHistoryCard({ booking }: { booking: Booking }) {
  return (
    <article className="history-card">
      <div className="history-card-row">
        <strong>{booking.styleTitle}</strong>
        <span className="history-status-pill">{statusLabels[booking.status]}</span>
      </div>
      <p>
        {booking.date} · {booking.time} · SGD {booking.quote.price}
      </p>
      <p>{booking.notes}</p>
    </article>
  );
}
