import type { CustomerBookingDraft } from './nail';
import { getBrowserStorage } from '@/lib/browser-storage';

// The customer booking draft carries the recognition + estimate + (possibly base64) image
// between the booking and confirm pages. It lives in sessionStorage rather than module
// memory: a module-level `let` is shared across all requests on a serverless instance and
// lost on reload, whereas sessionStorage is per-tab, per-user, and survives a refresh.
// JSON round-tripping also gives clone isolation for free.

const DRAFT_KEY = 'nailed-it.customer-booking-draft.v1';

export type CustomerBookingDraftSnapshot = {
  draft: CustomerBookingDraft;
  version: number;
};

function readSnapshot(): CustomerBookingDraftSnapshot | null {
  const storage = getBrowserStorage('session');
  if (!storage) {
    return null;
  }
  const raw = storage.getItem(DRAFT_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<CustomerBookingDraftSnapshot>;
    if (!parsed || typeof parsed.version !== 'number' || !parsed.draft) {
      storage.removeItem(DRAFT_KEY);
      return null;
    }
    return { draft: parsed.draft, version: parsed.version };
  } catch {
    storage.removeItem(DRAFT_KEY);
    return null;
  }
}

export function saveCustomerBookingDraft(draft: CustomerBookingDraft): CustomerBookingDraft {
  const previous = readSnapshot();
  const snapshot: CustomerBookingDraftSnapshot = {
    draft,
    version: (previous?.version ?? 0) + 1
  };
  const storage = getBrowserStorage('session');
  if (storage) {
    try {
      storage.setItem(DRAFT_KEY, JSON.stringify(snapshot));
    } catch {
      // storage unavailable/full — the draft simply won't persist
    }
  }
  return structuredClone(draft);
}

export function getCustomerBookingDraft(): CustomerBookingDraft | null {
  return readSnapshot()?.draft ?? null;
}

export function readCustomerBookingDraftSnapshot(): CustomerBookingDraftSnapshot | null {
  return readSnapshot();
}

export function consumeCustomerBookingDraft(version?: number): CustomerBookingDraft | null {
  const snapshot = readSnapshot();
  if (!snapshot) {
    return null;
  }
  if (typeof version === 'number' && version !== snapshot.version) {
    return null;
  }
  getBrowserStorage('session')?.removeItem(DRAFT_KEY);
  return snapshot.draft;
}

export function clearCustomerBookingDraft(): void {
  getBrowserStorage('session')?.removeItem(DRAFT_KEY);
}

