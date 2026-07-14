import { NextResponse } from 'next/server';
import { CollageGenError, runCollageGen, type CollageIngredient } from '@/nail-ai/collage-nail-gen';

export async function POST(request: Request) {
  try {
    const body = parseRequestBody(await request.json());
    const mode = body.changedCategories.length > 0
      ? { kind: 'regen' as const, changedCategories: body.changedCategories }
      : { kind: 'initial' as const };
    const referenceImage = body.referenceImageBase64
      ? { base64: body.referenceImageBase64, mimeType: body.referenceMimeType }
      : undefined;
    const result = await runCollageGen(body.ingredients, body.customText, { referenceImage, mode });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CollageGenError) {
      const status = error.code === 'missing_config' ? 500 : 502;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid collage generate request.', code: 'invalid_request' },
      { status: 400 },
    );
  }
}

type CollageGenRequest = {
  ingredients: CollageIngredient[];
  customText: string;
  // Optional: present only for partial regeneration (image-to-image).
  referenceImageBase64: string | null;
  referenceMimeType: string;
  changedCategories: string[];
};

function parseRequestBody(value: unknown): CollageGenRequest {
  const body = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  const rawIngredients = Array.isArray(body.ingredients) ? body.ingredients : [];
  const ingredients: CollageIngredient[] = rawIngredients
    .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
    .map((i) => ({
      category: typeof i.category === 'string' ? i.category.slice(0, 40) : 'custom',
      label:    typeof i.label    === 'string' ? i.label.slice(0, 40)    : '',
    }))
    .filter((i) => i.label);

  if (ingredients.length === 0) {
    throw new Error('ingredients must be a non-empty array.');
  }

  const customText = typeof body.customText === 'string' ? body.customText.trim().slice(0, 200) : '';

  // Reference image for partial regeneration (raw base64, no data: prefix). Guard against
  // absurd payloads so a malformed request can't exhaust memory.
  const referenceImageBase64 =
    typeof body.referenceImageBase64 === 'string' && body.referenceImageBase64.length > 0
      ? body.referenceImageBase64.slice(0, 20_000_000)
      : null;
  const referenceMimeType =
    typeof body.referenceMimeType === 'string' && body.referenceMimeType.startsWith('image/')
      ? body.referenceMimeType
      : 'image/png';

  const changedCategories = Array.isArray(body.changedCategories)
    ? body.changedCategories.filter((c): c is string => typeof c === 'string').map((c) => c.slice(0, 40))
    : [];

  return { ingredients, customText, referenceImageBase64, referenceMimeType, changedCategories };
}
