// Recognition → catalog bridge — see ADR-0005 (P6). The recognizer emits constrained
// catalog_item ids + confidence (only ai_detectable items); this module validates them and
// splits them into a `detected` set (ready to quote) and an `uncertain` set the user must
// confirm. There is deliberately NO fuzzy visual-attribute→billable mapping table — the model
// names catalog ids directly, and this layer only validates + buckets them.

import type { CatalogItem, CatalogSelection } from './catalog';

/** One catalog id the recognizer reported, with its confidence and a quantity (default 1). */
export type RecognizedCatalogItem = {
  catalogItemId: string;
  confidence: number;
  quantity: number;
};

export type CatalogRecognition = {
  detected: RecognizedCatalogItem[];
  uncertain: RecognizedCatalogItem[];
};

export const recognitionConfidenceThreshold = 0.6;

/** The catalog subset the recognizer is allowed to emit (everything except aiDetectable='no'). */
export function aiDetectableCatalogItems(catalog: CatalogItem[]): CatalogItem[] {
  return catalog.filter((item) => item.aiDetectable !== 'no');
}

// LLM/JSON output is untrusted: a confidence could be a string or ±Infinity, a quantity could be
// a string or fraction. Normalize defensively so a malformed value can never read as confident
// or produce a non-integer quantity.
function normalizeConfidence(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeQuantity(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 1;
}

/**
 * Split raw recognizer output into detected vs uncertain.
 * - ids that are unknown or aiDetectable='no' are dropped (the model must not name them).
 * - aiDetectable 'weak' or 'user_confirmed' always route to uncertain (the user confirms).
 * - otherwise, below-threshold confidence routes to uncertain. Non-finite confidence is treated
 *   as uncertain (fail closed).
 */
export function bucketRecognition(
  rawItems: RecognizedCatalogItem[],
  catalog: CatalogItem[],
  threshold: number = recognitionConfidenceThreshold,
): CatalogRecognition {
  const byId = new Map(catalog.map((item) => [item.id, item]));
  const detected: RecognizedCatalogItem[] = [];
  const uncertain: RecognizedCatalogItem[] = [];

  for (const raw of rawItems) {
    const item = byId.get(raw.catalogItemId);
    if (!item || item.aiDetectable === 'no') continue;

    const normalized: RecognizedCatalogItem = {
      catalogItemId: raw.catalogItemId,
      confidence: normalizeConfidence(raw.confidence),
      quantity: normalizeQuantity(raw.quantity),
    };
    const mustConfirm = item.aiDetectable === 'weak' || item.aiDetectable === 'user_confirmed';
    // normalized.confidence is now a finite number, so Infinity/NaN/strings land below threshold.
    if (mustConfirm || normalized.confidence < threshold) {
      uncertain.push(normalized);
    } else {
      detected.push(normalized);
    }
  }

  return { detected, uncertain };
}

/**
 * Turn a recognition into catalog selections for quoteService: every detected item plus the
 * uncertain items the user explicitly confirmed. Quantities for the same id are merged.
 */
export function toCatalogSelections(
  recognition: CatalogRecognition,
  confirmedUncertainIds: string[] = [],
): CatalogSelection[] {
  const confirmed = new Set(confirmedUncertainIds);
  const chosen = [
    ...recognition.detected,
    ...recognition.uncertain.filter((item) => confirmed.has(item.catalogItemId)),
  ];

  const quantityById = new Map<string, number>();
  for (const item of chosen) {
    quantityById.set(item.catalogItemId, (quantityById.get(item.catalogItemId) ?? 0) + item.quantity);
  }

  return [...quantityById.entries()].map(([catalogItemId, quantity]) => ({ catalogItemId, quantity }));
}
