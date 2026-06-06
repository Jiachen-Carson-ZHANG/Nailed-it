import type { BookingConversationThread, BookingMessage } from '@/domain/nail';
import { seedConversationThreads } from '@/mock/conversations';
import type { ConversationRepository } from '../types';

export function createMemoryConversationRepository(
  seed: BookingConversationThread[] = seedConversationThreads,
): ConversationRepository {
  let state: BookingConversationThread[] = structuredClone(seed);

  return {
    async list(): Promise<BookingConversationThread[]> {
      return structuredClone(state);
    },

    async getById(id: string): Promise<BookingConversationThread | null> {
      const found = state.find((t) => t.id === id);
      return found ? structuredClone(found) : null;
    },

    async insert(
      thread: BookingConversationThread,
    ): Promise<BookingConversationThread> {
      const clone = structuredClone(thread);
      state = [...state, clone];
      return structuredClone(clone);
    },

    async appendMessage(
      threadId: string,
      message: BookingMessage,
    ): Promise<BookingConversationThread | null> {
      const index = state.findIndex((t) => t.id === threadId);
      if (index === -1) return null;
      const msgClone = structuredClone(message);
      state = state.map((t, i) =>
        i === index ? { ...t, messages: [...t.messages, msgClone] } : t,
      );
      return structuredClone(state[index]);
    },
  };
}
