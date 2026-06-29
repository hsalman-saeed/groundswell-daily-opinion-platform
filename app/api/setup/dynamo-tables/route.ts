/**
 * API Route: POST /api/setup/dynamo-tables
 *
 * Single-table DynamoDB setup:
 * 1. Tests DynamoDB access on the Vercel-managed table
 * 2. Initializes counter records for today's question
 * 3. Tests vote submission + duplicate prevention
 * 4. Seeds counter records with exact demo percentages
 */
import { NextResponse } from 'next/server';
import {
  initializeCountersForQuestion,
  submitVote,
  hasPlayerVoted,
  getSegmentCounters,
  DuplicateVoteError,
} from '@/lib/db/dynamo';
import { query } from '@/lib/db/dsql';

// Exact seed data matching the mock percentages
const SEED_COUNTERS = [
  { segment: 'country_DE', yes_count: 1732, no_count: 609, abstain_count: 0 },
  { segment: 'country_BR', yes_count: 1519, no_count: 357, abstain_count: 0 },
  { segment: 'country_JP', yes_count: 678, no_count: 976, abstain_count: 0 },
  { segment: 'country_PK', yes_count: 830, no_count: 373, abstain_count: 0 },
  { segment: 'country_US', yes_count: 2451, no_count: 1440, abstain_count: 0 },
  { segment: 'country_IN', yes_count: 1643, no_count: 464, abstain_count: 0 },
  { segment: 'country_GB', yes_count: 701, no_count: 286, abstain_count: 0 },
  { segment: 'country_FR', yes_count: 596, no_count: 280, abstain_count: 0 },
  { segment: 'country_KR', yes_count: 408, no_count: 335, abstain_count: 0 },
  { segment: 'country_NG', yes_count: 549, no_count: 105, abstain_count: 0 },
  { segment: 'age_18-24', yes_count: 1459, no_count: 388, abstain_count: 0 },
  { segment: 'age_25-34', yes_count: 1564, no_count: 639, abstain_count: 0 },
  { segment: 'age_35-49', yes_count: 1898, no_count: 1114, abstain_count: 0 },
  { segment: 'age_50-64', yes_count: 2244, no_count: 1912, abstain_count: 0 },
  { segment: 'age_65+', yes_count: 1560, no_count: 2069, abstain_count: 0 },
  { segment: 'global_all', yes_count: 9951, no_count: 4896, abstain_count: 0 },
];

