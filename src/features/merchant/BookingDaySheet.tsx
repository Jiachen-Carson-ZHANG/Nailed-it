import { BottomSheet } from '@/components/ui/BottomSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Booking } from '@/domain/nail';
import { BookingListCard } from './BookingListCard';

type BookingDaySheetProps = {
  bookings: Booking[];
  date: string;
  open: boolean;
  onClose: () => void;
};

export function BookingDaySheet({ bookings, date, onClose, open }: BookingDaySheetProps) {
  return (
    <BottomSheet open={open} title={date} onClose={onClose}>
      {bookings.length === 0 ? (
        <EmptyState body="This day has no scheduled appointments." title="No bookings" />
      ) : (
        <div className="booking-list">
          {bookings.map((booking) => (
            <BookingListCard key={booking.id} booking={booking} />
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
