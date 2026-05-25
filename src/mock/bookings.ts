import { calculateEstimate } from '@/domain/pricing';
import type { AIRecognitionResult, Booking, BookingQuote, TechnicianSnapshot } from '@/domain/nail';
import { defaultPricingRules } from './pricing';
import { getStyleDefinitionById } from './styles';

const technicianSnapshots: Record<string, TechnicianSnapshot> = {
  mei: { id: 'tech-mei', name: 'Mei Chen', initials: 'MC' },
  lina: { id: 'tech-lina', name: 'Lina Park', initials: 'LP' },
  anna: { id: 'tech-anna', name: 'Anna Lim', initials: 'AL' }
};

function createBookingQuote(recognition: AIRecognitionResult): BookingQuote {
  const quote = calculateEstimate(recognition, defaultPricingRules);

  return {
    source: 'booking_snapshot',
    price: quote.price,
    duration: quote.duration
  };
}

function createBookingFromStyle({
  customerName,
  date,
  id,
  merchantName,
  notes,
  status,
  styleId,
  technician,
  time
}: {
  customerName: string;
  date: string;
  id: string;
  merchantName: string;
  notes: string;
  status: Booking['status'];
  styleId: string;
  technician: TechnicianSnapshot;
  time: string;
}): Booking {
  const style = getStyleDefinitionById(styleId);

  if (!style) {
    throw new Error(`Unknown style definition: ${styleId}`);
  }

  return {
    id,
    customerName,
    merchantName,
    styleTitle: style.title,
    styleImageUrl: style.imageUrl,
    date,
    time,
    quote: createBookingQuote(style.recognition),
    status,
    technician,
    notes,
    recognition: style.recognition
  };
}

export const mockBookings: Booking[] = [
  createBookingFromStyle({
    id: 'booking-001',
    customerName: 'Melissa Tan',
    merchantName: 'Nailed-it Studio',
    styleId: 'rose-cat-eye',
    date: '2026-05-23',
    time: '14:00',
    status: 'pending_review',
    technician: technicianSnapshots.mei,
    notes: 'Prefer a softer pink tone and lighter crystal placement.'
  }),
  createBookingFromStyle({
    id: 'booking-002',
    customerName: 'Amy Lim',
    merchantName: 'Nailed-it Studio',
    styleId: 'soft-french',
    date: '2026-05-23',
    time: '16:00',
    status: 'confirmed',
    technician: technicianSnapshots.lina,
    notes: 'Keep the line thin and natural.'
  }),
  createBookingFromStyle({
    id: 'booking-003',
    customerName: 'Zoe Wong',
    merchantName: 'Nailed-it Studio',
    styleId: 'chrome-mirror',
    date: '2026-05-24',
    time: '11:00',
    status: 'completed',
    technician: technicianSnapshots.anna,
    notes: 'Short almond shape, keep the chrome reflection clean.'
  }),
  createBookingFromStyle({
    id: 'booking-004',
    customerName: 'Rachel Goh',
    merchantName: 'Nailed-it Studio',
    styleId: 'minimal-solid',
    date: '2026-05-24',
    time: '15:30',
    status: 'pending_review',
    technician: technicianSnapshots.mei,
    notes: 'A quick after-work appointment would be ideal.'
  })
];

const slotTemplates = [
  { label: 'Today', date: '2026-05-23', slots: ['10:00', '12:30', '14:00', '16:00', '18:00'] },
  { label: 'Tomorrow', date: '2026-05-24', slots: ['11:00', '13:30', '15:30', '18:00'] }
] as const;

export function getAvailableSlots(bookings: Booking[]) {
  return slotTemplates.map((day) => {
    const occupiedTimes = new Set(
      bookings.filter((booking) => booking.date === day.date).map((booking) => booking.time)
    );

    return {
      label: day.label,
      date: day.date,
      slots: day.slots.filter((slot) => !occupiedTimes.has(slot))
    };
  });
}

export const availableSlots = getAvailableSlots(mockBookings);
