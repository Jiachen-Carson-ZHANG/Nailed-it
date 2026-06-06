import type { RepositoryBundle } from './types';
import { createMemoryBookingRepository } from './memory/booking-repository';
import { createMemoryConversationRepository } from './memory/conversation-repository';
import { createMemoryPricingRepository } from './memory/pricing-repository';
import { createMemoryTechnicianRepository } from './memory/technician-repository';
import { createMemoryStyleRepository } from './memory/style-repository';
import { createMemoryCatalogRepository } from './memory/catalog-repository';
import { createMemoryMerchantRepository } from './memory/merchant-repository';
import { createMemoryMerchantPricingRepository } from './memory/merchant-pricing-repository';
import {
  createMemoryBlockedTimeRepository,
  createMemoryStaffItemDurationRepository,
  createMemoryWorkingPlanRepository,
} from './memory/scheduling-repository';
import { createMemoryIntervalBookingRepository } from './memory/interval-booking-repository';
import { createMemoryMerchantStyleRepository } from './memory/merchant-style-repository';
import { hasSupabaseEnv } from '@/lib/db/client';
import { createSupabaseRepositoryBundle } from './supabase';

export function createMemoryRepositoryBundle(): RepositoryBundle {
  // Share one conversations repo so intervalBookings.createWithThread writes the booking and its
  // thread against the same in-memory store (mirrors the DB's single-transaction RPC).
  const conversations = createMemoryConversationRepository();
  return {
    bookings: createMemoryBookingRepository(),
    conversations,
    pricing: createMemoryPricingRepository(),
    technicians: createMemoryTechnicianRepository(),
    styles: createMemoryStyleRepository(),
    catalog: createMemoryCatalogRepository(),
    merchants: createMemoryMerchantRepository(),
    merchantPricing: createMemoryMerchantPricingRepository(),
    workingPlans: createMemoryWorkingPlanRepository(),
    blockedTimes: createMemoryBlockedTimeRepository(),
    intervalBookings: createMemoryIntervalBookingRepository(undefined, undefined, conversations),
    staffItemDurations: createMemoryStaffItemDurationRepository(),
    merchantStyles: createMemoryMerchantStyleRepository(),
  };
}

let _bundle: RepositoryBundle | null = null;

export function getRepositories(): RepositoryBundle {
  if (_bundle === null) {
    const useSupabase =
      hasSupabaseEnv() &&
      process.env.NODE_ENV !== 'test' &&
      !process.env.VITEST;
    _bundle = useSupabase ? createSupabaseRepositoryBundle() : createMemoryRepositoryBundle();
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
  CatalogRepository,
  MerchantRepository,
  MerchantPricingRepository,
  WorkingPlanRepository,
  BlockedTimeRepository,
  IntervalBookingRepository,
  StaffItemDurationRepository,
  MerchantStyleRepository,
} from './types';
