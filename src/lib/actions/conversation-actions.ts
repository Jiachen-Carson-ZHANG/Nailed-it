'use server';

import { randomUUID } from 'node:crypto';
import { toConversationForRole } from '@/domain/messaging';
import type { BookingConversationThread, Conversation, MessageAttachment, UserRole } from '@/domain/nail';
import type { AppLanguage } from '@/i18n/types';
import { getRepositories } from '@/lib/repositories';
import { demoCustomerName } from '@/mock/customers';
import { demoMerchantId } from '@/mock/merchants';

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
  attachment?: MessageAttachment,
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
    ...(attachment ? { attachment } : {}),
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

/** Customer attaches one of their saved styles to the thread as a rich style card. */
export async function sendCustomerStyleAttachmentAction(
  conversationId: string,
  input: { styleId: string; title: string; imageUrl: string; reason?: string; language?: AppLanguage },
): Promise<Conversation | null> {
  const share = input.language === 'en' ? `I'd love to try ${input.title}` : `想试试：${input.title}`;
  const body = input.reason ? `${share} · ${input.reason}` : share;
  return appendAs(conversationId, body, 'customer', isDemoCustomerThread, {
    type: 'style',
    styleId: input.styleId,
    title: input.title,
    imageUrl: input.imageUrl,
    ...(input.reason ? { reason: input.reason } : {}),
  });
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

/**
 * Merchant sends a recommended style from the customer-intelligence panel into the thread as a rich
 * style card, and logs the `recommended_style_sent` event (closes the recommend→book loop). Returns
 * the updated conversation so the chat re-renders with the card immediately.
 */
export async function sendMerchantStyleRecommendationAction(
  conversationId: string,
  input: { customerId: string; styleId: string; title: string; imageUrl: string; reason?: string },
): Promise<Conversation | null> {
  const body = input.reason ? `为你推荐：${input.title} · ${input.reason}` : `为你推荐：${input.title}`;
  const updated = await appendAs(conversationId, body, 'merchant', () => true, {
    type: 'style',
    styleId: input.styleId,
    title: input.title,
    imageUrl: input.imageUrl,
    ...(input.reason ? { reason: input.reason } : {}),
  });
  if (updated) {
    try {
      await getRepositories().analytics.record({
        eventType: 'recommended_style_sent',
        merchantId: demoMerchantId,
        customerId: input.customerId,
        styleId: input.styleId,
        eventSource: 'merchant_intel_panel',
      });
    } catch (err) {
      console.error('recommended_style_sent capture failed', { styleId: input.styleId, err });
    }
  }
  return updated;
}
