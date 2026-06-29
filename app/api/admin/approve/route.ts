/**
 * POST /api/admin/approve
 *
 * Approves a Bedrock-generated question candidate and schedules it
 * for a given date. Creates DynamoDB counter records for the question.
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db/dsql';
import { initializeCountersForQuestion } from '@/lib/db/dynamo';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      question_text,
      category,
      predicted_divergence_score,
      schedule_date,
    } = body;

    if (!question_text || !category) {
      return NextResponse.json(
        { error: 'question_text and category are required' },
        { status: 400 },
      );
    }

    // Default schedule_date to tomorrow if not provided
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const targetDate = schedule_date || tomorrow.toISOString().split('T')[0];

    // Validate date is not in the past
    const today = new Date().toISOString().split('T')[0];
    if (targetDate < today) {
      return NextResponse.json(
        { error: 'Cannot schedule a question in the past' },
        { status: 400 },
      );
    }

    // Check that the date is not already taken
    try {
      const existing = await query(
        `SELECT question_id FROM questions WHERE release_date = $1`,
        [targetDate],
      );
      if (existing.rows.length > 0) {
        return NextResponse.json(
          { error: `A question is already scheduled for ${targetDate}` },
          { status: 409 },
        );
      }
    } catch (err) {
      console.error('[Admin Approve] Date check failed:', err);
      // Continue — non-fatal; the UNIQUE constraint will catch it
    }

    // Insert into Aurora DSQL
    const result = await query(
      `INSERT INTO questions 
       (question_text, category, release_date, ai_generated, 
        bedrock_predicted_divergence, is_active, is_finalized)
       VALUES ($1, $2, $3, true, $4, true, false)
       RETURNING question_id, question_text, category, release_date, 
                 ai_generated, bedrock_predicted_divergence, is_active, is_finalized`,
      [
        question_text,
        category,
        targetDate,
        predicted_divergence_score || null,
      ],
    );

    const savedQuestion = result.rows[0];

    // Initialize DynamoDB counter records (16 segments)
    try {
      const counterCount = await initializeCountersForQuestion(savedQuestion.question_id);
      console.log(`[Admin Approve] Initialized ${counterCount} DynamoDB counters for ${savedQuestion.question_id}`);
    } catch (err) {
      console.error('[Admin Approve] Failed to initialize DynamoDB counters:', err);
      // Non-fatal — counters will be created on first vote via ADD
    }

    return NextResponse.json({
      success: true,
      question: savedQuestion,
      schedule_date: targetDate,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Admin Approve] Error:', message);
    return NextResponse.json(
      { error: message, success: false },
      { status: 500 },
    );
  }
}
