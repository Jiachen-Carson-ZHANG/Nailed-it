import type { CustomerBookingDraft } from './nail';

let currentCustomerBookingDraft: CustomerBookingDraft | null = null;
let currentCustomerBookingDraftVersion = 0;

export type CustomerBookingDraftSnapshot = {
  draft: CustomerBookingDraft;
  version: number;
};

function cloneCustomerBookingDraft(draft: CustomerBookingDraft): CustomerBookingDraft {
  return structuredClone(draft);
}

export function saveCustomerBookingDraft(draft: CustomerBookingDraft): CustomerBookingDraft {
  currentCustomerBookingDraft = cloneCustomerBookingDraft(draft);
  currentCustomerBookingDraftVersion += 1;

  return cloneCustomerBookingDraft(currentCustomerBookingDraft);
}

export function getCustomerBookingDraft(): CustomerBookingDraft | null {
  return currentCustomerBookingDraft ? cloneCustomerBookingDraft(currentCustomerBookingDraft) : null;
}

export function readCustomerBookingDraftSnapshot(): CustomerBookingDraftSnapshot | null {
  if (!currentCustomerBookingDraft) {
    return null;
  }

  return {
    draft: cloneCustomerBookingDraft(currentCustomerBookingDraft),
    version: currentCustomerBookingDraftVersion
  };
}

export function consumeCustomerBookingDraft(version?: number): CustomerBookingDraft | null {
  if (!currentCustomerBookingDraft) {
    return null;
  }

  if (typeof version === 'number' && version !== currentCustomerBookingDraftVersion) {
    return null;
  }

  const consumedDraft = cloneCustomerBookingDraft(currentCustomerBookingDraft);
  currentCustomerBookingDraft = null;

  return consumedDraft;
}

export function clearCustomerBookingDraft() {
  currentCustomerBookingDraft = null;
}
