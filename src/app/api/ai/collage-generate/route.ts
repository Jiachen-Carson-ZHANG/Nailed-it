import { NextResponse } from 'next/server';
import { CollageGenError, runCollageGen, type CollageIngredient } from '@/nail-ai/collage-nail-gen';

export async function POST(request: Request) {
  try {
    const body = parseRequestBody(await request.json());
    const result = await runCollageGen(body.ingredients, body.customText);
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

  return { ingredients, customText };
}
