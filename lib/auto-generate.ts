/**
 * Auto-generate and schedule questions when admin hasn't done so.
 *
 * Used by:
 *   - GET /api/today       (on-demand if no question exists for today)
 *   - GET /api/cron/nightly (pre-generate tomorrow's question)
 *
 * Flow:
 *   1. Check if an active, non-finalized question exists
 *   2. If yes, return it
 *   3. If no, generate via Bedrock → pick top candidate → insert → return
 */
import { query } from '@/lib/db/dsql';
import { generateQuestionCandidates } from '@/lib/bedrock';
import { initializeCountersForQuestion } from '@/lib/db/dynamo';

const TOPICS = [
  'Technology',
  'Society',
  'Environment',
  'Culture',
  'Economics',
  'Healthcare',
  'Geopolitics',
] as const;

/**
 * Pick a topic based on the date, cycling through the list daily.
 */
function topicForDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const dayOfYear = Math.floor(
    (d.getTime() - new Date(d.getUTCFullYear(), 0, 1).getTime()) / 86400000,
  );
  return TOPICS[dayOfYear % TOPICS.length];
}

/**
 * Find the next available date for inserting a question.
 * Starts from targetDate and scans forward up to 7 days.
 */
async function findAvailableDate(targetDate: string): Promise<string> {
  for (let offset = 0; offset <= 7; offset++) {
    const d = new Date(targetDate + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + offset);
    const candidate = d.toISOString().split('T')[0];
    const check = await query(
      `SELECT question_id FROM questions WHERE release_date = $1 LIMIT 1`,
      [candidate],
    );
    if (check.rows.length === 0) {
      return candidate;
    }
  }
  // Worst case — use targetDate and let the insert handle conflict
  return targetDate;
}

/**
 * Ensure an active question is available for today.
 * Returns the active question row, or null if generation completely fails.
 *
 * Logic:
 * 1. Look for any active, non-finalized question (today or recent)
 * 2. If found, return it
 * 3. If none, generate via Bedrock and insert on the next available date
 */
export async function ensureTodayQuestion(): Promise<Record<string, any> | null> {
  // 1. Check if any active, non-finalized question exists
  const active = await query(
    `SELECT question_id, question_text, category,
            release_date, is_active, is_finalized, total_participants,
            global_yes_pct, global_no_pct, global_abstain_pct
     FROM questions
     WHERE is_active = true AND is_finalized = false
     ORDER BY release_date DESC
     LIMIT 1`,
  );

  if (active.rows.length > 0) {
    return active.rows[0];
  }

  // 2. No active question — auto-generate
  const todayStr = new Date().toISOString().split('T')[0];
  console.log(`[AutoGenerate] No active question found, generating for ${todayStr}...`);

  const topic = topicForDate(todayStr);

  // Fetch recent questions to avoid duplicates
  let recentQuestions: string[] = [];
  try {
    const recent = await query(
      `SELECT question_text FROM questions ORDER BY release_date DESC LIMIT 10`,
    );
    recentQuestions = recent.rows.map((r: any) => r.question_text);
  } catch {
    // Non-fatal
  }

  // Generate candidates via Bedrock (falls back to hardcoded if AI fails)
  const { candidates, model, fallback } = await generateQuestionCandidates(
    topic,
    recentQuestions,
  );

  if (!candidates || candidates.length === 0) {
    console.error('[AutoGenerate] No candidates returned at all');
    return null;
  }

  // Pick the candidate with the highest predicted divergence score
  const best = [...candidates].sort(
    (a, b) => (b.predicted_divergence_score || 0) - (a.predicted_divergence_score || 0),
  )[0];

  console.log(
    `[AutoGenerate] Selected: "${best.question_text.slice(0, 60)}..." (${model}, fallback=${fallback})`,
  );

  // Find the next available date (handles seed data date collisions)
  const insertDate = await findAvailableDate(todayStr);
  console.log(`[AutoGenerate] Insert date: ${insertDate}`);

  // 3. Insert into the database
  try {
    const result = await query(
      `INSERT INTO questions
       (question_text, category, release_date, ai_generated,
        bedrock_predicted_divergence, is_active, is_finalized)
       VALUES ($1, $2, $3, true, $4, true, false)
       RETURNING question_id, question_text, category, release_date,
                 is_active, is_finalized, total_participants,
                 global_yes_pct, global_no_pct, global_abstain_pct`,
      [
        best.question_text,
        best.category,
        insertDate,
        best.predicted_divergence_score || null,
      ],
    );

    const savedQuestion = result.rows[0];
    console.log(`[AutoGenerate] Saved question ${savedQuestion.question_id} for ${insertDate}`);

    // Initialize DynamoDB counters (non-fatal if it fails)
    try {
      await initializeCountersForQuestion(savedQuestion.question_id);
    } catch (err) {
      console.error('[AutoGenerate] DynamoDB counter init failed (non-fatal):', err);
    }

    return savedQuestion;
  } catch (err: any) {
    // Race condition — another request may have inserted first
    if (err?.message?.includes('unique') || err?.message?.includes('duplicate')) {
      console.log('[AutoGenerate] Duplicate detected, re-querying...');
      const retry = await query(
        `SELECT question_id, question_text, category,
                release_date, is_active, is_finalized, total_participants,
                global_yes_pct, global_no_pct, global_abstain_pct
         FROM questions
         WHERE is_active = true AND is_finalized = false
         ORDER BY release_date DESC LIMIT 1`,
      );
      return retry.rows[0] || null;
    }
    throw err;
  }
}

