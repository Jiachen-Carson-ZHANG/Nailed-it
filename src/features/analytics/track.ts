'use client';

import { trackEventAction } from '@/lib/actions/analytics-actions';
import type { AnalyticsEventType, NewAnalyticsEvent } from '@/domain/analytics';
import { demoMerchantId } from '@/mock/merchants';

const SESSION_KEY = 'nailed-it:analytics-session';

/** A stable per-tab id so events from one visit group together (used for funnel/session reads). */
function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  try {
    let id = window.sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = window.crypto?.randomUUID?.() ?? `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    // private mode / storage disabled — degrade to an ephemeral id, never throw
    return `sess-${Date.now()}`;
  }
}

export type TrackInput = Partial<Omit<NewAnalyticsEvent, 'eventType'>>;

/**
 * Fire-and-forget behavioural event from a client surface. Defaults `merchantId` + `sessionId`;
 * customer surfaces pass `customerId: demoCustomerId`. Never throws and is never awaited — analytics
 * must not block or break the UI (ADR-0006).
 */
export function track(eventType: AnalyticsEventType, input: TrackInput = {}): void {
  try {
    void trackEventAction({
      merchantId: demoMerchantId,
      sessionId: getSessionId(),
      ...input,
      eventType,
    }).catch(() => {
      // server action already logs; swallow the client-side rejection
    });
  } catch {
    // ignore — analytics must never break the flow
  }
}
