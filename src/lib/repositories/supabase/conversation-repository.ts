import { getServiceClient } from '@/lib/db/client';
import type {
  BookingConversationThread,
  BookingMessage,
  MessageAttachment,
  MessageAuthorRole,
} from '@/domain/nail';
import type { AppLanguage } from '@/i18n/types';
import type { ConversationRepository } from '../types';

interface ThreadRow {
  id: string;
  booking_id: string;
  customer_name: string;
  merchant_name: string;
  related_booking_time: string;
  customer_language: string;
  created_at: string;
}

interface MessageRow {
  id: string;
  thread_id: string;
  author_role: string;
  body: string;
  sent_at: string;
  attachment: MessageAttachment | null;
  created_at: string;
}

interface ThreadWithMessagesRow extends ThreadRow {
  messages: MessageRow[];
}

function rowToMessage(row: MessageRow): BookingMessage {
  return {
    id: row.id,
    authorRole: row.author_role as MessageAuthorRole,
    body: row.body,
    sentAt: row.sent_at,
    ...(row.attachment ? { attachment: row.attachment } : {}),
  };
}

function rowToThread(row: ThreadRow, messages: MessageRow[]): BookingConversationThread {
  return {
    id: row.id,
    bookingId: row.booking_id,
    customerName: row.customer_name,
    merchantName: row.merchant_name,
    relatedBookingTime: row.related_booking_time,
    customerLanguage: (row.customer_language === 'en' ? 'en' : 'zh-CN') as AppLanguage,
    messages: messages
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(rowToMessage),
  };
}

function threadToRow(thread: BookingConversationThread): Omit<ThreadRow, 'created_at'> {
  return {
    id: thread.id,
    booking_id: thread.bookingId,
    customer_name: thread.customerName,
    merchant_name: thread.merchantName,
    related_booking_time: thread.relatedBookingTime,
    customer_language: thread.customerLanguage,
  };
}

function messageToRow(
  threadId: string,
  message: BookingMessage,
  createdAt?: string,
): Omit<MessageRow, 'created_at' | 'attachment'> & {
  created_at?: string;
  attachment?: MessageAttachment;
} {
  // Only write `attachment` when present, so plain text messages don't depend on migration 0019.
  const row: Omit<MessageRow, 'created_at' | 'attachment'> & {
    created_at?: string;
    attachment?: MessageAttachment;
  } = {
    id: message.id,
    thread_id: threadId,
    author_role: message.authorRole,
    body: message.body,
    sent_at: message.sentAt,
    ...(message.attachment ? { attachment: message.attachment } : {}),
  };
  if (createdAt !== undefined) {
    row.created_at = createdAt;
  }
  return row;
}

export function createSupabaseConversationRepository(): ConversationRepository {
  return {
    async list(): Promise<BookingConversationThread[]> {
      const { data, error } = await getServiceClient()
        .from('conversation_threads')
        .select('*, messages(*)');
      if (error) {
        throw new Error(`ConversationRepository.list failed: ${error.message}`);
      }
      return (data as ThreadWithMessagesRow[]).map((row) =>
        rowToThread(row, row.messages ?? []),
      );
    },

    async getById(id: string): Promise<BookingConversationThread | null> {
      const { data, error } = await getServiceClient()
        .from('conversation_threads')
        .select('*, messages(*)')
        .eq('id', id)
        .maybeSingle();
      if (error) {
        throw new Error(`ConversationRepository.getById failed: ${error.message}`);
      }
      if (!data) return null;
      const row = data as ThreadWithMessagesRow;
      return rowToThread(row, row.messages ?? []);
    },

    async insert(thread: BookingConversationThread): Promise<BookingConversationThread> {
      const client = getServiceClient();

      const { error: threadError } = await client
        .from('conversation_threads')
        .insert(threadToRow(thread));
      if (threadError) {
        throw new Error(`ConversationRepository.insert (thread) failed: ${threadError.message}`);
      }

      if (thread.messages.length > 0) {
        const messageRows = thread.messages.map((msg) => messageToRow(thread.id, msg));
        const { error: msgError } = await client.from('messages').insert(messageRows);
        if (msgError) {
          throw new Error(`ConversationRepository.insert (messages) failed: ${msgError.message}`);
        }
      }

      const inserted = await this.getById(thread.id);
      if (!inserted) {
        throw new Error(`ConversationRepository.insert: thread ${thread.id} not found after insert`);
      }
      return inserted;
    },

    async appendMessage(
      threadId: string,
      message: BookingMessage,
    ): Promise<BookingConversationThread | null> {
      const client = getServiceClient();

      const { data: threadData, error: threadError } = await client
        .from('conversation_threads')
        .select('id')
        .eq('id', threadId)
        .maybeSingle();
      if (threadError) {
        throw new Error(`ConversationRepository.appendMessage (check thread) failed: ${threadError.message}`);
      }
      if (!threadData) return null;

      const { error: msgError } = await client
        .from('messages')
        .insert(messageToRow(threadId, message));
      if (msgError) {
        throw new Error(`ConversationRepository.appendMessage (insert) failed: ${msgError.message}`);
      }

      return this.getById(threadId);
    },
  };
}
