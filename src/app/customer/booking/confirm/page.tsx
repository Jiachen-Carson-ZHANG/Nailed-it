'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { getCustomerBookingPath, getCustomerMessagesPath, homePathForRole } from '@/domain/session';
import { BookingTimeSelector, type BookingSlotChoice } from '@/features/customer/BookingTimeSelector';
import type { TechnicianSlotDay } from '@/domain/availability';
import {
  createBookingAction,
  createBookingFromSelectionsAction,
  createBookingFromStyleAction,
  listAvailableSlotsAction,
  listAvailableSlotsForSelectionsAction,
  listAvailableSlotsForStyleAction,
} from '@/lib/actions/booking-actions';

const DEFAULT_NOTES_PLACEHOLDER = '如有特殊要求请在此注明，例如：对某些材料过敏、希望避免某些颜色、甲型偏好等。';

export default function CustomerBookingConfirmPage() {
  const router = useRouter();
  const [draftSnapshot] = useState(() => readCustomerBookingDraftSnapshot());
  const draft = draftSnapshot?.draft ?? null;
  const [notes, setNotes] = useState('');
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
    const request = draft.styleId
      ? listAvailableSlotsForStyleAction(draft.styleId)
      : draft.catalogSelections?.length
        ? listAvailableSlotsForSelectionsAction(draft.catalogSelections)
        : listAvailableSlotsAction(draft.estimate.duration);
    request
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
      // A published style books its curated catalog breakdown (server-derived price + relational
      // booking_items); a free-form photo books the flat recognition estimate. Identity, price, and
      // review status are always derived server-side.
      const booking = draft.styleId
        ? await createBookingFromStyleAction({
            styleId: draft.styleId,
            technicianId: selectedSlot.technician.id,
            date: selectedSlot.date,
            time: selectedSlot.time,
            notes,
          })
        : draft.catalogSelections?.length
          ? await createBookingFromSelectionsAction({
              selections: draft.catalogSelections,
              technicianId: selectedSlot.technician.id,
              styleImageUrl: draft.imageUrl,
              date: selectedSlot.date,
              time: selectedSlot.time,
              notes,
            })
          : await createBookingAction({
              technicianId: selectedSlot.technician.id,
              recognition: draft.recognition,
              styleTitle: 'Custom AI reference',
              styleImageUrl: draft.imageUrl,
              date: selectedSlot.date,
              time: selectedSlot.time,
              notes,
            });
      setCreatedBooking(booking);
      setToastMessage(
        booking.status === 'confirmed'
          ? `Confirmed with ${booking.technician.name} for ${selectedSlot.label.toLowerCase()} at ${selectedSlot.time}.`
          : `Pending review with ${booking.technician.name} for ${selectedSlot.label.toLowerCase()} at ${selectedSlot.time}.`
      );
      setTimeout(() => router.push(homePathForRole('customer')), 1500);
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

  const displayEstimate = selectedSlot?.quote
    ? selectedSlot.quote
    : draft.breakdowns?.glossary
      ? { price: draft.breakdowns.glossary.totalPrice, duration: draft.breakdowns.glossary.totalDuration }
      : { price: draft.estimate.price, duration: draft.estimate.duration };

  return (
    <MobileLayout
      role="customer"
      title="Nailed-it"
    >
      <section className="page-heading">
        <p className="section-eyebrow">Confirm booking</p>
        <h2>Choose your appointment time</h2>
        <p className="section-copy">
          Select your preferred time slot below.
        </p>
      </section>

      {draft.imageUrl && (
        <div className="booking-result-preview">
          <img alt="Booking reference" className="booking-result-image" src={draft.imageUrl} />
        </div>
      )}

      <section className="summary-card">
        <p>Estimated: <strong>{displayEstimate.duration} min · SGD {displayEstimate.price}</strong></p>
      </section>

      <BookingTimeSelector
        days={availableDays}
        disabled={bookingLocked}
        value={selectedSlot}
        onChange={setSelectedSlot}
      />

      <label className="field">
        <span>备注</span>
        <textarea
          disabled={bookingLocked}
          value={notes}
          placeholder={DEFAULT_NOTES_PLACEHOLDER}
          onChange={(event) => setNotes(event.target.value)}
          style={{ marginBottom: '0.75rem' }}
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
