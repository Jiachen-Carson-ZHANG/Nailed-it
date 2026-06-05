import type {
  Booking,
  BookingConversationThread,
  BookingMessage,
  PricingItem,
  Technician,
} from '@/domain/nail';
import type { StyleDefinition } from '@/mock/styles';
import type { CatalogItem, CatalogItemType } from '@/domain/catalog';
import type { Merchant, MerchantPricing } from '@/domain/merchant';
import type { BlockedTime, WorkingPlanDay } from '@/domain/scheduling';

export interface BookingRepository {
  list(): Promise<Booking[]>;
  getById(id: string): Promise<Booking | null>;
  insert(booking: Booking): Promise<Booking>;
  updateStatus(id: string, status: Booking['status']): Promise<Booking | null>;
}

export interface ConversationRepository {
  list(): Promise<BookingConversationThread[]>;
  getById(id: string): Promise<BookingConversationThread | null>;
  insert(thread: BookingConversationThread): Promise<BookingConversationThread>;
  appendMessage(
    threadId: string,
    message: BookingMessage,
  ): Promise<BookingConversationThread | null>;
}

export interface PricingRepository {
  list(): Promise<PricingItem[]>;
  replaceAll(rules: PricingItem[]): Promise<PricingItem[]>;
}

export interface TechnicianRepository {
  list(): Promise<Technician[]>;
}

export interface StyleRepository {
  list(): Promise<StyleDefinition[]>;
  getById(id: string): Promise<StyleDefinition | null>;
}

export interface CatalogRepository {
  list(): Promise<CatalogItem[]>;
  getById(id: string): Promise<CatalogItem | null>;
  listByType(type: CatalogItemType): Promise<CatalogItem[]>;
}

export interface MerchantRepository {
  list(): Promise<Merchant[]>;
  getById(id: string): Promise<Merchant | null>;
}

export interface MerchantPricingRepository {
  listByMerchant(merchantId: string): Promise<MerchantPricing[]>;
  upsertMany(rows: MerchantPricing[]): Promise<MerchantPricing[]>;
}

export interface WorkingPlanRepository {
  list(): Promise<WorkingPlanDay[]>;
  listByTechnician(technicianId: string): Promise<WorkingPlanDay[]>;
}

export interface BlockedTimeRepository {
  list(): Promise<BlockedTime[]>;
  listByTechnician(technicianId: string): Promise<BlockedTime[]>;
}

export interface RepositoryBundle {
  bookings: BookingRepository;
  conversations: ConversationRepository;
  pricing: PricingRepository;
  technicians: TechnicianRepository;
  styles: StyleRepository;
  catalog: CatalogRepository;
  merchants: MerchantRepository;
  merchantPricing: MerchantPricingRepository;
  workingPlans: WorkingPlanRepository;
  blockedTimes: BlockedTimeRepository;
}
