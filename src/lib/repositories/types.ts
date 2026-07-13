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
import type { AnalyticsEvent, Customer, NewAnalyticsEvent } from '@/domain/analytics';
import type { Agent, AgentAction, AgentActionType, AgentRunView, ActionStatus } from '@/domain/agents';
import type { GroupbuyDealRecord, GroupbuyStatus } from '@/domain/groupbuy';

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
  updateCurrency(id: string, currency: string): Promise<void>;
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

export type CompleteMerchantStyleAnalysisInput = Omit<SetMerchantStyleConfigInput, 'title'> & {
  title: string;
};

export interface MerchantStyleRepository {
  listByMerchant(merchantId: string): Promise<MerchantStyleRecord[]>;
  listPublished(): Promise<MerchantStyleRecord[]>;
  getPublishedById(id: string): Promise<MerchantStyleRecord | null>;
  getByIdForMerchant(id: string, merchantId: string): Promise<MerchantStyleRecord | null>;
  create(record: MerchantStyleRecord): Promise<MerchantStyleRecord>;
  /** Atomically claims a processing style for external AI work; false means another request owns it. */
  claimAnalysis(id: string, merchantId: string): Promise<boolean>;
  completeAnalysis(input: CompleteMerchantStyleAnalysisInput): Promise<MerchantStyleRecord | null>;
  failAnalysis(id: string, merchantId: string): Promise<MerchantStyleRecord | null>;
  setConfig(input: SetMerchantStyleConfigInput): Promise<MerchantStyleRecord | null>;
  publish(input: PublishMerchantStyleInput): Promise<MerchantStyleRecord | null>;
  archive(id: string, merchantId: string, archivedAt: string): Promise<MerchantStyleRecord | null>;
  /** Hard-delete an unpublished draft (processing / needs_review / failed). Returns false if not found
   *  or already published (published styles are archived, not deleted). */
  deleteDraft(id: string, merchantId: string): Promise<boolean>;
}

export interface AnalyticsRepository {
  /** Append one event. Capture is fire-and-forget at the call site; this still throws on a real DB
   *  error so the server action can log it. */
  record(event: NewAnalyticsEvent): Promise<void>;
  /** All events for a merchant, oldest first — the read model derives every metric from these. */
  listByMerchant(merchantId: string): Promise<AnalyticsEvent[]>;
  /** All events for one customer, oldest first — feeds the customer preference profile. */
  listByCustomer(customerId: string): Promise<AnalyticsEvent[]>;
}

export interface CustomerRepository {
  listByMerchant(merchantId: string): Promise<Customer[]>;
  /** Resolve the mock-session handle ('melissa') to its persona row. */
  getByHandle(handle: string): Promise<Customer | null>;
  getById(id: string): Promise<Customer | null>;
}

export interface AgentRepository {
  /** The agent team definitions (ADR-0007). */
  listAgents(): Promise<Agent[]>;
  /** Runs for a merchant, most recent first, each joined with its agent identity + actions. */
  listRuns(merchantId: string): Promise<AgentRunView[]>;
  getRun(id: string): Promise<AgentRunView | null>;
  /** One action for one merchant — undo must read its (entityType, entityId) before touching the entity. */
  getAction(actionId: string, merchantId: string): Promise<AgentAction | null>;
  /** Flip an action's status for one merchant, enforcing the panel's legal transitions. */
  setActionStatus(actionId: string, merchantId: string, status: ActionStatus): Promise<AgentAction | null>;
  /** Actions for a merchant (most recent first), optionally filtered by type/status. Powers the
   *  in-context surfaces (投广 / 价格config / 老板msg) that render what the agents did on the real pages. */
  listActions(
    merchantId: string,
    opts?: { types?: AgentActionType[]; statuses?: ActionStatus[] },
  ): Promise<AgentAction[]>;
}

/** Group-buy deals (ADR-0012 Phase 0a) — merchant-scoped, relational catalog items, real persistence
 *  (was browser localStorage). Status transitions are validated against action-entity-contract. */
export interface GroupbuyRepository {
  listByMerchant(merchantId: string): Promise<GroupbuyDealRecord[]>;
  getByIdForMerchant(id: string, merchantId: string): Promise<GroupbuyDealRecord | null>;
  /** Upsert a draft or published deal, replacing its items — atomically (supabase: the save_groupbuy_deal
   *  RPC, migration 0029), so a deal never persists with a partially-written item list. */
  save(record: GroupbuyDealRecord): Promise<GroupbuyDealRecord>;
  /** Move a deal along its lifecycle (draft→published→unlisted→relist); null if not found or illegal. */
  setStatus(id: string, merchantId: string, status: GroupbuyStatus): Promise<GroupbuyDealRecord | null>;
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
  analytics: AnalyticsRepository;
  customers: CustomerRepository;
  agents: AgentRepository;
  groupbuy: GroupbuyRepository;
}