export async function POST() {
  const results: { step: string; status: string; detail?: string }[] = [];

  // -----------------------------------------------------------------------
  // 0. Get today's question_id + hafiz's player_id from Aurora DSQL
  // -----------------------------------------------------------------------
  let todayQuestionId = '';
  let hafizPlayerId = '';

  try {
    const qRes = await query(
      `SELECT question_id FROM questions WHERE release_date = CURRENT_DATE AND is_active = true LIMIT 1`,
    );
    if (qRes.rows.length === 0) {
      return NextResponse.json({
        success: false,
        results: [{ step: 'find_question', status: 'failed', detail: 'No active question for today — run /api/setup/seed first' }],
      }, { status: 400 });
    }
    todayQuestionId = qRes.rows[0].question_id;
    results.push({ step: 'find_today_question', status: 'success', detail: todayQuestionId });

    const pRes = await query(`SELECT player_id FROM players WHERE username = 'hafiz' LIMIT 1`);
    if (pRes.rows.length === 0) {
      return NextResponse.json({
        success: false,
        results: [{ step: 'find_hafiz', status: 'failed', detail: 'Player hafiz not found — run /api/setup/seed first' }],
      }, { status: 400 });
    }
    hafizPlayerId = pRes.rows[0].player_id;
    results.push({ step: 'find_hafiz_player', status: 'success', detail: hafizPlayerId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ step: 'dsql_lookup', status: 'failed', detail: msg });
    return NextResponse.json({ success: false, results }, { status: 500 });
  }

  // -----------------------------------------------------------------------
  // 1. Initialize counters with zero counts (test basic write access)
  // -----------------------------------------------------------------------
  try {
    const count = await initializeCountersForQuestion(todayQuestionId);
    results.push({ step: 'init_zero_counters', status: 'success', detail: `${count} counter records written` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ step: 'init_zero_counters', status: 'failed', detail: msg });
    return NextResponse.json({ success: false, results }, { status: 500 });
  }

  // -----------------------------------------------------------------------
  // 2. Test submitVote — hafiz votes YES from PK, age 18-24
  // -----------------------------------------------------------------------
  try {
    await submitVote(todayQuestionId, hafizPlayerId, 'YES', 'PK', '18-24');
    results.push({ step: 'test_submit_vote', status: 'success', detail: 'hafiz voted YES' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ step: 'test_submit_vote', status: 'failed', detail: msg });
  }

  // -----------------------------------------------------------------------
  // 3. Verify counters incremented
  // -----------------------------------------------------------------------
  try {
    const counters = await getSegmentCounters(todayQuestionId);
    const pkCounter = counters.find((c) => c.segment === 'country_PK');
    const ageCounter = counters.find((c) => c.segment === 'age_18-24');
    const globalCounter = counters.find((c) => c.segment === 'global_all');

    const detail = [
      `country_PK: yes=${pkCounter?.yes_count}`,
      `age_18-24: yes=${ageCounter?.yes_count}`,
      `global_all: yes=${globalCounter?.yes_count}`,
    ].join(', ');
    results.push({ step: 'verify_counters', status: 'success', detail });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ step: 'verify_counters', status: 'failed', detail: msg });
  }

  // -----------------------------------------------------------------------
  // 4. Test duplicate vote prevention
  // -----------------------------------------------------------------------
  try {
    await submitVote(todayQuestionId, hafizPlayerId, 'YES', 'PK', '18-24');
    results.push({ step: 'test_duplicate_vote', status: 'failed', detail: 'Should have thrown DuplicateVoteError but did not' });
  } catch (err: unknown) {
    if (err instanceof DuplicateVoteError) {
      results.push({ step: 'test_duplicate_vote', status: 'success', detail: `Correctly threw: ${err.message}` });
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ step: 'test_duplicate_vote', status: 'failed', detail: `Wrong error: ${msg}` });
    }
  }

  // -----------------------------------------------------------------------
  // 5. Test hasPlayerVoted
  // -----------------------------------------------------------------------
  try {
    const voted = await hasPlayerVoted(todayQuestionId, hafizPlayerId);
    results.push({
      step: 'test_has_voted',
      status: voted ? 'success' : 'failed',
      detail: `hasPlayerVoted returned ${voted}`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ step: 'test_has_voted', status: 'failed', detail: msg });
  }

  // -----------------------------------------------------------------------
  // 6. Now seed with the exact demo data counters (overwrites test data)
  // -----------------------------------------------------------------------
  try {
    const count = await initializeCountersForQuestion(todayQuestionId, SEED_COUNTERS);
    results.push({ step: 'seed_demo_counters', status: 'success', detail: `${count} counter records seeded with demo data` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ step: 'seed_demo_counters', status: 'failed', detail: msg });
  }

  // -----------------------------------------------------------------------
  // 7. Verify seeded data
  // -----------------------------------------------------------------------
  try {
    const counters = await getSegmentCounters(todayQuestionId);
    const de = counters.find((c) => c.segment === 'country_DE');
    const jp = counters.find((c) => c.segment === 'country_JP');
    const br = counters.find((c) => c.segment === 'country_BR');
    const global = counters.find((c) => c.segment === 'global_all');

    results.push({
      step: 'verify_seed_data',
      status: 'success',
      detail: JSON.stringify({
        germany: { yes: de?.yes_count, no: de?.no_count, pct: de?.yes_pct },
        japan: { yes: jp?.yes_count, no: jp?.no_count, pct: jp?.yes_pct },
        brazil: { yes: br?.yes_count, no: br?.no_count, pct: br?.yes_pct },
        global: { yes: global?.yes_count, no: global?.no_count, pct: global?.yes_pct },
        total_segments: counters.length,
      }),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ step: 'verify_seed_data', status: 'failed', detail: msg });
  }

  const allOk = results.every((r) => r.status === 'success');
  return NextResponse.json({ success: allOk, results }, { status: allOk ? 200 : 207 });
}
