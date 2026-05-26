import { describe, expect, it, vi } from 'vitest';
import {
  createGeminiNailRecognitionProvider,
  normalizeGeminiNailRecognition,
  defaultGeminiVisionModel,
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

describe('createGeminiNailRecognitionProvider', () => {
  it('calls Gemini with inline image data and structured output config', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    baseServices: ['extension'],
                    nailShape: 'oval',
                    styles: ['french'],
                    addons: [],
                    otherNotes: 'Thin white French tip.',
                    confidence: 0.91
                  })
                }
              ]
            }
          }
        ],
        usageMetadata: {
          promptTokenCount: 1_200,
          candidatesTokenCount: 80,
          thoughtsTokenCount: 10,
          totalTokenCount: 1_290
        }
      })
    }));

    const provider = createGeminiNailRecognitionProvider({
      apiKey: 'gemini-test-key',
      fetchImpl
    });

    const result = await provider({
      imageBase64: 'abc123',
      mimeType: 'image/jpeg'
    });

    expect(result.recognition.selection).toMatchObject({
      baseServices: ['extension'],
      nailShape: 'oval',
      styles: ['french']
    });
    expect(result.telemetry).toMatchObject({
      provider: 'gemini',
      model: defaultGeminiVisionModel,
      usage: {
        promptTokenCount: 1_200,
        candidatesTokenCount: 80,
        thoughtsTokenCount: 10,
        totalTokenCount: 1_290
      }
    });
    expect(result.telemetry.costEstimate?.totalUsd).toBeCloseTo(0.000156);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url, request] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      `https://generativelanguage.googleapis.com/v1beta/models/${defaultGeminiVisionModel}:generateContent`
    );
    expect(request?.headers).toMatchObject({
      'Content-Type': 'application/json',
      'x-goog-api-key': 'gemini-test-key'
    });

    const body = JSON.parse(String(request?.body));
    expect(body.contents[0].parts[0]).toEqual({
      inline_data: {
        mime_type: 'image/jpeg',
        data: 'abc123'
      }
    });
    expect(body.generationConfig).toMatchObject({
      responseMimeType: 'application/json'
    });
  });

  it('raises an invalid output error when Gemini returns malformed JSON text', async () => {
    const provider = createGeminiNailRecognitionProvider({
      apiKey: 'gemini-test-key',
      fetchImpl: vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '{not valid json'
                  }
                ]
              }
            }
          ]
        })
      }))
    });

    await expect(
      provider({
        imageBase64: 'abc123',
        mimeType: 'image/jpeg'
      })
    ).rejects.toMatchObject({
      code: 'invalid_model_output'
    } satisfies Partial<NailRecognitionError>);
  });
});
