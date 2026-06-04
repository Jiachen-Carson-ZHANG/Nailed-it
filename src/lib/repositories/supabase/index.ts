import type { RepositoryBundle } from '../types';
import { createSupabaseBookingRepository } from './booking-repository';
import { createSupabaseConversationRepository } from './conversation-repository';
import { createSupabasePricingRepository } from './pricing-repository';
import { createSupabaseTechnicianRepository } from './technician-repository';
import { createSupabaseStyleRepository } from './style-repository';

export function createSupabaseRepositoryBundle(): RepositoryBundle {
  return {
    bookings: createSupabaseBookingRepository(),
    conversations: createSupabaseConversationRepository(),
    pricing: createSupabasePricingRepository(),
    technicians: createSupabaseTechnicianRepository(),
    styles: createSupabaseStyleRepository(),
  };
}
