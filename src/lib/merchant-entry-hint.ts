'use client';

import { getBrowserStorage } from '@/lib/browser-storage';

export const merchantEntryHintPendingKey = 'merchant-entry-hint-pending';
export const merchantEntryHintSeenKey = 'merchant-entry-hint-seen';

export function queueMerchantEntryHint() {
  const storage = getBrowserStorage('local');

  if (!storage) {
    return;
  }

  try {
    if (storage.getItem(merchantEntryHintSeenKey) === 'true') {
      return;
    }

    storage.setItem(merchantEntryHintPendingKey, 'true');
  } catch {
    // Ignore storage failures so the merchant entry keeps working.
  }
}

export function consumeMerchantEntryHint() {
  const storage = getBrowserStorage('local');

  if (!storage) {
    return false;
  }

  try {
    const pending = storage.getItem(merchantEntryHintPendingKey) === 'true';
    storage.removeItem(merchantEntryHintPendingKey);

    if (!pending || storage.getItem(merchantEntryHintSeenKey) === 'true') {
      return false;
    }

    storage.setItem(merchantEntryHintSeenKey, 'true');
    return true;
  } catch {
    return false;
  }
}
