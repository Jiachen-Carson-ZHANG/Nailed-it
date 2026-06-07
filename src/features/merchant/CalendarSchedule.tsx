'use client';

import { useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Booking } from '@/domain/nail';
import { getMerchantBookingPath } from '@/domain/session';
import { useLanguage } from '@/i18n/context';
import type { AppLanguage } from '@/i18n/types';
import { mockTechnicians } from '@/mock/technicians';

type CalendarScheduleProps = {
  bookings: Booking[];
};

type CalendarView = 'month' | 'day';

const calendarCopy = {
  'zh-CN': {
    chooseDate: '选择日期',
    views: '日历视图',
    month: '月',
    day: '日',
    monthAria: (label: string) => `${label} · 每日剩余可预约数`,
    dayAria: (date: string) => `${date} 的排期`,
    spotsLeft: (left: number) => `${left} 位可约`,
    full: '已满',
    dayTitle: (label: string, left: number) => `${label} · 剩余 ${left} 位可约`,
    legendOpen: '充裕',
    legendMid: '渐满',
    legendLow: '即将满',
    legendFull: '已满',
    dayEmpty: (left: number) => `当日暂无预约 · 还可接待 ${left} 位`,
    confirm: '待确认',
    weekdayLabels: ['一', '二', '三', '四', '五', '六', '日'],
    spotAria: (label: string, left: number) => `${label}，剩余 ${left} 位可约`,
  },
  en: {
    chooseDate: 'Choose calendar date',
    views: 'Calendar views',
    month: 'Month',
    day: 'Day',
    monthAria: (label: string) => `${label} — spots left per day`,
    dayAria: (date: string) => `Schedule for ${date}`,
    spotsLeft: (left: number) => `${left} left`,
    full: 'full',
    dayTitle: (label: string, left: number) => `${label} · ${left} spots left`,
    legendOpen: 'open',
    legendMid: 'filling',
    legendLow: 'almost full',
    legendFull: 'full',
    dayEmpty: (left: number) => `No bookings yet — ${left} open slots this day.`,
    confirm: 'confirm',
    weekdayLabels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    spotAria: (label: string, left: number) => `${label}, ${left} spots left`,
  },
} as const;

// Capacity model: each active technician offers ~6 bookable slots across the
// 9:00–19:00 window. Spots left = capacity − bookings that day. This is what a
// merchant checks when new demand arrives: "can I still fit someone in?"
const SLOTS_PER_TECH = 6;
const DAY_START_HOUR = 9;
const DAY_END_HOUR = 19;
const HOUR_PX = 56;

const hourRange = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);
const activeTechnicians = mockTechnicians.filter((t) => t.active);
const dailyCapacity = activeTechnicians.length * SLOTS_PER_TECH;

function localeFor(language: AppLanguage): string {
  return language === 'zh-CN' ? 'zh-CN' : 'en-GB';
}

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

function formatDayLabel(date: string, language: AppLanguage): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString(localeFor(language), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function formatMonthLabel(year: number, monthIndex: number, language: AppLanguage): string {
  return new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString(localeFor(language), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatMonthDayLabel(year: number, monthIndex: number, day: number, language: AppLanguage): string {
  return new Date(Date.UTC(year, monthIndex, day)).toLocaleDateString(localeFor(language), {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatPickerButtonLabel(date: string): string {
  return date.replaceAll('-', '/');
}

function monthParts(date: string, language: AppLanguage) {
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
    label: formatMonthLabel(year, monthIndex, language),
  };
}

export function CalendarSchedule({ bookings }: CalendarScheduleProps) {
  const { language } = useLanguage();
  const copy = calendarCopy[language];
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
  const month = monthParts(selectedDate, language);
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
            aria-label={copy.chooseDate}
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

        <div className="cal-view-tabs" role="tablist" aria-label={copy.views}>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'month'}
            className={`cal-view-tab${activeView === 'month' ? ' cal-view-tab-active' : ''}`}
            onClick={() => setActiveView('month')}
          >
            {copy.month}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'day'}
            className={`cal-view-tab${activeView === 'day' ? ' cal-view-tab-active' : ''}`}
            onClick={() => setActiveView('day')}
          >
            {copy.day}
          </button>
        </div>
      </div>

      {activeView === 'month' ? (
        <section className="cal-month" aria-label={copy.monthAria(month.label)}>
          <div className="cal-weekday-row" aria-hidden="true">
            {copy.weekdayLabels.map((label, i) => (
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
                  aria-label={copy.spotAria(formatMonthDayLabel(month.year, month.monthIndex, day, language), left)}
                  aria-pressed={isSelected}
                  className={`cal-spot cal-tone-${tone}${isSelected ? ' cal-spot-selected' : ''}`}
                  onClick={() => setSelectedDate(date)}
                >
                  <span className="cal-spot-day">{day}</span>
                  <span className="cal-spot-left">{left <= 0 ? copy.full : copy.spotsLeft(left)}</span>
                </button>
              );
            })}
          </div>
          <p className="cal-legend" aria-hidden="true">
            <span>
              <i className="cal-legend-swatch cal-tone-open" /> {copy.legendOpen}
            </span>
            <span>
              <i className="cal-legend-swatch cal-tone-mid" /> {copy.legendMid}
            </span>
            <span>
              <i className="cal-legend-swatch cal-tone-low" /> {copy.legendLow}
            </span>
            <span>
              <i className="cal-legend-swatch cal-tone-full" /> {copy.legendFull}
            </span>
          </p>
        </section>
      ) : (
        <section className="cal-day" aria-label={copy.dayAria(selectedDate)}>
          <h2 className="cal-day-title">
            {copy.dayTitle(formatDayLabel(selectedDate, language), selectedSpotsLeft)}
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
                          {pending ? <span className="cal-appt-flag">{copy.confirm}</span> : null}
                        </Link>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
          {selectedBookings.length === 0 ? (
            <p className="cal-day-empty">{copy.dayEmpty(selectedSpotsLeft)}</p>
          ) : null}
        </section>
      )}
    </div>
  );
}
