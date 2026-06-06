import { calculateEstimate } from '@/domain/pricing';
import { findTechnicianSlots } from '@/domain/availability';
import type { AIRecognitionResult, Booking, BookingQuote, TechnicianSnapshot } from '@/domain/nail';
import { defaultPricingRules } from './pricing';
import { getStyleDefinitionById } from './styles';
import { mockTechnicians } from './technicians';

const technicianSnapshots = Object.fromEntries(
  mockTechnicians.map((technician) => [
    technician.id,
    { id: technician.id, name: technician.name, initials: technician.initials }
  ])
) as Record<string, TechnicianSnapshot>;

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
    technician: technicianSnapshots['tech-mei'],
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
    technician: technicianSnapshots['tech-lina'],
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
    technician: technicianSnapshots['tech-anna'],
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
    technician: technicianSnapshots['tech-mei'],
    notes: 'A quick after-work appointment would be ideal.'
  })
];

const slotTemplates = [
  { label: 'Today', date: '2026-05-23', slots: ['10:00', '12:30', '14:00', '16:00', '18:00'] },
  { label: 'Tomorrow', date: '2026-05-24', slots: ['11:00', '13:30', '15:30', '18:00'] }
] as const;

export function getAvailableBookingDays(bookings: Booking[] = mockBookings, durationMin = 60) {
  return findTechnicianSlots({
    bookings,
    days: slotTemplates.map((day) => ({ ...day, slots: [...day.slots] })),
    technicians: mockTechnicians,
    durationMin
  });
}

export const availableSlots = getAvailableBookingDays(mockBookings);
