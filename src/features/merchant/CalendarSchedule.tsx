'use client';

import { useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Booking } from '@/domain/nail';
import { getMerchantBookingPath } from '@/domain/session';
import { mockTechnicians } from '@/mock/technicians';

type CalendarScheduleProps = {
  bookings: Booking[];
};

type CalendarView = 'month' | 'day';

// Capacity model: each active technician offers ~6 bookable slots across the
// 9:00–19:00 window. Spots left = capacity − bookings that day. This is what a
// merchant checks when new demand arrives: "can I still fit someone in?"
const SLOTS_PER_TECH = 6;
const DAY_START_HOUR = 9;
const DAY_END_HOUR = 19;
const HOUR_PX = 56;

const weekdayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const hourRange = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);
const activeTechnicians = mockTechnicians.filter((t) => t.active);
const dailyCapacity = activeTechnicians.length * SLOTS_PER_TECH;

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

function formatMonthLabel(year: number, monthIndex: number): string {
  return new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

function formatMonthDayLabel(year: number, monthIndex: number, day: number): string {
  return new Date(Date.UTC(year, monthIndex, day)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC'
  });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatPickerButtonLabel(date: string): string {
  return date.replaceAll('-', '/');
}

function monthParts(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  const year = d.getUTCFullYear();
  const monthIndex = d.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  return {
    year,
    monthIndex,
    days: Array.from({ length: daysInMonth }, (_, i) => i + 1),
    leadingBlanks: firstWeekday === 0 ? 6 : firstWeekday - 1,
    label: formatMonthLabel(year, monthIndex)
  };
}

export function CalendarSchedule({ bookings }: CalendarScheduleProps) {
  const dateInputId = useId();
  const bookingsByDate = useMemo(() => {
    return bookings.reduce<Record<string, Booking[]>>((acc, booking) => {
      acc[booking.date] = [...(acc[booking.date] ?? []), booking];
      return acc;
    }, {});
  }, [bookings]);

  // 用真实今天作为唯一默认日期源，不再跟着 mock booking 自动跳日。
  const [selectedDate, setSelectedDate] = useState(() => todayIso());
  const [activeView, setActiveView] = useState<CalendarView>('month');
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const month = monthParts(selectedDate);
  const selectedBookings = bookingsByDate[selectedDate] ?? [];
  const selectedSpotsLeft = Math.max(dailyCapacity - selectedBookings.length, 0);

  function openDatePicker() {
    const input = dateInputRef.current;
    if (!input) return;

    if ('showPicker' in input && typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  }

  return (
    <div className="cal-schedule">
      <div className="cal-toolbar">
        <div className="cal-date-trigger-wrap">
          <button
            type="button"
            className="cal-date-trigger"
            onClick={openDatePicker}
            aria-haspopup="dialog"
            aria-controls={dateInputId}
          >
            {formatPickerButtonLabel(selectedDate)}
          </button>
          <input
            id={dateInputId}
            ref={dateInputRef}
            aria-label="Choose calendar date"
            className="cal-date-input"
            type="date"
            value={selectedDate}
            onChange={(event) => {
              // 原生 date input 在编辑过程中可能先给出空字符串，这里忽略中间态。
              if (!event.target.value) return;
              setSelectedDate(event.target.value);
            }}
          />
        </div>

        <div className="cal-view-tabs" role="tablist" aria-label="Calendar views">
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'month'}
            className={`cal-view-tab${activeView === 'month' ? ' cal-view-tab-active' : ''}`}
            onClick={() => setActiveView('month')}
          >
            Month
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'day'}
            className={`cal-view-tab${activeView === 'day' ? ' cal-view-tab-active' : ''}`}
            onClick={() => setActiveView('day')}
          >
            Day
          </button>
        </div>
      </div>

      {activeView === 'month' ? (
        <section className="cal-month" aria-label={`${month.label} — spots left per day`}>
          <div className="cal-weekday-row" aria-hidden="true">
            {weekdayLabels.map((label, i) => (
              <span key={i} className="cal-weekday">
                {label}
              </span>
            ))}
          </div>
          <div className="cal-month-grid">
            {Array.from({ length: month.leadingBlanks }, (_, i) => (
              <span key={`blank-${i}`} aria-hidden="true" className="cal-spot-blank" />
            ))}
            {month.days.map((day) => {
              const date = `${month.year}-${String(month.monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const count = bookingsByDate[date]?.length ?? 0;
              const left = Math.max(dailyCapacity - count, 0);
              const tone = spotsTone(left);
              const isSelected = date === selectedDate;
              return (
                <button
                  key={date}
                  type="button"
                  aria-label={`${formatMonthDayLabel(month.year, month.monthIndex, day)}, ${left} spots left`}
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
      ) : (
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
      )}
    </div>
  );
}
