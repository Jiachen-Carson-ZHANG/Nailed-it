import { describe, expect, it, vi } from 'vitest';
import {
  normalizeGeminiNailRecognition,
  recognizeNailImageWithTelemetry,
  defaultVisionModel,
  NailRecognitionError
} from './nail-recognition';

describe('normalizeGeminiNailRecognition', () => {
  it('keeps only supported nail attributes and leaves pricing to the app', () => {
    const result = normalizeGeminiNailRecognition({
      baseServices: ['extension', 'builderGel', 'unknown-service'],
      nailShape: 'almond',
      styles: ['catEye', 'unknown-style'],
      addons: ['rhinestone', 'unknown-addon'],
      otherNotes: 'Pink cat-eye design with small rhinestones.',
      confidence: 0.82,
      price: 999,
      duration: 999
    });

    expect(result).toEqual({
      selection: {
        baseServices: ['extension', 'builderGel'],
        nailShape: 'almond',
        styles: ['catEye'],
        addons: ['rhinestone'],
        otherNotes: 'Pink cat-eye design with small rhinestones.'
      },
      meta: {
        confidence: 0.82,
        aiSuggestedQuote: {
          source: 'ai_suggestion',
          price: 0,
          duration: 0
        }
      }
    });
  });

  it('clamps malformed confidence values before app logic uses them', () => {
    expect(normalizeGeminiNailRecognition({ confidence: Number.NaN }).meta.confidence).toBe(0.5);
    expect(normalizeGeminiNailRecognition({ confidence: -1 }).meta.confidence).toBe(0);
    expect(normalizeGeminiNailRecognition({ confidence: 2 }).meta.confidence).toBe(1);
  });
});

describe('recognizeNailImageWithTelemetry', () => {
  it('calls OpenRouter with image data URL and returns normalized recognition', async () => {
    const recognitionPayload = {
      baseServices: ['extension'],
      nailShape: 'oval',
      styles: ['french'],
      addons: [],
      otherNotes: 'Thin white French tip.',
      confidence: 0.91
    };

    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify(recognitionPayload)
            }
          }
        ]
      })
    }));

    const result = await recognizeNailImageWithTelemetry(
      { imageBase64: 'abc123', mimeType: 'image/jpeg' },
      { OPENROUTER_API_KEY: 'test-or-key' },
      fetchImpl
    );

    expect(result.recognition.selection).toMatchObject({
      baseServices: ['extension'],
      nailShape: 'oval',
      styles: ['french']
    });
    expect(result.telemetry).toMatchObject({
      provider: 'openrouter',
      model: defaultVisionModel
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url, request] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect((request?.headers as Record<string, string>)?.Authorization).toBe('Bearer test-or-key');

    const body = JSON.parse(String(request?.body));
    expect(body.model).toBe(defaultVisionModel);
    expect(body.messages[0].content[0]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/jpeg;base64,abc123' }
    });
  });

  it('raises missing_vision_config when OPENROUTER_API_KEY is absent', async () => {
    await expect(
      recognizeNailImageWithTelemetry({ imageBase64: 'abc', mimeType: 'image/jpeg' }, {})
    ).rejects.toMatchObject({ code: 'missing_vision_config' } satisfies Partial<NailRecognitionError>);
  });

  it('raises invalid_model_output when response is malformed JSON', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{not valid json' } }]
      })
    }));

    await expect(
      recognizeNailImageWithTelemetry(
        { imageBase64: 'abc123', mimeType: 'image/jpeg' },
        { OPENROUTER_API_KEY: 'test-or-key' },
        fetchImpl
      )
    ).rejects.toMatchObject({ code: 'invalid_model_output' } satisfies Partial<NailRecognitionError>);
  });
});
