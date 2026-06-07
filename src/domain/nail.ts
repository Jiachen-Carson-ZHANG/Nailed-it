import type { CatalogSelection } from './catalog';

export type UserRole = 'customer' | 'merchant';

export type NailShape =
  | 'round'
  | 'square'
  | 'squoval'
  | 'oval'
  | 'almond'
  | 'coffin'
  | 'stiletto';

export type BaseServiceName = 'removal' | 'extension' | 'builderGel';

export type NailStyleName = 'solid' | 'catEye' | 'french' | 'chrome' | 'rhinestone';

export type NailAddonName = 'rhinestone' | 'charms' | 'glitter';

export type PricingCategory = 'base' | 'shape' | 'style' | 'addon';

export type QuoteValue = {
  price: number;
  duration: number;
};

export type AISuggestedQuote = QuoteValue & {
  source: 'ai_suggestion';
};

export type StylePreviewQuote = QuoteValue & {
  source: 'style_preview';
};

export type RuleBasedQuote = QuoteValue & {
  source: 'pricing_rules';
};

export type BookingQuote = QuoteValue & {
  source: 'booking_snapshot';
};

export type Technician = {
  id: string;
  merchantId: string;
  name: string;
  initials: string;
  title: string;
  active: boolean;
};

export type TechnicianSnapshot = Pick<Technician, 'id' | 'name' | 'initials'>;

export type TechnicianSlot = {
  date: string;
  label: string;
  time: string;
  technician: TechnicianSnapshot;
  /** Exact server-derived quote for this technician, including staff duration overrides. */
  quote?: BookingQuote;
  rankReason?: 'shortest_wait' | 'earliest_available';
};

export type CustomerBookingDraft = {
  estimate: RuleBasedQuote;
  imageUrl: string;
  recognition: AIRecognitionResult;
  breakdowns?: { glossary: BreakdownResult | null };
  /** Validated AI catalog selections. Price/duration are always recomputed server-side. */
  catalogSelections?: CatalogSelection[];
  /**
   * When the booking originated from a published merchant style, its id. The confirm step then books
   * the style's curated catalog breakdown (server-derived price) instead of a flat recognition estimate.
   */
  styleId?: string;
  styleTitle?: string;
};

export type StyleDiscoveryFacetKind = 'style' | 'addon' | 'shape' | 'mood' | 'lifestyle';

export type StyleDiscoveryFacet = {
  kind: StyleDiscoveryFacetKind;
  label: string;
};

export type NailStyleCard = {
  discoveryFacets: StyleDiscoveryFacet[];
  id: string;
  imageUrl: string;
  title: string;
  previewQuote: StylePreviewQuote;
  popularityScore: number;
};

export type AIRecognitionSelection = {
  baseServices: BaseServiceName[];
  nailShape: NailShape;
  styles: NailStyleName[];
  addons: NailAddonName[];
  otherNotes: string;
};

export type AIRecognitionMeta = {
  confidence: number;
  aiSuggestedQuote: AISuggestedQuote;
};

export type AIRecognitionResult = {
  selection: AIRecognitionSelection;
  meta: AIRecognitionMeta;
};

export const confidenceReviewThreshold = 0.75;

export function requiresMerchantReview(recognition: AIRecognitionResult): boolean {
  const { confidence } = recognition.meta;

  return !Number.isFinite(confidence) || confidence < confidenceReviewThreshold;
}

type PricingItemBase = {
  id: string;
  price: number;
  duration: number;
  enabled: boolean;
};

export type BasePricingItem = PricingItemBase & {
  category: 'base';
  target: BaseServiceName;
};

export type ShapePricingItem = PricingItemBase & {
  category: 'shape';
  target: NailShape;
};

export type StylePricingItem = PricingItemBase & {
  category: 'style';
  target: NailStyleName;
};

export type AddonPricingItem = PricingItemBase & {
  category: 'addon';
  target: NailAddonName;
};

export type PricingItem =
  | BasePricingItem
  | ShapePricingItem
  | StylePricingItem
  | AddonPricingItem;

