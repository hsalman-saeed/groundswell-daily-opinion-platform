/**
 * POST /api/admin/finalize
 *
 * Manually triggers question finalization (scoring pipeline).
 * Used in the demo to score predictions on camera.
 */
import { NextResponse } from 'next/server';
import { finalizeQuestion } from '@/lib/finalize-question';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { question_id } = body;

    if (!question_id) {
      return NextResponse.json(
        { error: 'question_id is required' },
        { status: 400 },
      );
    }

    const result = await finalizeQuestion(question_id);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Admin Finalize] Error:', message);
    return NextResponse.json(
      { error: message, success: false },
      { status: 500 },
    );
  }
}
