/**
 * GET /api/admin/questions
 *
 * Returns the last 8 questions with their stats from Aurora DSQL
 * for the admin panel schedule view.
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db/dsql';

export async function GET() {
  try {
    const result = await query(
      `SELECT question_id, question_text, category, 
              release_date, is_active, is_finalized, 
              total_participants, global_yes_pct, global_no_pct, 
              divergence_score, bedrock_predicted_divergence
       FROM questions 
       ORDER BY release_date DESC 
       LIMIT 8`
    );

    return NextResponse.json({
      success: true,
      questions: result.rows,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Admin Questions] Error:', message);
    return NextResponse.json(
      { error: message, success: false },
      { status: 500 },
    );
  }
}
