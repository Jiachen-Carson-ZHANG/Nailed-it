'use client';

import { ChipButton } from '@/components/ui/ChipButton';

export type BookingSlotChoice = {
  date: string;
  label: string;
  time: string;
};

type BookingTimeSelectorProps = {
  days: Array<{
    date: string;
    label: string;
    slots: string[];
  }>;
  onChange: (nextValue: BookingSlotChoice) => void;
  value: BookingSlotChoice | null;
};

export function BookingTimeSelector({ days, onChange, value }: BookingTimeSelectorProps) {
  return (
    <section className="time-selector" aria-label="Available appointment times">
      {days.map((day) => (
        <div key={day.date} className="time-selector-day">
          <h2>{day.label}</h2>
          <div className="chip-row">
            {day.slots.map((slot) => {
              const selected = value?.date === day.date && value.time === slot;

              return (
                <ChipButton
                  key={`${day.date}-${slot}`}
                  label={slot}
                  selected={selected}
                  onClick={() =>
                    onChange({
                      date: day.date,
                      label: day.label,
                      time: slot
                    })
                  }
                />
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
