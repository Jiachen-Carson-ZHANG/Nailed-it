'use server';

import { getRepositories } from '@/lib/repositories';
import { isAnalyticsEventType, type NewAnalyticsEvent } from '@/domain/analytics';

/**
 * Record one behavioural event. Capture must never break a user flow (ADR-0006), so this swallows
 * failures after logging — the caller does not await it for correctness. This is also a public
 * server-action boundary, so an unknown event_type is rejected (defensively) rather than written.
 */
export async function trackEventAction(event: NewAnalyticsEvent): Promise<void> {
  if (!event || !isAnalyticsEventType(event.eventType)) {
    console.error('trackEventAction rejected: invalid event_type', { eventType: event?.eventType });
    return;
  }
  try {
    await getRepositories().analytics.record(event);
  } catch (err) {
    console.error('trackEventAction failed', { eventType: event.eventType, err });
  }
}
