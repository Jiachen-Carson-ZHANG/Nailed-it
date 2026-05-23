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

export type RuleBasedQuote = QuoteValue & {
  source: 'pricing_rules';
};

export type BookingQuote = QuoteValue & {
  source: 'booking_snapshot';
};

export type NailStyleCard = {
  id: string;
  imageUrl: string;
  title: string;
  tags: string[];
  previewQuote: QuoteValue;
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
  aiSuggestedQuote: QuoteValue;
};

export type AIRecognitionResult = {
  selection: AIRecognitionSelection;
  meta: AIRecognitionMeta;
};

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

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

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
};
