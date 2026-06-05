import { NextResponse } from 'next/server';
import { TrendingStylesError, fetchAITrendingStyles } from '@/nail-ai/trending-styles';

export async function GET() {
  try {
    const result = await fetchAITrendingStyles(process.env);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TrendingStylesError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === 'missing_config' ? 500 : 502 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch trending styles.' },
      { status: 500 }
    );
  }
}
