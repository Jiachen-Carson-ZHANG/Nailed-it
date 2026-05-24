'use client';

import { useMemo, useState } from 'react';
import type { Booking } from '@/domain/nail';
import { BookingDaySheet } from './BookingDaySheet';

type MonthlyCalendarProps = {
  bookings: Booking[];
};

const monthDays = Array.from({ length: 31 }, (_, index) => index + 1);

export function MonthlyCalendar({ bookings }: MonthlyCalendarProps) {
  const [selectedDate, setSelectedDate] = useState('2026-05-23');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const bookingsByDate = useMemo(() => {
    return bookings.reduce<Record<string, Booking[]>>((grouped, booking) => {
      grouped[booking.date] = [...(grouped[booking.date] ?? []), booking];
      return grouped;
    }, {});
  }, [bookings]);
  const selectedBookings = bookingsByDate[selectedDate] ?? [];

  return (
    <>
      <section className="calendar-grid" aria-label="May 2026 bookings">
        {monthDays.map((day) => {
          const date = `2026-05-${String(day).padStart(2, '0')}`;
          const bookingCount = bookingsByDate[date]?.length ?? 0;
          const label = bookingCount ? `${bookingCount} bookings` : 'Open';

          return (
            <button
              key={date}
              aria-label={`${day} ${label}`}
              className={bookingCount ? 'calendar-day calendar-day-busy' : 'calendar-day'}
              type="button"
              onClick={() => {
                setSelectedDate(date);
                setIsSheetOpen(true);
              }}
            >
              <strong>{day}</strong>
              <span>{label}</span>
            </button>
          );
        })}
      </section>
      <BookingDaySheet
        bookings={selectedBookings}
        date={selectedDate}
        open={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
      />
    </>
  );
}
