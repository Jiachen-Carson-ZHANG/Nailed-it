'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toast } from '@/components/ui/Toast';
import { consumeCustomerBookingDraft } from '@/domain/booking-draft';
import { getCustomerBookingPath } from '@/domain/session';
import { BookingTimeSelector, type BookingSlotChoice } from '@/features/customer/BookingTimeSelector';
import { availableSlots } from '@/mock/bookings';

export default function CustomerBookingConfirmPage() {
  const [draft] = useState(() => consumeCustomerBookingDraft());
  const [notes, setNotes] = useState(
    draft?.recognition.selection.otherNotes ?? 'Prefer a softer pink tone.'
  );
  const [selectedSlot, setSelectedSlot] = useState<BookingSlotChoice | null>(null);
  const [toastMessage, setToastMessage] = useState('');

  if (!draft) {
    return (
      <MobileLayout
        role="customer"
        subtitle="This lightweight flow keeps the current booking draft in memory until you move into confirmation."
        title="Nailed-it"
      >
        <section className="page-heading">
          <p className="section-eyebrow">Confirm booking</p>
          <h1>Booking draft unavailable</h1>
        </section>
        <EmptyState
          body="Start from the booking step so the current recognition result and estimate can be carried into confirmation."
          title="No active booking draft"
        />
        <Link className="button button-primary" href={getCustomerBookingPath()}>
          Back to booking
        </Link>
      </MobileLayout>
    );
  }

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
        <strong>Current AI booking draft</strong>
        <p>{draft.recognition.selection.otherNotes}</p>
        <p>
          Estimated: SGD {draft.estimate.price} · {draft.estimate.duration} min
        </p>
        {draft.imageUrl ? (
          <img alt="Booking draft reference" className="booking-draft-image" src={draft.imageUrl} />
        ) : null}
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
