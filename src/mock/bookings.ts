import { calculateEstimate } from '@/domain/pricing';
import type { AIRecognitionResult, Booking, BookingQuote } from '@/domain/nail';
import {
  chromeMirrorAIResult,
  dailySolidAIResult,
  mockAIResult,
  softFrenchAIResult
} from './ai';
import { defaultPricingRules } from './pricing';

function createBookingQuote(recognition: AIRecognitionResult): BookingQuote {
  const quote = calculateEstimate(recognition, defaultPricingRules);

  return {
    source: 'booking_snapshot',
    price: quote.price,
    duration: quote.duration
  };
}

export const mockBookings: Booking[] = [
  {
    id: 'booking-001',
    customerName: 'Melissa Tan',
    merchantName: 'Nailed-it Studio',
    styleTitle: 'Rose Cat Eye Shine',
    styleImageUrl:
      'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=900&q=80',
    date: '2026-05-23',
    time: '14:00',
    quote: createBookingQuote(mockAIResult),
    status: 'pending',
    notes: 'Prefer a softer pink tone and lighter crystal placement.',
    recognition: mockAIResult
  },
  {
    id: 'booking-002',
    customerName: 'Amy Lim',
    merchantName: 'Nailed-it Studio',
    styleTitle: 'Soft Studio French',
    styleImageUrl:
      'https://images.unsplash.com/photo-1610992015732-2449b76344bc?auto=format&fit=crop&w=900&q=80',
    date: '2026-05-23',
    time: '16:00',
    quote: createBookingQuote(softFrenchAIResult),
    status: 'confirmed',
    notes: 'Keep the line thin and natural.',
    recognition: softFrenchAIResult
  },
  {
    id: 'booking-003',
    customerName: 'Zoe Wong',
    merchantName: 'Nailed-it Studio',
    styleTitle: 'Chrome Mirror Almond',
    styleImageUrl:
      'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=900&q=80',
    date: '2026-05-24',
    time: '11:00',
    quote: createBookingQuote(chromeMirrorAIResult),
    status: 'completed',
    notes: 'Short almond shape, keep the chrome reflection clean.',
    recognition: chromeMirrorAIResult
  },
  {
    id: 'booking-004',
    customerName: 'Rachel Goh',
    merchantName: 'Nailed-it Studio',
    styleTitle: 'Clean Daily Solid',
    styleImageUrl:
      'https://images.unsplash.com/photo-1599948128020-9a44505b0d1b?auto=format&fit=crop&w=900&q=80',
    date: '2026-05-24',
    time: '15:30',
    quote: createBookingQuote(dailySolidAIResult),
    status: 'pending',
    notes: 'A quick after-work appointment would be ideal.',
    recognition: dailySolidAIResult
  }
];

export const availableSlots = [
  { label: 'Today', date: '2026-05-23', slots: ['14:00', '16:00'] },
  { label: 'Tomorrow', date: '2026-05-24', slots: ['11:00', '15:30', '18:00'] }
] as const;
