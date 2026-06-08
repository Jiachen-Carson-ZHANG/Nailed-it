'use client';

import { useEffect, useState } from 'react';
import { ChipButton } from '@/components/ui/ChipButton';
import type { TechnicianSlot } from '@/domain/nail';
import { useLanguage } from '@/i18n/context';

const weekdayLabels = {
  'zh-CN': {
    Today: '今天',
    Tomorrow: '明天',
    Sun: '周日',
    Mon: '周一',
    Tue: '周二',
    Wed: '周三',
    Thu: '周四',
    Fri: '周五',
    Sat: '周六',
    aria: '可预约时间',
  },
  en: {
    Today: 'Today',
    Tomorrow: 'Tomorrow',
    Sun: 'Sun',
    Mon: 'Mon',
    Tue: 'Tue',
    Wed: 'Wed',
    Thu: 'Thu',
    Fri: 'Fri',
    Sat: 'Sat',
    aria: 'Available appointment times',
  },
} as const;

export type BookingSlotChoice = TechnicianSlot;

type BookingTimeSelectorProps = {
  days: Array<{
    date: string;
    label: string;
    slots: TechnicianSlot[];
  }>;
  disabled?: boolean;
  loading?: boolean;
  error?: string | null;
  onChange: (nextValue: BookingSlotChoice) => void;
  value: BookingSlotChoice | null;
};

/** Groups TechnicianSlot[] by technician id, preserving order of first appearance. */
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

export function BookingTimeSelector({
  days,
  disabled = false,
  loading = false,
  error = null,
  onChange,
  value,
}: BookingTimeSelectorProps) {
  const { language, t } = useLanguage();
  const labels = weekdayLabels[language];

  // Track which day + technician accordions are open. Default: first day open, no technician open.
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());
  const [openTechs, setOpenTechs] = useState<Set<string>>(new Set());

  // When data arrives (async load), open the first day automatically.
  useEffect(() => {
    if (days.length > 0) {
      setOpenDays((prev) => {
        if (prev.size > 0) return prev;
        return new Set([days[0].date]);
      });
    }
  }, [days]);

  function toggleDay(date: string) {
    setOpenDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  }

  function toggleTech(key: string) {
    setOpenTechs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  if (loading) {
    return (
      <section className="time-selector" aria-label={labels.aria}>
        <p className="time-selector-status">{t('booking.slots.loading')}</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="time-selector" aria-label={labels.aria}>
        <p className="time-selector-status time-selector-error">{t('booking.slots.error')}</p>
      </section>
    );
  }

  if (days.length === 0) {
    return (
      <section className="time-selector" aria-label={labels.aria}>
        <p className="time-selector-status">{t('booking.slots.empty')}</p>
      </section>
    );
  }

  return (
    <section className="time-selector" aria-label={labels.aria}>
      {days.map((day) => {
        const dayOpen = openDays.has(day.date);
        const techGroups = groupByTechnician(day.slots);
        const localLabel = labels[day.label as keyof typeof labels] ?? day.label;

        return (
          <div key={day.date} className="slot-day-accordion">
            <button
              type="button"
              className="slot-accordion-header slot-day-header"
              aria-expanded={dayOpen}
              onClick={() => toggleDay(day.date)}
            >
              <span className="slot-accordion-label">{localLabel}</span>
              <span className="slot-accordion-meta">{day.slots.length}{language === 'zh-CN' ? ' 个时段' : ' slots'}</span>
              <span className="slot-accordion-chevron" aria-hidden="true">{dayOpen ? '▲' : '▼'}</span>
            </button>

            {dayOpen && (
              <div className="slot-day-body">
                {techGroups.map((tech) => {
                  const techKey = `${day.date}-${tech.id}`;
                  const techOpen = openTechs.has(techKey);

                  return (
                    <div key={tech.id} className="slot-tech-accordion">
                      <button
                        type="button"
                        className="slot-accordion-header slot-tech-header"
                        aria-expanded={techOpen}
                        onClick={() => toggleTech(techKey)}
                      >
                        <span className="slot-accordion-label">{tech.name}</span>
                        <span className="slot-accordion-meta">{tech.slots.length}{language === 'zh-CN' ? ' 个时段' : ' slots'}</span>
                        <span className="slot-accordion-chevron" aria-hidden="true">{techOpen ? '▲' : '▼'}</span>
                      </button>

                      {techOpen && (
                        <div className="chip-row slot-tech-body">
                          {tech.slots.map((slot) => {
                            const selected =
                              value?.date === day.date &&
                              value.time === slot.time &&
                              value.technician.id === slot.technician.id;

                            return (
                              <ChipButton
                                key={`${day.date}-${slot.time}-${slot.technician.id}`}
                                disabled={disabled}
                                label={slot.time}
                                selected={selected}
                                onClick={() => onChange(slot)}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
