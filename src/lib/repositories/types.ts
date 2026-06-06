import type {
  Booking,
  BookingConversationThread,
  BookingMessage,
  PricingItem,
  Technician,
} from '@/domain/nail';
import type { StyleDefinition } from '@/mock/styles';
import type { CatalogItem, CatalogItemType, CatalogSelection } from '@/domain/catalog';
import type { StyleDiscoveryFacet } from '@/domain/nail';
import type { Merchant, MerchantPricing } from '@/domain/merchant';
import type { BlockedTime, StaffItemDuration, WorkingPlanDay } from '@/domain/scheduling';
import type { BookingItem, BookingStatus, IntervalBooking } from '@/domain/booking';
import type { MerchantStyleRecord } from '@/domain/merchant-style';

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
  /** Blocks for one technician overlapping [startAt, endAt). */
  listByTechnicianInRange(
    technicianId: string,
    startAt: string,
    endAt: string,
  ): Promise<BlockedTime[]>;
}

export interface IntervalBookingRepository {
  getById(id: string): Promise<IntervalBooking | null>;
  /** All bookings (any status) for a merchant — for the calendar/profile reader surfaces. */
  listByMerchant(merchantId: string): Promise<IntervalBooking[]>;
  /** Non-cancelled bookings for one technician overlapping [startAt, endAt). */
  listByTechnicianInRange(
    technicianId: string,
    startAt: string,
    endAt: string,
  ): Promise<IntervalBooking[]>;
  listItems(bookingId: string): Promise<BookingItem[]>;
  /** Atomic create of a booking + its items. Throws Error('booking_overlap') on conflict. */
  create(booking: IntervalBooking, items: BookingItem[]): Promise<IntervalBooking>;
  /**
   * Atomic create of a booking + its items + the linked conversation thread (and its messages),
   * in one transaction. Either everything commits or nothing does — no orphan booking, no empty
   * thread, so no compensating cancel is needed. Throws Error('booking_overlap') on conflict.
   */
  createWithThread(
    booking: IntervalBooking,
    items: BookingItem[],
    thread: BookingConversationThread,
  ): Promise<IntervalBooking>;
  setStatus(id: string, status: BookingStatus): Promise<IntervalBooking | null>;
}

export interface StaffItemDurationRepository {
  listByTechnician(technicianId: string): Promise<StaffItemDuration[]>;
}

export type PublishMerchantStyleInput = {
  id: string;
  merchantId: string;
  title: string;
  description: string;
  previewPriceCents: number;
  previewDurationMin: number;
  publishedBucket: string;
  publishedPath: string;
  publishedAt: string;
};

export type SetMerchantStyleConfigInput = {
  id: string;
  merchantId: string;
  description: string;
  discoveryFacets: StyleDiscoveryFacet[];
  items: CatalogSelection[];
  previewPriceCents: number | null;
  previewDurationMin: number | null;
  /** Optional new title (e.g. an AI-generated name); empty/omitted preserves the existing title. */
  title?: string;
};

export interface MerchantStyleRepository {
  listByMerchant(merchantId: string): Promise<MerchantStyleRecord[]>;
  listPublished(): Promise<MerchantStyleRecord[]>;
  getPublishedById(id: string): Promise<MerchantStyleRecord | null>;
  getByIdForMerchant(id: string, merchantId: string): Promise<MerchantStyleRecord | null>;
  create(record: MerchantStyleRecord): Promise<MerchantStyleRecord>;
  setConfig(input: SetMerchantStyleConfigInput): Promise<MerchantStyleRecord | null>;
  publish(input: PublishMerchantStyleInput): Promise<MerchantStyleRecord | null>;
  archive(id: string, merchantId: string, archivedAt: string): Promise<MerchantStyleRecord | null>;
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
  intervalBookings: IntervalBookingRepository;
  staffItemDurations: StaffItemDurationRepository;
  merchantStyles: MerchantStyleRepository;
}
