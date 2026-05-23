import Link from 'next/link';
import type { Booking } from '@/domain/nail';
import { getMerchantBookingPath } from '@/domain/session';

type BookingListCardProps = {
  booking: Booking;
};

export function BookingListCard({ booking }: BookingListCardProps) {
  return (
    <Link className="booking-card" href={getMerchantBookingPath(booking.id)}>
      <strong>
        {booking.time} · {booking.customerName}
      </strong>
      <span>
        {booking.styleTitle} · {booking.quote.duration} min · SGD {booking.quote.price}
      </span>
      <small>{booking.status}</small>
    </Link>
  );
}
