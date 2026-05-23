import type { CustomerBookingDraft } from './nail';

let currentCustomerBookingDraft: CustomerBookingDraft | null = null;

export function saveCustomerBookingDraft(draft: CustomerBookingDraft): CustomerBookingDraft {
  currentCustomerBookingDraft = draft;

  return currentCustomerBookingDraft;
}

export function getCustomerBookingDraft(): CustomerBookingDraft | null {
  return currentCustomerBookingDraft;
}

export function clearCustomerBookingDraft() {
  currentCustomerBookingDraft = null;
}
