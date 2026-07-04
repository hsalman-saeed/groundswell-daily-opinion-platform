/**
 * GET /api/cron/nightly
 *
 * Vercel Cron Job — runs at midnight UTC daily.
 *
 * 1. Finalizes ALL past unfinalized questions (not just yesterday)
 * 2. Auto-generates tomorrow's question via Bedrock if admin hasn't
 *    already scheduled one
 *
 * Protected by CRON_SECRET header verification.
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db/dsql';
import { finalizeQuestion } from '@/lib/finalize-question';
import { ensureQuestionForDate } from '@/lib/auto-generate';

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

    const results: any[] = [];

    // =====================================================================
    // Step 1: Finalize ALL past unfinalized questions
    // =====================================================================
    const unfinalizedResult = await query(
      `SELECT question_id, release_date FROM questions 
       WHERE release_date < CURRENT_DATE 
       AND is_finalized = false`
    );

    if (unfinalizedResult.rows.length === 0) {
      results.push({ step: 'finalize', message: 'No unfinalized past questions found' });
    } else {
      for (const row of unfinalizedResult.rows) {
        try {
          console.log(`[Cron Nightly] Finalizing question: ${row.question_id} (${row.release_date})`);
          const finalizeResult = await finalizeQuestion(row.question_id);
          results.push({
            step: 'finalize',
            question_id: row.question_id,
            success: true,
            ...finalizeResult,
          });
        } catch (err: any) {
          console.error(`[Cron Nightly] Failed to finalize ${row.question_id}:`, err?.message);
          results.push({
            step: 'finalize',
            question_id: row.question_id,
            success: false,
            error: err?.message,
          });
        }
      }
    }

    // =====================================================================
    // Step 2: Ensure tomorrow has a question (auto-generate if needed)
    // =====================================================================
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    try {
      const tomorrowQuestion = await ensureQuestionForDate(tomorrowStr);
      results.push({
        step: 'auto_generate_tomorrow',
        date: tomorrowStr,
        success: !!tomorrowQuestion,
        question_id: tomorrowQuestion?.question_id || null,
        question_text: tomorrowQuestion?.question_text?.slice(0, 80) || null,
      });
    } catch (err: any) {
      console.error('[Cron Nightly] Failed to generate tomorrow question:', err?.message);
      results.push({
        step: 'auto_generate_tomorrow',
        date: tomorrowStr,
        success: false,
        error: err?.message,
      });
    }

    return NextResponse.json({
      success: true,
      results,
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