export type BookingStatus = 'confirmed' | 'pending_review' | 'completed' | 'cancelled';

export type Booking = {
  id: string;
  customerName: string;
  merchantName: string;
  styleTitle: string;
  styleImageUrl: string;
  date: string;
  time: string;
  quote: BookingQuote;
  status: BookingStatus;
  technician: TechnicianSnapshot;
  conversationId?: string;
  notes: string;
  recognition: AIRecognitionResult;
};

export type Conversation = {
  id: string;
  participantName: string;
  participantRole: UserRole;
  avatarInitials: string;
  lastMessage: string;
  unreadCount: number;
  relatedBookingTime?: string;
  messages: ChatMessage[];
};

export type ChatMessage = {
  id: string;
  author: 'me' | 'them' | 'system';
  body: string;
  sentAt: string;
  attachment?: MessageAttachment;
};

export type MessageAuthorRole = UserRole | 'system';

import type { AppLanguage } from '@/i18n/types';

/** A structured payload riding on a chat message — currently only a recommended style card. */
export type MessageAttachment = {
  type: 'style';
  styleId: string;
  title: string;
  imageUrl: string;
  /** Why it was recommended, e.g. "法式风 · 裸色" (the customer's matched taste tags). */
  reason?: string;
};

export type BookingMessage = {
  id: string;
  authorRole: MessageAuthorRole;
  body: string;
  sentAt: string;
  attachment?: MessageAttachment;
};

export type BookingConversationThread = {
  id: string;
  bookingId: string;
  customerName: string;
  merchantName: string;
  relatedBookingTime: string;
  /** Customer UI language at booking time — used for later server-generated thread messages. */
  customerLanguage: AppLanguage;
  messages: BookingMessage[];
};

// ─── Trending Styles ─────────────────────────────────────────────────────────

export type TrendingSearchLink = {
  platform: string;
  url: string;
  label: string;
};

export type AITrendingStyle = {
  rank: number;
  name: string;
  nameCn: string;
  description: string;
  tags: string[];
  searchLinks: TrendingSearchLink[];
};

export type AITrendingResponse = {
  styles: AITrendingStyle[];
  generatedAt: string;
};

// ─── Component Breakdown ──────────────────────────────────────────────────────

export type GlossaryBreakdownItem = {
  mode: 'glossary';
  glossaryId: string;
  glossaryType: 'service_module' | 'procedure' | 'billable_component' | 'visual_attribute' | 'complexity_level' | 'style_tag';
  nameZh: string;
  typeZh: string;
  parentId: string;
  parentNameZh: string;
  quantity: number;
  unit: string;
  price: number;
  duration: number;
};

export type BreakdownItem = GlossaryBreakdownItem;

export type BreakdownResult = {
  items: GlossaryBreakdownItem[];
  /** Validated catalog ids + quantities used by quoteService and bookingService. */
  catalogSelections: CatalogSelection[];
  totalPrice: number;
  totalDuration: number;
  mode: 'glossary';
  /** Optional merchant upload helper generated from the same image analysis request. */
  suggestedStyleName?: {
    name: string;
    description: string;
  };
};

// ─── Virtual Try-On ───────────────────────────────────────────────────────────

export type TryOnResult = {
  imageBase64: string;
  mimeType: 'image/png' | 'image/jpeg';
};

// ─── Pricing Labels ───────────────────────────────────────────────────────────

export const pricingTargetLabels: Record<PricingItem['target'], string> = {
  removal: 'Removal',
  extension: 'Extension',
  builderGel: 'Builder gel',
  round: 'Round',
  square: 'Square',
  squoval: 'Squoval',
  oval: 'Oval',
  almond: 'Almond',
  coffin: 'Coffin',
  stiletto: 'Stiletto',
  solid: 'Solid',
  french: 'French',
  catEye: 'Cat eye',
  chrome: 'Chrome',
  rhinestone: 'Rhinestone',
  charms: 'Charms',
  glitter: 'Glitter'
};
