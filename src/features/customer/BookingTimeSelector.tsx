'use client';

import { useEffect, useRef, useState } from 'react';
import type { TechnicianSlot } from '@/domain/nail';
import { useLanguage } from '@/i18n/context';

const copy = {
  'zh-CN': {
    aria: '可预约时间',
    noSlots: '该日暂无时段',
    prevMonth: '上个月',
    nextMonth: '下个月',
    weekdays: ['一', '二', '三', '四', '五', '六', '日'],
    months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    today: '今天',
    noSlotsDay: '当日无可用时段',
  },
  en: {
    aria: 'Available appointment times',
    noSlots: 'No slots on this day',
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
    weekdays: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    today: 'Today',
    noSlotsDay: 'No slots available on this day',
  },
} as const;

export type BookingSlotChoice = TechnicianSlot;

type BookingTimeSelectorProps = {
  days: Array<{
    date: string;   // YYYY-MM-DD
    label: string;
    slots: TechnicianSlot[];
  }>;
  disabled?: boolean;
  loading?: boolean;
  error?: string | null;
  onChange: (nextValue: BookingSlotChoice) => void;
  value: BookingSlotChoice | null;
};

function groupByTechnician(slots: TechnicianSlot[]): Array<{ id: string; name: string; slots: TechnicianSlot[] }> {
  const map = new Map<string, { id: string; name: string; slots: TechnicianSlot[] }>();
  for (const slot of slots) {
    const existing = map.get(slot.technician.id);
    if (existing) {
      existing.slots.push(slot);
    } else {
      map.set(slot.technician.id, { id: slot.technician.id, name: slot.technician.name, slots: [slot] });
    }
  }
  return Array.from(map.values());
}

/** Format YYYY-MM-DD → e.g. "今天" / "Jun 20" depending on language and available labels. */
function formatDateLabel(
  date: string,
  label: string,
  language: 'zh-CN' | 'en',
  todayIso: string,
): string {
  const c = copy[language];
  if (date === todayIso) return c.today;
  // label is one of Today/Tomorrow/Mon…Sun from the server
  if (label === 'Tomorrow') return language === 'zh-CN' ? '明天' : 'Tomorrow';
  // Otherwise render as "Jun 20" / "6月20日"
  const [, mo, d] = date.split('-').map(Number);
  if (language === 'zh-CN') return `${mo}月${d}日`;
  return `${c.months[mo - 1]} ${d}`;
}

