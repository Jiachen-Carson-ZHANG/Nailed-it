import type {
  Booking,
  BookingConversationThread,
  BookingMessage,
  PricingItem,
  Technician,
} from '@/domain/nail';
import type { StyleDefinition } from '@/mock/styles';

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

export interface RepositoryBundle {
  bookings: BookingRepository;
  conversations: ConversationRepository;
  pricing: PricingRepository;
  technicians: TechnicianRepository;
  styles: StyleRepository;
}
