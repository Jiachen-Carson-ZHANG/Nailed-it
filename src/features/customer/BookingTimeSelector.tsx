'use client';

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
  onChange: (nextValue: BookingSlotChoice) => void;
  value: BookingSlotChoice | null;
};

export function BookingTimeSelector({
  days,
  disabled = false,
  onChange,
  value
}: BookingTimeSelectorProps) {
  const { language } = useLanguage();
  const labels = weekdayLabels[language];

  return (
    <section className="time-selector" aria-label={labels.aria}>
      {days.map((day) => (
        <div key={day.date} className="time-selector-day">
          <h2>{labels[day.label as keyof typeof labels] ?? day.label}</h2>
          <div className="chip-row">
            {day.slots.map((slot) => {
              const selected =
                value?.date === day.date &&
                value.time === slot.time &&
                value.technician.id === slot.technician.id;

              return (
                <ChipButton
                  key={`${day.date}-${slot.time}-${slot.technician.id}`}
                  disabled={disabled}
                  label={`${slot.time} · ${slot.technician.name}`}
                  selected={selected}
                  onClick={() => onChange(slot)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
