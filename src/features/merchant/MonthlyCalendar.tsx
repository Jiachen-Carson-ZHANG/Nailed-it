'use client';

import { useMemo, useState } from 'react';
import type { Booking } from '@/domain/nail';
import { BookingDaySheet } from './BookingDaySheet';

type MonthlyCalendarProps = {
  bookings: Booking[];
};

const monthDays = Array.from({ length: 31 }, (_, index) => index + 1);
const weekdayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
// 中文注释：May 2026 的 1 号是星期五；getDay() 返回 5，按周一起算需要左侧空出 4 格。
const firstWeekday = new Date(Date.UTC(2026, 4, 1)).getUTCDay();
const leadingBlanks = firstWeekday === 0 ? 6 : firstWeekday - 1;

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
      <div className="calendar-weekday-row" aria-hidden="true">
        {weekdayLabels.map((label, index) => (
          <span key={`${label}-${index}`} className="calendar-weekday">
            {label}
          </span>
        ))}
      </div>
      <section className="calendar-grid" aria-label="May 2026 bookings">
        {Array.from({ length: leadingBlanks }, (_, index) => (
          <span key={`blank-${index}`} aria-hidden="true" className="calendar-day-blank" />
        ))}
        {monthDays.map((day) => {
          const date = `2026-05-${String(day).padStart(2, '0')}`;
          const bookingCount = bookingsByDate[date]?.length ?? 0;
          const label = bookingCount ? `${bookingCount} bookings` : '';

          return (
            <button
              key={date}
              aria-label={`${day} ${label || 'no bookings'}`}
              className={bookingCount ? 'calendar-day calendar-day-busy' : 'calendar-day'}
              type="button"
              onClick={() => {
                setSelectedDate(date);
                setIsSheetOpen(true);
              }}
            >
              <strong>{day}</strong>
              {bookingCount ? <span className="calendar-day-dot" aria-hidden="true" /> : null}
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
