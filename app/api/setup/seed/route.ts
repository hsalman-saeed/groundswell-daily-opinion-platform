/**
 * API Route: POST /api/setup/seed
 *
 * Seeds all Aurora DSQL tables and DynamoDB segment counters
 * with comprehensive demo data. Idempotent — clears existing
 * data before re-seeding.
 *
 * Must be triggered while `vercel dev` is running.
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db/dsql';
import bcrypt from 'bcryptjs';

// ---------------------------------------------------------------------------
// Helper: date offsets
// ---------------------------------------------------------------------------
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

function today(): string {
  return daysAgo(0);
}

// ---------------------------------------------------------------------------
// Player seed data
// ---------------------------------------------------------------------------
const PLAYERS = [
  {
    username: 'hafiz', email: 'hafiz@demo.com',
    country_code: 'PK', country_name: 'Pakistan', age_bucket: '18-24',
    current_streak: 7, longest_streak: 12,
    total_questions_answered: 21, total_empathy_score: 1834,
    avg_empathy_score: 87.3,
  },
  {
    username: 'sofia_r', email: 'sofia@demo.com',
    country_code: 'DE', country_name: 'Germany', age_bucket: '25-34',
    current_streak: 15, longest_streak: 15,
    total_questions_answered: 21, total_empathy_score: 1987,
    avg_empathy_score: 94.6,
  },
  {
    username: 'kim_taeyong', email: 'kim@demo.com',
    country_code: 'KR', country_name: 'South Korea', age_bucket: '25-34',
    current_streak: 9, longest_streak: 21,
    total_questions_answered: 21, total_empathy_score: 1965,
    avg_empathy_score: 93.6,
  },
  {
    username: 'alejandro_v', email: 'alejandro@demo.com',
    country_code: 'MX', country_name: 'Mexico', age_bucket: '35-49',
    current_streak: 6, longest_streak: 18,
    total_questions_answered: 21, total_empathy_score: 1908,
    avg_empathy_score: 90.9,
  },
  {
    username: 'priya_n', email: 'priya@demo.com',
    country_code: 'IN', country_name: 'India', age_bucket: '18-24',
    current_streak: 4, longest_streak: 14,
    total_questions_answered: 21, total_empathy_score: 1876,
    avg_empathy_score: 89.3,
  },
];

// ---------------------------------------------------------------------------
// Question seed data
// ---------------------------------------------------------------------------
const PAST_QUESTIONS = [
  {
    daysAgoOffset: 7,
    text: 'Should AI-generated images be required to carry a visible disclosure label?',
    category: 'Technology',
    global_yes_pct: 67.3, global_no_pct: 27.4, global_abstain_pct: 5.3,
    divergence_score: 7.8, bedrock_predicted_divergence: 8.1,
    total_participants: 14847,
  },
  {
    daysAgoOffset: 6,
    text: 'Is working remotely better for family life than working in an office?',
    category: 'Society',
    global_yes_pct: 58.9, global_no_pct: 34.2, global_abstain_pct: 6.9,
    divergence_score: 6.2, bedrock_predicted_divergence: 6.5,
    total_participants: 12203,
  },
  {
    daysAgoOffset: 5,
    text: 'Should university education be free for all citizens?',
    category: 'Economics',
    global_yes_pct: 71.4, global_no_pct: 23.8, global_abstain_pct: 4.8,
    divergence_score: 8.4, bedrock_predicted_divergence: 7.9,
    total_participants: 16542,
  },
  {
    daysAgoOffset: 4,
    text: 'Should there be a global limit on how many hours per week social media companies can show content to users under 18?',
    category: 'Healthcare',
    global_yes_pct: 63.7, global_no_pct: 30.1, global_abstain_pct: 6.2,
    divergence_score: 7.1, bedrock_predicted_divergence: 7.4,
    total_participants: 13891,
  },
  {
    daysAgoOffset: 3,
    text: 'Should athletes who take performance-enhancing drugs be permanently banned from competition?',
    category: 'Culture',
    global_yes_pct: 54.2, global_no_pct: 40.3, global_abstain_pct: 5.5,
    divergence_score: 5.8, bedrock_predicted_divergence: 6.0,
    total_participants: 11234,
  },
  {
    daysAgoOffset: 2,
    text: 'Should nuclear energy be expanded as part of the solution to climate change?',
    category: 'Environment',
    global_yes_pct: 61.8, global_no_pct: 31.9, global_abstain_pct: 6.3,
    divergence_score: 8.9, bedrock_predicted_divergence: 8.5,
    total_participants: 15678,
  },
];

const TODAY_QUESTION = {
  text: 'Should AI-generated content be required to carry a disclosure label?',
  category: 'Technology',
  total_participants: 14847,
};

// ---------------------------------------------------------------------------
// Country aggregates for today's question (from mock-data.ts)
// ---------------------------------------------------------------------------
const COUNTRY_AGGREGATES = [
  { code: 'DE', name: 'Germany',        yes_pct: 74, players: 2341 },
  { code: 'BR', name: 'Brazil',         yes_pct: 81, players: 1876 },
  { code: 'JP', name: 'Japan',          yes_pct: 41, players: 1654 },
  { code: 'PK', name: 'Pakistan',       yes_pct: 69, players: 1203 },
  { code: 'US', name: 'United States',  yes_pct: 63, players: 3891 },
  { code: 'IN', name: 'India',          yes_pct: 78, players: 2107 },
  { code: 'GB', name: 'United Kingdom', yes_pct: 71, players: 987 },
  { code: 'FR', name: 'France',         yes_pct: 68, players: 876 },
  { code: 'KR', name: 'South Korea',    yes_pct: 55, players: 743 },
  { code: 'NG', name: 'Nigeria',        yes_pct: 84, players: 654 },
];

const AGE_AGGREGATES = [
  { bucket: '18-24', yes_pct: 79, players: 4200 },
  { bucket: '25-34', yes_pct: 71, players: 3800 },
  { bucket: '35-49', yes_pct: 63, players: 3200 },
  { bucket: '50-64', yes_pct: 54, players: 2100 },
  { bucket: '65+',   yes_pct: 43, players: 1547 },
];

// Empathy scores for hafiz's 6 past questions
const HAFIZ_SCORES = [88, 72, 91, 84, 79, 93];

// Prediction data for hafiz — realistic 3–8 point errors
const HAFIZ_PREDICTIONS = [
  // Question 1 (7 days ago) — empathy 88
  [
    { seg_type: 'country', seg_value: 'DE', predicted: 71, actual: 74 },
    { seg_type: 'age_bucket', seg_value: '18-24', predicted: 73, actual: 79 },
  ],
  // Question 2 (6 days ago) — empathy 72
  [
    { seg_type: 'country', seg_value: 'US', predicted: 52, actual: 59 },
    { seg_type: 'age_bucket', seg_value: '25-34', predicted: 65, actual: 58 },
  ],
  // Question 3 (5 days ago) — empathy 91
  [
    { seg_type: 'country', seg_value: 'IN', predicted: 75, actual: 78 },
    { seg_type: 'age_bucket', seg_value: '35-49', predicted: 60, actual: 63 },
  ],
  // Question 4 (4 days ago) — empathy 84
  [
    { seg_type: 'country', seg_value: 'BR', predicted: 70, actual: 64 },
    { seg_type: 'age_bucket', seg_value: '50-64', predicted: 58, actual: 54 },
  ],
  // Question 5 (3 days ago) — empathy 79
  [
    { seg_type: 'country', seg_value: 'JP', predicted: 48, actual: 54 },
    { seg_type: 'age_bucket', seg_value: '65+', predicted: 40, actual: 43 },
  ],
  // Question 6 (2 days ago) — empathy 93
  [
    { seg_type: 'country', seg_value: 'KR', predicted: 58, actual: 55 },
    { seg_type: 'age_bucket', seg_value: '18-24', predicted: 65, actual: 62 },
  ],
];

const HAFIZ_VOTES: Array<'YES' | 'NO' | 'ABSTAIN'> = ['YES', 'YES', 'YES', 'YES', 'NO', 'YES'];

export async function POST() {
  const results: { step: string; status: string; detail?: string }[] = [];

  try {
    // =====================================================================
    // 0. Hash password
    // =====================================================================
    const hashedPassword = await bcrypt.hash('groundswell2026', 12);
    results.push({ step: 'hash_password', status: 'success' });

    // =====================================================================
    // 1. Clean existing data (in correct FK order)
    // =====================================================================
    await query('DELETE FROM user_predictions');
    await query('DELETE FROM user_question_results');
    await query('DELETE FROM question_aggregates');
    await query('DELETE FROM questions');
    await query('DELETE FROM players');
    results.push({ step: 'clean_existing_data', status: 'success' });

    // =====================================================================
    // 2. Seed players
    // =====================================================================
    const playerIds: Record<string, string> = {};
    for (const p of PLAYERS) {
      const res = await query(
        `INSERT INTO players (
          username, email, hashed_password, country_code, country_name,
          age_bucket, current_streak, longest_streak,
          total_questions_answered, total_empathy_score, avg_empathy_score,
          last_active_date
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,CURRENT_DATE)
        RETURNING player_id`,
        [
          p.username, p.email, hashedPassword, p.country_code, p.country_name,
          p.age_bucket, p.current_streak, p.longest_streak,
          p.total_questions_answered, p.total_empathy_score, p.avg_empathy_score,
        ],
      );
      playerIds[p.username] = res.rows[0].player_id;
    }
    results.push({ step: 'seed_players', status: 'success', detail: `${PLAYERS.length} players` });

    // =====================================================================
    // 3. Seed past questions (finalized)
    // =====================================================================
    const questionIds: string[] = [];
    for (const q of PAST_QUESTIONS) {
      const res = await query(
        `INSERT INTO questions (
          question_text, category, release_date, is_active, is_finalized,
          total_participants, global_yes_pct, global_no_pct, global_abstain_pct,
          divergence_score, bedrock_predicted_divergence
        ) VALUES ($1,$2,$3,false,true,$4,$5,$6,$7,$8,$9)
        RETURNING question_id`,
        [
          q.text, q.category, daysAgo(q.daysAgoOffset),
          q.total_participants, q.global_yes_pct, q.global_no_pct, q.global_abstain_pct,
          q.divergence_score, q.bedrock_predicted_divergence,
        ],
      );
      questionIds.push(res.rows[0].question_id);
    }
    results.push({ step: 'seed_past_questions', status: 'success', detail: `${PAST_QUESTIONS.length} questions` });

    // =====================================================================
    // 4. Seed today's active question
    // =====================================================================
    const todayRes = await query(
      `INSERT INTO questions (
        question_text, category, release_date, is_active, is_finalized,
        total_participants
      ) VALUES ($1,$2,$3,true,false,$4)
      RETURNING question_id`,
      [TODAY_QUESTION.text, TODAY_QUESTION.category, today(), TODAY_QUESTION.total_participants],
    );
    const todayQuestionId = todayRes.rows[0].question_id;
    results.push({ step: 'seed_today_question', status: 'success', detail: todayQuestionId });

    // =====================================================================
    // 5. Seed question_aggregates for today's question
    // =====================================================================
    let aggCount = 0;

    // Country aggregates
    for (const c of COUNTRY_AGGREGATES) {
      const yes_count = Math.round(c.players * c.yes_pct / 100);
      const abstain_count = Math.round(c.players * 0.05);
      const no_count = c.players - yes_count - abstain_count;
      const no_pct = parseFloat(((no_count / c.players) * 100).toFixed(2));

      await query(
        `INSERT INTO question_aggregates (
          question_id, segment_type, segment_value,
          yes_count, no_count, abstain_count, total_count,
          yes_pct, no_pct, is_final
        ) VALUES ($1,'country',$2,$3,$4,$5,$6,$7,$8,false)`,
        [todayQuestionId, c.code, yes_count, no_count, abstain_count, c.players, c.yes_pct, no_pct],
      );
      aggCount++;
    }

    // Age bucket aggregates
    for (const a of AGE_AGGREGATES) {
      const yes_count = Math.round(a.players * a.yes_pct / 100);
      const abstain_count = Math.round(a.players * 0.05);
      const no_count = a.players - yes_count - abstain_count;
      const no_pct = parseFloat(((no_count / a.players) * 100).toFixed(2));

      await query(
        `INSERT INTO question_aggregates (
          question_id, segment_type, segment_value,
          yes_count, no_count, abstain_count, total_count,
          yes_pct, no_pct, is_final
        ) VALUES ($1,'age_bucket',$2,$3,$4,$5,$6,$7,$8,false)`,
        [todayQuestionId, a.bucket, yes_count, no_count, abstain_count, a.players, a.yes_pct, no_pct],
      );
      aggCount++;
    }

    // Global aggregate
    const globalPlayers = TODAY_QUESTION.total_participants;
    const globalYes = Math.round(globalPlayers * 0.67);
    const globalAbstain = Math.round(globalPlayers * 0.05);
    const globalNo = globalPlayers - globalYes - globalAbstain;
    await query(
      `INSERT INTO question_aggregates (
        question_id, segment_type, segment_value,
        yes_count, no_count, abstain_count, total_count,
        yes_pct, no_pct, is_final
      ) VALUES ($1,'global','all',$2,$3,$4,$5,67.0,28.0,false)`,
      [todayQuestionId, globalYes, globalNo, globalAbstain, globalPlayers],
    );
    aggCount++;

    results.push({ step: 'seed_aggregates', status: 'success', detail: `${aggCount} rows` });

    // DynamoDB seeding is handled separately by /api/setup/dynamo-tables

    // =====================================================================
    // 7. Seed user_question_results for hafiz
    // =====================================================================
    const hafizId = playerIds['hafiz'];
    for (let i = 0; i < 6; i++) {
      const qId = questionIds[i];
      const errVal = HAFIZ_PREDICTIONS[i].reduce(
        (sum, p) => sum + Math.abs(p.predicted - p.actual), 0,
      ) / HAFIZ_PREDICTIONS[i].length;

      await query(
        `INSERT INTO user_question_results (
          player_id, question_id, vote, empathy_score,
          avg_prediction_error, scored_at
        ) VALUES ($1,$2,$3,$4,$5,NOW())`,
        [hafizId, qId, HAFIZ_VOTES[i], HAFIZ_SCORES[i], parseFloat(errVal.toFixed(2))],
      );
    }
    results.push({ step: 'seed_hafiz_results', status: 'success', detail: '6 rows' });

    // =====================================================================
    // 8. Seed user_predictions for hafiz
    // =====================================================================
    let predCount = 0;
    for (let i = 0; i < 6; i++) {
      const qId = questionIds[i];
      for (const pred of HAFIZ_PREDICTIONS[i]) {
        const errorPoints = parseFloat(Math.abs(pred.predicted - pred.actual).toFixed(2));
        const accuracyScore = Math.max(0, 100 - Math.round(errorPoints * 5));
        await query(
          `INSERT INTO user_predictions (
            player_id, question_id, target_segment_type, target_segment_value,
            predicted_yes_pct, actual_yes_pct, error_points, accuracy_score,
            scored_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
          [
            hafizId, qId, pred.seg_type, pred.seg_value,
            pred.predicted, pred.actual, errorPoints, accuracyScore,
          ],
        );
        predCount++;
      }
    }
    results.push({ step: 'seed_hafiz_predictions', status: 'success', detail: `${predCount} rows` });

    // =====================================================================
    // 9. Row count verification
    // =====================================================================
    const counts: Record<string, number> = {};
    for (const table of ['players', 'questions', 'question_aggregates', 'user_question_results', 'user_predictions']) {
      const res = await query(`SELECT COUNT(*) as cnt FROM ${table}`);
      counts[table] = parseInt(res.rows[0].cnt, 10);
    }
    results.push({
      step: 'row_counts',
      status: 'success',
      detail: JSON.stringify(counts),
    });

    return NextResponse.json({ success: true, results, counts, todayQuestionId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    results.push({ step: 'fatal_error', status: 'failed', detail: message });
    return NextResponse.json({ success: false, results, error: message }, { status: 500 });
  }
}
