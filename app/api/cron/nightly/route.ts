/**
 * GET /api/cron/nightly
 *
 * Vercel Cron Job — runs at midnight UTC daily.
 * Finds yesterday's unfinalized question and scores it.
 *
 * Protected by CRON_SECRET header verification.
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db/dsql';
import { finalizeQuestion } from '@/lib/finalize-question';

export async function GET(request: Request) {
  try {
    // Verify CRON_SECRET
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 },
        );
      }
    }

    // Find yesterday's unfinalized question
    const result = await query(
      `SELECT question_id FROM questions 
       WHERE release_date = CURRENT_DATE - 1 
       AND is_finalized = false`
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unfinalized question found for yesterday',
        finalized: false,
      });
    }

    const questionId = result.rows[0].question_id;
    console.log(`[Cron Nightly] Finalizing yesterday's question: ${questionId}`);

    const finalizeResult = await finalizeQuestion(questionId);

    return NextResponse.json({
      success: true,
      finalized: true,
      ...finalizeResult,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Cron Nightly] Error:', message);
    return NextResponse.json(
      { error: message, success: false },
      { status: 500 },
    );
  }
}
