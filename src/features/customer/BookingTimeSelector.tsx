'use client';

import { ChipButton } from '@/components/ui/ChipButton';
import type { TechnicianSlot } from '@/domain/nail';

export type BookingSlotChoice = TechnicianSlot;

type BookingTimeSelectorProps = {
  days: Array<{
    date: string;
    label: string;
    slots: TechnicianSlot[];
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
              const selected =
                value?.date === day.date &&
                value.time === slot.time &&
                value.technician.id === slot.technician.id;

              return (
                <ChipButton
                  key={`${day.date}-${slot.time}-${slot.technician.id}`}
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