/** Build the grid cells for a given month (year, 0-based month). */
function buildMonthGrid(year: number, month: number): Array<string | null> {
  // month is 0-based
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  // Shift so week starts on Monday: Mon=0 … Sun=6
  const startOffset = (firstDay + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<string | null> = Array(startOffset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const mo = String(month + 1).padStart(2, '0');
    const day = String(d).padStart(2, '0');
    cells.push(`${year}-${mo}-${day}`);
  }
  // pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function BookingTimeSelector({
  days,
  disabled = false,
  loading = false,
  error = null,
  onChange,
  value,
}: BookingTimeSelectorProps) {
  const { language, t } = useLanguage();
  const c = copy[language];

  const todayIso = (() => {
    const now = new Date();
    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  })();

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calOpen, setCalOpen] = useState(false);

  // Calendar view month derived from selected date or today
  const initialYear = new Date().getFullYear();
  const initialMonth = new Date().getMonth();
  const [calYear, setCalYear] = useState(initialYear);
  const [calMonth, setCalMonth] = useState(initialMonth); // 0-based

  const backdropRef = useRef<HTMLDivElement>(null);

  // Auto-select first day when data arrives.
  useEffect(() => {
    if (days.length > 0) {
      setSelectedDate((prev) => prev ?? days[0].date);
    }
  }, [days]);

  // Close calendar on backdrop click
  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === backdropRef.current) setCalOpen(false);
  }

  function selectDate(date: string) {
    setSelectedDate(date);
    setCalOpen(false);
  }

  if (loading) {
    return (
      <section className="time-selector" aria-label={c.aria}>
        <p className="time-selector-status">{t('booking.slots.loading')}</p>
      </section>
    );
  }
  if (error) {
    return (
      <section className="time-selector" aria-label={c.aria}>
        <p className="time-selector-status time-selector-error">{t('booking.slots.error')}</p>
      </section>
    );
  }
  if (days.length === 0) {
    return (
      <section className="time-selector" aria-label={c.aria}>
        <p className="time-selector-status">{t('booking.slots.empty')}</p>
      </section>
    );
  }

  const activeDay = days.find((d) => d.date === selectedDate) ?? days[0];
  const activeDateLabel = formatDateLabel(activeDay.date, activeDay.label, language, todayIso);
  const techGroups = groupByTechnician(activeDay.slots);

  const availableDates = new Set(days.filter((d) => d.slots.length > 0).map((d) => d.date));
  const grid = buildMonthGrid(calYear, calMonth);

  const monthLabel = `${c.months[calMonth]}${language === 'zh-CN' ? ' ' : ' '}${calYear}`;

  return (
    <section className="time-selector" aria-label={c.aria}>
      {/* Date trigger + calendar anchor */}
      <div className="ts-cal-anchor">
        <button
          type="button"
          className="ts-date-trigger"
          onClick={() => setCalOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={calOpen}
        >
          <span className="ts-date-trigger-icon">📅</span>
          <span className="ts-date-trigger-label">{activeDateLabel}</span>
          <span className="ts-date-trigger-chevron" aria-hidden="true">›</span>
        </button>

      {/* Calendar overlay */}
      {calOpen && (
        <>
          {/* Dim backdrop — fixed, covers whole viewport, click to close */}
          <div
            className="ts-cal-backdrop"
            ref={backdropRef}
            role="presentation"
            onClick={handleBackdropClick}
          />
          {/* Sheet — absolute child of the anchor, drops below the trigger */}
          <div className="ts-cal-sheet" role="dialog" aria-label={c.aria}>
            {/* Month nav */}
            <div className="ts-cal-header">
              <button
                type="button"
                className="ts-cal-nav"
                aria-label={c.prevMonth}
                onClick={() => {
                  if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
                  else setCalMonth(m => m - 1);
                }}
              >‹</button>
              <span className="ts-cal-month-label">{monthLabel}</span>
              <button
                type="button"
                className="ts-cal-nav"
                aria-label={c.nextMonth}
                onClick={() => {
                  if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
                  else setCalMonth(m => m + 1);
                }}
              >›</button>
            </div>

            {/* Weekday headers */}
            <div className="ts-cal-weekdays">
              {c.weekdays.map((wd, i) => (
                <span key={i} className="ts-cal-wd">{wd}</span>
              ))}
            </div>

            {/* Day grid */}
            <div className="ts-cal-grid">
              {grid.map((iso, i) => {
                if (!iso) return <span key={i} className="ts-cal-cell ts-cal-empty" />;
                const isToday = iso === todayIso;
                const isSelected = iso === (selectedDate ?? days[0].date);
                const hasSlots = availableDates.has(iso);
                const isPast = iso < todayIso;
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={!hasSlots || isPast}
                    className={[
                      'ts-cal-cell',
                      isToday ? 'ts-cal-today' : '',
                      isSelected ? 'ts-cal-selected' : '',
                      hasSlots && !isPast ? 'ts-cal-available' : '',
                      (!hasSlots || isPast) ? 'ts-cal-unavailable' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => selectDate(iso)}
                  >
                    {Number(iso.split('-')[2])}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
      </div>{/* end ts-cal-anchor */}

      {/* Technician + time slot grid */}
      <div className="ts-tech-list" role="tabpanel">
        {techGroups.length === 0 ? (
          <p className="time-selector-status">{c.noSlotsDay}</p>
        ) : (
          techGroups.map((tech) => (
            <div key={tech.id} className="ts-tech-section">
              <p className="ts-tech-name">{tech.name}</p>
              <div className="ts-slot-grid">
                {tech.slots.map((slot) => {
                  const selected =
                    value?.date === activeDay.date &&
                    value.time === slot.time &&
                    value.technician.id === slot.technician.id;
                  return (
                    <button
                      key={`${activeDay.date}-${slot.time}-${slot.technician.id}`}
                      type="button"
                      aria-pressed={selected}
                      disabled={disabled}
                      className={selected ? 'ts-slot ts-slot-selected' : 'ts-slot'}
                      onClick={() => onChange(slot)}
                    >
                      {slot.time}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
