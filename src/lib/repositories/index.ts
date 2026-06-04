// Supabase-backed bundle will be selected here by env in a later phase.
import type { RepositoryBundle } from './types';
import { createMemoryBookingRepository } from './memory/booking-repository';
import { createMemoryConversationRepository } from './memory/conversation-repository';
import { createMemoryPricingRepository } from './memory/pricing-repository';
import { createMemoryTechnicianRepository } from './memory/technician-repository';
import { createMemoryStyleRepository } from './memory/style-repository';

export function createMemoryRepositoryBundle(): RepositoryBundle {
  return {
    bookings: createMemoryBookingRepository(),
    conversations: createMemoryConversationRepository(),
    pricing: createMemoryPricingRepository(),
    technicians: createMemoryTechnicianRepository(),
    styles: createMemoryStyleRepository(),
  };
}

let _bundle: RepositoryBundle | null = null;

export function getRepositories(): RepositoryBundle {
  if (_bundle === null) {
    _bundle = createMemoryRepositoryBundle();
  }
  return _bundle;
}

export function resetRepositoriesForTests(): void {
  _bundle = null;
}

export type { RepositoryBundle } from './types';
export type {
  BookingRepository,
  ConversationRepository,
  PricingRepository,
  TechnicianRepository,
  StyleRepository,
} from './types';
