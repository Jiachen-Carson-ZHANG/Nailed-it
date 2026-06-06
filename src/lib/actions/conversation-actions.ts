'use server';

import { randomUUID } from 'node:crypto';
import { toConversationForRole } from '@/domain/messaging';
import type { BookingConversationThread, Conversation, UserRole } from '@/domain/nail';
import { getRepositories } from '@/lib/repositories';
import { demoCustomerName } from '@/mock/customers';

// No auth yet: the customer-scoped actions hard-fix the actor to the demo customer (server-side),
// so a customer surface can only ever see/append its own threads and always speaks as 'customer'.
// The role/author is never taken from the browser. Cross-actor authorization across real accounts
// still needs the auth system.
function isDemoCustomerThread(thread: BookingConversationThread): boolean {
  return thread.customerName === demoCustomerName;
}

async function appendAs(
  conversationId: string,
  body: string,
  role: UserRole,
  canView: (thread: BookingConversationThread) => boolean,
): Promise<Conversation | null> {
  const trimmed = body.trim();
  if (!trimmed) return null;
  const repos = getRepositories();
  const existing = await repos.conversations.getById(conversationId);
  if (!existing || !canView(existing)) return null;
  const updated = await repos.conversations.appendMessage(conversationId, {
    id: `msg-${randomUUID()}`,
    authorRole: role,
    body: trimmed,
    sentAt: 'Now',
  });
  return updated ? toConversationForRole(updated, role) : null;
}

// ─── Customer-scoped (only the demo customer's threads) ──────────────────────

export async function listCustomerConversationsAction(): Promise<Conversation[]> {
  const threads = await getRepositories().conversations.list();
  return threads.filter(isDemoCustomerThread).map((t) => toConversationForRole(t, 'customer'));
}

export async function getCustomerConversationAction(conversationId: string): Promise<Conversation | null> {
  const thread = await getRepositories().conversations.getById(conversationId);
  return thread && isDemoCustomerThread(thread) ? toConversationForRole(thread, 'customer') : null;
}

export async function sendCustomerMessageAction(
  conversationId: string,
  body: string,
): Promise<Conversation | null> {
  return appendAs(conversationId, body, 'customer', isDemoCustomerThread);
}

// ─── Merchant-scoped (the whole shop inbox) ──────────────────────────────────

export async function listMerchantConversationsAction(): Promise<Conversation[]> {
  const threads = await getRepositories().conversations.list();
  return threads.map((t) => toConversationForRole(t, 'merchant'));
}

export async function getMerchantConversationAction(conversationId: string): Promise<Conversation | null> {
  const thread = await getRepositories().conversations.getById(conversationId);
  return thread ? toConversationForRole(thread, 'merchant') : null;
}

export async function sendMerchantMessageAction(
  conversationId: string,
  body: string,
): Promise<Conversation | null> {
  return appendAs(conversationId, body, 'merchant', () => true);
}
