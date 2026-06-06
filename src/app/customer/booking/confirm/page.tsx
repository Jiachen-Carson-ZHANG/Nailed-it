'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toast } from '@/components/ui/Toast';
import {
  consumeCustomerBookingDraft,
  readCustomerBookingDraftSnapshot
} from '@/domain/booking-draft';
import type { Booking } from '@/domain/nail';
import { getCustomerBookingPath, getCustomerMessagesPath } from '@/domain/session';
import { BookingTimeSelector, type BookingSlotChoice } from '@/features/customer/BookingTimeSelector';
import type { TechnicianSlotDay } from '@/domain/availability';
import { createBookingAction, listAvailableSlotsAction } from '@/lib/actions/booking-actions';

export default function CustomerBookingConfirmPage() {
  const [draftSnapshot] = useState(() => readCustomerBookingDraftSnapshot());
  const draft = draftSnapshot?.draft ?? null;
  const [notes, setNotes] = useState(
    draft?.recognition.selection.otherNotes ?? 'Prefer a softer pink tone.'
  );
  const [availableDays, setAvailableDays] = useState<TechnicianSlotDay[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<BookingSlotChoice | null>(null);
  const [createdBooking, setCreatedBooking] = useState<Booking | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const bookingLocked = Boolean(createdBooking);

  useEffect(() => {
    if (!draftSnapshot) {
      return undefined;
    }

    // 中文注释：在 commit 之后再消费 snapshot，可避免 StrictMode 下 render/init 阶段的重复调用
    // 提前把 draft 清掉；同时用 version 守卫，防止误消费一份更新后的新草稿。
    const timerId = window.setTimeout(() => {
      consumeCustomerBookingDraft(draftSnapshot.version);
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [draftSnapshot]);

  // Availability now comes from the booking service (DB occupancy), not localStorage.
  useEffect(() => {
    if (!draft) {
      return undefined;
    }
    let active = true;
    listAvailableSlotsAction(draft.estimate.duration)
      .then((days) => {
        if (active) setAvailableDays(days);
      })
      .catch(() => {
        /* leave empty */
      });
    return () => {
      active = false;
    };
  }, [draft]);

  if (!draft) {
    return (
      <MobileLayout
        role="customer"
        title="Nailed-it"
      >
        <section className="page-heading">
          <p className="section-eyebrow">Confirm booking</p>
          <h1>Pick a style first</h1>
        </section>
        <EmptyState
          icon="◔"
          body="Choose a look from the home page or upload your own photo to see your quote, then come back here to lock in the time."
          title="No style selected yet"
        />
        <Link className="button button-primary button-block" href={getCustomerBookingPath()}>
          Start booking
        </Link>
      </MobileLayout>
    );
  }

  async function confirmAppointment() {
    if (!selectedSlot || !draft || createdBooking || isConfirming) {
      return;
    }

    setIsConfirming(true);

    try {
      // Identity, price, and review status are all derived server-side from the recognition.
      const booking = await createBookingAction({
        technicianId: selectedSlot.technician.id,
        recognition: draft.recognition,
        styleTitle: 'Custom AI reference',
        styleImageUrl: draft.imageUrl,
        date: selectedSlot.date,
        time: selectedSlot.time,
        notes
      });
      setCreatedBooking(booking);
      setToastMessage(
        booking.status === 'confirmed'
          ? `Confirmed with ${booking.technician.name} for ${selectedSlot.label.toLowerCase()} at ${selectedSlot.time}.`
          : `Pending review with ${booking.technician.name} for ${selectedSlot.label.toLowerCase()} at ${selectedSlot.time}.`
      );
    } catch (error) {
      setToastMessage(
        error instanceof Error && error.message === 'booking_overlap'
          ? 'That technician was just booked for an overlapping time. Please pick another slot.'
          : 'Could not confirm the appointment. Please try again.'
      );
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <MobileLayout
      role="customer"
      title="Nailed-it"
    >
      <section className="page-heading">
        <p className="section-eyebrow">Confirm booking</p>
        <h1>Choose your appointment time</h1>
        <p className="section-copy">
          Select your preferred time slot below.
        </p>
      </section>

      <section className="summary-card">
        <strong>Your booking summary</strong>
        <p>{draft.recognition.selection.otherNotes}</p>
        <p>
          Estimated: SGD {draft.estimate.price} · {draft.estimate.duration} min
        </p>
        {draft.imageUrl ? (
          <img alt="Booking draft reference" className="booking-draft-image" src={draft.imageUrl} />
        ) : null}
      </section>

      <BookingTimeSelector
        days={availableDays}
        disabled={bookingLocked}
        value={selectedSlot}
        onChange={setSelectedSlot}
      />

      <label className="field">
        <span>Notes</span>
        <textarea
          disabled={bookingLocked}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>

      <Button block disabled={!selectedSlot || bookingLocked || isConfirming} onClick={confirmAppointment}>
        {isConfirming
          ? 'Confirming…'
          : createdBooking?.status === 'pending_review'
            ? 'Pending review'
            : createdBooking
              ? 'Appointment confirmed'
              : 'Confirm appointment'}
      </Button>
      {createdBooking?.conversationId ? (
        <Link
          className="button button-secondary button-block"
          href={getCustomerMessagesPath(createdBooking.conversationId)}
        >
          Open booking messages
        </Link>
      ) : null}
      <Toast message={toastMessage} />
    </MobileLayout>
  );
}
