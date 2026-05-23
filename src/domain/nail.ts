export type UserRole = 'customer' | 'merchant';

export type NailShape =
  | 'round'
  | 'square'
  | 'squoval'
  | 'oval'
  | 'almond'
  | 'coffin'
  | 'stiletto';

export type PricingCategory = 'base' | 'shape' | 'style' | 'addon';

export type NailStyleCard = {
  id: string;
  imageUrl: string;
  title: string;
  tags: string[];
  estimatedPrice: number;
  estimatedDuration: number;
  popularityScore: number;
};

export type AIRecognitionResult = {
  removal: boolean;
  extension: boolean;
  builderGel: boolean;
  nailShape: NailShape;
  styles: string[];
  otherNotes: string;
  confidence: number;
  estimatedPrice: number;
  estimatedDuration: number;
};

export type PricingItem = {
  id: string;
  category: PricingCategory;
  name: string;
  price: number;
  duration: number;
  enabled: boolean;
};

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
  price: number;
  duration: number;
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
