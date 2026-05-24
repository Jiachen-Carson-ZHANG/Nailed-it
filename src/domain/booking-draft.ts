import type { CustomerBookingDraft } from './nail';

let currentCustomerBookingDraft: CustomerBookingDraft | null = null;
let currentCustomerBookingDraftVersion = 0;

export type CustomerBookingDraftSnapshot = {
  draft: CustomerBookingDraft;
  version: number;
};

function cloneCustomerBookingDraft(draft: CustomerBookingDraft): CustomerBookingDraft {
  return {
    estimate: {
      ...draft.estimate
    },
    imageUrl: draft.imageUrl,
    recognition: {
      meta: {
        confidence: draft.recognition.meta.confidence,
        aiSuggestedQuote: {
          ...draft.recognition.meta.aiSuggestedQuote
        }
      },
      selection: {
        baseServices: [...draft.recognition.selection.baseServices],
        nailShape: draft.recognition.selection.nailShape,
        styles: [...draft.recognition.selection.styles],
        addons: [...draft.recognition.selection.addons],
        otherNotes: draft.recognition.selection.otherNotes
      }
    }
  };
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