/**
 * Ensure a question exists for a specific future date (used by cron for tomorrow).
 */
export async function ensureQuestionForDate(
  targetDate: string,
): Promise<Record<string, any> | null> {
  // Check if any question (active or finalized) exists for this date
  const existing = await query(
    `SELECT question_id, question_text, category,
            release_date, is_active, is_finalized, total_participants,
            global_yes_pct, global_no_pct, global_abstain_pct
     FROM questions
     WHERE release_date = $1
     LIMIT 1`,
    [targetDate],
  );

  if (existing.rows.length > 0) {
    const q = existing.rows[0];
    // If not finalized, ensure it's active
    if (!q.is_finalized && !q.is_active) {
      await query(
        `UPDATE questions SET is_active = true WHERE question_id = $1`,
        [q.question_id],
      );
      q.is_active = true;
    }
    return q;
  }

  // No question for this date — generate one
  console.log(`[AutoGenerate] No question for ${targetDate}, generating...`);
  const topic = topicForDate(targetDate);

  let recentQuestions: string[] = [];
  try {
    const recent = await query(
      `SELECT question_text FROM questions ORDER BY release_date DESC LIMIT 10`,
    );
    recentQuestions = recent.rows.map((r: any) => r.question_text);
  } catch {
    // Non-fatal
  }

  const { candidates, model, fallback } = await generateQuestionCandidates(
    topic,
    recentQuestions,
  );

  if (!candidates || candidates.length === 0) return null;

  const best = [...candidates].sort(
    (a, b) => (b.predicted_divergence_score || 0) - (a.predicted_divergence_score || 0),
  )[0];

  try {
    const result = await query(
      `INSERT INTO questions
       (question_text, category, release_date, ai_generated,
        bedrock_predicted_divergence, is_active, is_finalized)
       VALUES ($1, $2, $3, true, $4, true, false)
       RETURNING question_id, question_text, category, release_date,
                 is_active, is_finalized, total_participants`,
      [best.question_text, best.category, targetDate, best.predicted_divergence_score || null],
    );
    const saved = result.rows[0];
    try { await initializeCountersForQuestion(saved.question_id); } catch { /* non-fatal */ }
    return saved;
  } catch {
    return null;
  }
}
