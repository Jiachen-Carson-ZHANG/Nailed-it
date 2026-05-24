import type {
  AIRecognitionResult,
  AIRecognitionSelection,
  AISuggestedQuote,
  BaseServiceName,
  NailAddonName,
  NailShape,
  NailStyleName
} from '@/domain/nail';

type MockRecognitionInput = {
  addons?: NailAddonName[];
  aiSuggestedQuote: AISuggestedQuote;
  baseServices?: BaseServiceName[];
  confidence: number;
  nailShape: NailShape;
  otherNotes: string;
  styles: NailStyleName[];
};

function createMockRecognitionResult({
  addons = [],
  aiSuggestedQuote,
  baseServices = [],
  confidence,
  nailShape,
  otherNotes,
  styles
}: MockRecognitionInput): AIRecognitionResult {
  const selection: AIRecognitionSelection = {
    baseServices,
    nailShape,
    styles,
    addons,
    otherNotes
  };

  return {
    selection,
    meta: {
      confidence,
      aiSuggestedQuote
    }
  };
}

export const mockAIResult = createMockRecognitionResult({
  baseServices: ['extension', 'builderGel'],
  nailShape: 'almond',
  styles: ['catEye'],
  addons: ['rhinestone'],
  otherNotes: 'Pink cat-eye finish with a soft reflective line and light rhinestone placement.',
  confidence: 0.86,
  aiSuggestedQuote: {
    source: 'ai_suggestion',
    price: 100,
    duration: 140
  }
});

export const softFrenchAIResult = createMockRecognitionResult({
  nailShape: 'oval',
  styles: ['french'],
  otherNotes: 'Natural short length with a thin clean smile line.',
  confidence: 0.81,
  aiSuggestedQuote: {
    source: 'ai_suggestion',
    price: 45,
    duration: 60
  }
});

export const chromeMirrorAIResult = createMockRecognitionResult({
  baseServices: ['builderGel'],
  nailShape: 'almond',
  styles: ['chrome'],
  addons: ['glitter'],
  otherNotes: 'Mirror chrome reflection with a fine glitter fade near the cuticle.',
  confidence: 0.88,
  aiSuggestedQuote: {
    source: 'ai_suggestion',
    price: 72,
    duration: 95
  }
});

export const dailySolidAIResult = createMockRecognitionResult({
  nailShape: 'round',
  styles: ['solid'],
  otherNotes: 'Simple sheer pink overlay for an everyday clean finish.',
  confidence: 0.79,
  aiSuggestedQuote: {
    source: 'ai_suggestion',
    price: 32,
    duration: 42
  }
});
