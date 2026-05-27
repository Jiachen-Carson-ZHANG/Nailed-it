'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Booking } from '@/domain/nail';
import { getMerchantBookingPath } from '@/domain/session';
import { mockTechnicians } from '@/mock/technicians';

type CalendarScheduleProps = {
  bookings: Booking[];
};

// Capacity model: each active technician offers ~6 bookable slots across the
// 9:00–19:00 window. Spots left = capacity − bookings that day. This is what a
// merchant checks when new demand arrives: "can I still fit someone in?"
const SLOTS_PER_TECH = 6;
const DAY_START_HOUR = 9;
const DAY_END_HOUR = 19;
const HOUR_PX = 56;

const weekdayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const monthDays = Array.from({ length: 31 }, (_, i) => i + 1);
const firstWeekday = new Date(Date.UTC(2026, 4, 1)).getUTCDay();
const leadingBlanks = firstWeekday === 0 ? 6 : firstWeekday - 1;
const hourRange = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

function spotsTone(left: number): 'open' | 'mid' | 'low' | 'full' {
  if (left <= 0) return 'full';
  if (left <= 3) return 'low';
  if (left <= 8) return 'mid';
  return 'open';
}

function formatDayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC'
  });
}

export function CalendarSchedule({ bookings }: CalendarScheduleProps) {
  const activeTechnicians = useMemo(() => mockTechnicians.filter((t) => t.active), []);
  const dailyCapacity = activeTechnicians.length * SLOTS_PER_TECH;

  const bookingsByDate = useMemo(() => {
    return bookings.reduce<Record<string, Booking[]>>((acc, booking) => {
      acc[booking.date] = [...(acc[booking.date] ?? []), booking];
      return acc;
    }, {});
  }, [bookings]);

  const [selectedDate, setSelectedDate] = useState('2026-05-23');
  const selectedBookings = bookingsByDate[selectedDate] ?? [];
  const selectedSpotsLeft = Math.max(dailyCapacity - selectedBookings.length, 0);

  return (
    <div className="cal-schedule">
      <section className="cal-month" aria-label="May 2026 — spots left per day">
        <div className="cal-weekday-row" aria-hidden="true">
          {weekdayLabels.map((label, i) => (
            <span key={i} className="cal-weekday">
              {label}
            </span>
          ))}
        </div>
        <div className="cal-month-grid">
          {Array.from({ length: leadingBlanks }, (_, i) => (
            <span key={`blank-${i}`} aria-hidden="true" className="cal-spot-blank" />
          ))}
          {monthDays.map((day) => {
            const date = `2026-05-${String(day).padStart(2, '0')}`;
            const count = bookingsByDate[date]?.length ?? 0;
            const left = Math.max(dailyCapacity - count, 0);
            const tone = spotsTone(left);
            const isSelected = date === selectedDate;
            return (
              <button
                key={date}
                type="button"
                aria-label={`${day} May, ${left} spots left`}
                aria-pressed={isSelected}
                className={`cal-spot cal-tone-${tone}${isSelected ? ' cal-spot-selected' : ''}`}
                onClick={() => setSelectedDate(date)}
              >
                <span className="cal-spot-day">{day}</span>
                <span className="cal-spot-left">{left <= 0 ? 'full' : `${left} left`}</span>
              </button>
            );
          })}
        </div>
        <p className="cal-legend" aria-hidden="true">
          <span>
            <i className="cal-legend-swatch cal-tone-open" /> open
          </span>
          <span>
            <i className="cal-legend-swatch cal-tone-mid" /> filling
          </span>
          <span>
            <i className="cal-legend-swatch cal-tone-low" /> almost full
          </span>
          <span>
            <i className="cal-legend-swatch cal-tone-full" /> full
          </span>
        </p>
      </section>

      <section className="cal-day" aria-label={`Schedule for ${selectedDate}`}>
        <h2 className="cal-day-title">
          {formatDayLabel(selectedDate)} · {selectedSpotsLeft} spots left
        </h2>
        <div className="cal-day-head">
          <span className="cal-gutter-head" />
          {activeTechnicians.map((tech) => (
            <span key={tech.id} className="cal-tech-head">
              <strong>{tech.name}</strong>
              <em>{tech.title}</em>
            </span>
          ))}
        </div>
        <div className="cal-day-scroll">
          <div
            className="cal-day-grid"
            style={{ height: `${(DAY_END_HOUR - DAY_START_HOUR) * HOUR_PX}px` }}
          >
            <div className="cal-gutter">
              {hourRange.map((hour, i) => (
                <span key={hour} className="cal-hour" style={{ top: `${i * HOUR_PX}px` }}>
                  {hour}:00
                </span>
              ))}
            </div>
            {activeTechnicians.map((tech) => (
              <div key={tech.id} className="cal-col">
                {hourRange.map((hour, i) => (
                  <span key={hour} className="cal-line" style={{ top: `${i * HOUR_PX}px` }} />
                ))}
                {selectedBookings
                  .filter((b) => b.technician.id === tech.id)
                  .map((booking) => {
                    const top = ((toMinutes(booking.time) - DAY_START_HOUR * 60) / 60) * HOUR_PX;
                    const height = (booking.quote.duration / 60) * HOUR_PX;
                    const pending = booking.status === 'pending_review';
                    return (
                      <Link
                        key={booking.id}
                        href={getMerchantBookingPath(booking.id)}
                        className={`cal-appt${pending ? ' cal-appt-pending' : ''}`}
                        style={{ top: `${top}px`, height: `${Math.max(height - 3, 22)}px` }}
                      >
                        <strong>
                          {booking.time} · {booking.customerName}
                        </strong>
                        <em>{booking.styleTitle}</em>
                        {pending ? <span className="cal-appt-flag">confirm</span> : null}
                      </Link>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
        {selectedBookings.length === 0 ? (
          <p className="cal-day-empty">No bookings yet — {selectedSpotsLeft} open slots this day.</p>
        ) : null}
      </section>
    </div>
  );
}
