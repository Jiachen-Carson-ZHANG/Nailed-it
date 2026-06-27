import type { RepositoryBundle } from '../types';
import { createSupabaseBookingRepository } from './booking-repository';
import { createSupabaseConversationRepository } from './conversation-repository';
import { createSupabasePricingRepository } from './pricing-repository';
import { createSupabaseTechnicianRepository } from './technician-repository';
import { createSupabaseStyleRepository } from './style-repository';
import { createSupabaseCatalogRepository } from './catalog-repository';
import { createSupabaseMerchantRepository } from './merchant-repository';
import { createSupabaseMerchantPricingRepository } from './merchant-pricing-repository';
import {
  createSupabaseBlockedTimeRepository,
  createSupabaseStaffItemDurationRepository,
  createSupabaseWorkingPlanRepository,
} from './scheduling-repository';
import { createSupabaseIntervalBookingRepository } from './interval-booking-repository';
import { createSupabaseMerchantStyleRepository } from './merchant-style-repository';
import { createSupabaseAnalyticsRepository } from './analytics-repository';
import { createSupabaseCustomerRepository } from './customer-repository';
import { createSupabaseAgentRepository } from './agent-repository';

export function createSupabaseRepositoryBundle(): RepositoryBundle {
  return {
    bookings: createSupabaseBookingRepository(),
    conversations: createSupabaseConversationRepository(),
    pricing: createSupabasePricingRepository(),
    technicians: createSupabaseTechnicianRepository(),
    styles: createSupabaseStyleRepository(),
    catalog: createSupabaseCatalogRepository(),
    merchants: createSupabaseMerchantRepository(),
    merchantPricing: createSupabaseMerchantPricingRepository(),
    workingPlans: createSupabaseWorkingPlanRepository(),
    blockedTimes: createSupabaseBlockedTimeRepository(),
    intervalBookings: createSupabaseIntervalBookingRepository(),
    staffItemDurations: createSupabaseStaffItemDurationRepository(),
    merchantStyles: createSupabaseMerchantStyleRepository(),
    analytics: createSupabaseAnalyticsRepository(),
    customers: createSupabaseCustomerRepository(),
    agents: createSupabaseAgentRepository(),
  };
}
