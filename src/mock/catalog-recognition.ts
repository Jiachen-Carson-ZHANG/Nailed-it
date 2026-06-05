import type { RecognizedCatalogItem } from '@/domain/recognition-catalog';

// Deterministic sample of what the catalog recognizer emits (real catalog ids + confidence),
// used by tests and as the no-key demo stand-in until the live LLM is wired to emit ids.
// builder_service is aiDetectable='weak' and removal_service is 'user_confirmed', so both land
// in the `uncertain` bucket regardless of confidence.
export const mockRecognizedCatalogItems: RecognizedCatalogItem[] = [
  { catalogItemId: 'extension_service', confidence: 0.95, quantity: 1 },
  { catalogItemId: 'color_effect_service', confidence: 0.88, quantity: 1 },
  { catalogItemId: 'art_service', confidence: 0.82, quantity: 1 },
  { catalogItemId: 'builder_service', confidence: 0.9, quantity: 1 },
  { catalogItemId: 'removal_service', confidence: 0.7, quantity: 1 },
];
