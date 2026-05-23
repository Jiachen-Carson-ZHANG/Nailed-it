'use client';

import { useMemo, useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { calculateEstimate } from '@/domain/pricing';
import { BookingTimeSelector, type BookingSlotChoice } from '@/features/customer/BookingTimeSelector';
import { availableSlots } from '@/mock/bookings';
import { mockAIResult } from '@/mock/ai';
import { defaultPricingRules } from '@/mock/pricing';

export default function CustomerBookingConfirmPage() {
  const [notes, setNotes] = useState('Prefer a softer pink tone.');
  const [selectedSlot, setSelectedSlot] = useState<BookingSlotChoice | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const estimate = useMemo(
    () => calculateEstimate(mockAIResult, defaultPricingRules),
    []
  );

  function confirmAppointment() {
    if (!selectedSlot) {
      return;
    }

    setToastMessage(
      `Booking request sent to merchant for ${selectedSlot.label.toLowerCase()} at ${selectedSlot.time}.`
    );
  }

  return (
    <MobileLayout
      role="customer"
      subtitle="Pick an open slot from the shared mock availability, then send a lightweight confirmation request."
      title="Nailed-it"
    >
      <section className="page-heading">
        <p className="section-eyebrow">Confirm booking</p>
        <h1>Choose your appointment time</h1>
        <p className="section-copy">
          This confirmation step stays on the current shell and reuses the same rule-based estimate
          contract.
        </p>
      </section>

      <section className="summary-card">
        <strong>Rose Cat Eye Shine</strong>
        <p>{mockAIResult.selection.otherNotes}</p>
        <p>
          Estimated: SGD {estimate.price} · {estimate.duration} min
        </p>
      </section>

      <BookingTimeSelector days={availableSlots} value={selectedSlot} onChange={setSelectedSlot} />

      <label className="field">
        <span>Notes</span>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>

      <Button disabled={!selectedSlot} onClick={confirmAppointment}>
        Confirm appointment
      </Button>
      <Toast message={toastMessage} />
    </MobileLayout>
  );
}
