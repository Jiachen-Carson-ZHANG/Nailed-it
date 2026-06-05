'use server';

import { randomUUID } from 'node:crypto';
import { toConversationForRole } from '@/domain/messaging';
import type { BookingConversationThread, Conversation, MessageAuthorRole, UserRole } from '@/domain/nail';
import { getRepositories } from '@/lib/repositories';
import { demoCustomerName } from '@/mock/operations-store';

// Customers only see their own threads; the merchant sees the whole shop inbox.
function canRoleViewThread(thread: BookingConversationThread, role: UserRole): boolean {
  return role === 'merchant' || thread.customerName === demoCustomerName;
}

export async function listConversationsForRoleAction(role: UserRole): Promise<Conversation[]> {
  const threads = await getRepositories().conversations.list();
  return threads
    .filter((thread) => canRoleViewThread(thread, role))
    .map((thread) => toConversationForRole(thread, role));
}

export async function getConversationForRoleAction(
  conversationId: string,
  role: UserRole,
): Promise<Conversation | null> {
  const thread = await getRepositories().conversations.getById(conversationId);
  return thread && canRoleViewThread(thread, role) ? toConversationForRole(thread, role) : null;
}

export async function sendMessageAction(input: {
  conversationId: string;
  authorRole: MessageAuthorRole;
  role: UserRole;
  body: string;
}): Promise<Conversation | null> {
  const body = input.body.trim();
  if (!body) return null;
  const updated = await getRepositories().conversations.appendMessage(input.conversationId, {
    id: `msg-${randomUUID()}`,
    authorRole: input.authorRole,
    body,
    sentAt: 'Now',
  });
  return updated ? toConversationForRole(updated, input.role) : null;
}
