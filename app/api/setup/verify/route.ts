/**
 * API Route: GET /api/setup/verify
 *
 * Runs all verification queries against Aurora DSQL and DynamoDB.
 * Reports table counts, sample data, auth test, and connection health.
 */
import { NextResponse } from 'next/server';
import { query, testConnection } from '@/lib/db/dsql';
import { getSegmentCounters, hasPlayerVoted } from '@/lib/db/dynamo';
import bcrypt from 'bcryptjs';

export async function GET() {
  const verifications: { test: string; status: string; data?: unknown }[] = [];

  // =======================================================================
  // 1. Aurora DSQL connection test
  // =======================================================================
  const connTest = await testConnection();
  verifications.push({
    test: 'dsql_connection',
    status: connTest.connected ? 'PASS' : 'FAIL',
    data: connTest.message,
  });

  if (!connTest.connected) {
    return NextResponse.json({
      success: false,
      verifications,
      summary: { dsql_connected: false },
    }, { status: 500 });
  }

  // =======================================================================
  // 2. Table counts
  // =======================================================================
  const tableCounts: Record<string, number> = {};
  for (const table of ['players', 'questions', 'question_aggregates', 'user_question_results', 'user_predictions']) {
    try {
      const res = await query(`SELECT COUNT(*) as cnt FROM ${table}`);
      tableCounts[table] = parseInt(res.rows[0].cnt, 10);
      verifications.push({
        test: `count_${table}`,
        status: 'PASS',
        data: tableCounts[table],
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      verifications.push({ test: `count_${table}`, status: 'FAIL', data: message });
    }
  }

  // =======================================================================
  // 3. Recent questions
  // =======================================================================
  try {
    const res = await query(`
      SELECT question_text, category, release_date, total_participants
      FROM questions ORDER BY release_date DESC LIMIT 3
    `);
    verifications.push({
      test: 'recent_questions',
      status: 'PASS',
      data: res.rows,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    verifications.push({ test: 'recent_questions', status: 'FAIL', data: message });
  }

  // =======================================================================
  // 4. Country aggregates for today's question
  // =======================================================================
  let todayQuestionId: string | null = null;
  try {
    const qRes = await query(
      `SELECT question_id FROM questions WHERE release_date = CURRENT_DATE AND is_active = true LIMIT 1`,
    );
    if (qRes.rows.length > 0) {
      todayQuestionId = qRes.rows[0].question_id;

      const aggRes = await query(`
        SELECT segment_value, yes_pct, no_pct
        FROM question_aggregates
        WHERE segment_type = 'country' AND question_id = $1
        ORDER BY yes_pct DESC
      `, [todayQuestionId]);

      verifications.push({
        test: 'country_aggregates_today',
        status: 'PASS',
        data: aggRes.rows,
      });
    } else {
      verifications.push({
        test: 'country_aggregates_today',
        status: 'SKIP',
        data: 'No active question for today',
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    verifications.push({ test: 'country_aggregates_today', status: 'FAIL', data: message });
  }

  // =======================================================================
  // 5. DynamoDB verifications
  // =======================================================================
  let dynamoAccessible = false;

  if (todayQuestionId) {
    // 5a. DynamoDB segment counters for today's question
    try {
      const counters = await getSegmentCounters(todayQuestionId);
      dynamoAccessible = true;

      const deCounter = counters.find((c) => c.segment === 'country_DE');
      const jpCounter = counters.find((c) => c.segment === 'country_JP');
      const brCounter = counters.find((c) => c.segment === 'country_BR');

      verifications.push({
        test: 'dynamo_segment_counters',
        status: 'PASS',
        data: {
          total_counter_rows: counters.length,
          germany: deCounter ? {
            yes_count: deCounter.yes_count,
            no_count: deCounter.no_count,
            yes_pct: deCounter.yes_pct,
          } : 'not found',
          japan: jpCounter ? {
            yes_count: jpCounter.yes_count,
            no_count: jpCounter.no_count,
            yes_pct: jpCounter.yes_pct,
          } : 'not found',
          brazil: brCounter ? {
            yes_count: brCounter.yes_count,
            no_count: brCounter.no_count,
            yes_pct: brCounter.yes_pct,
          } : 'not found',
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      verifications.push({ test: 'dynamo_segment_counters', status: 'FAIL', data: message });
    }

    // 5b. hasPlayerVoted test
    try {
      const pRes = await query(`SELECT player_id FROM players WHERE username = 'hafiz' LIMIT 1`);
      if (pRes.rows.length > 0) {
        const hafizId = pRes.rows[0].player_id;
        const voted = await hasPlayerVoted(todayQuestionId, hafizId);
        verifications.push({
          test: 'dynamo_has_player_voted',
          status: 'PASS',
          data: { hafiz_voted: voted },
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      verifications.push({ test: 'dynamo_has_player_voted', status: 'FAIL', data: message });
    }
  }

  // =======================================================================
  // 6. bcrypt authentication test
  // =======================================================================
  try {
    const testHash = await bcrypt.hash('groundswell2026', 12);
    const match = await bcrypt.compare('groundswell2026', testHash);
    verifications.push({
      test: 'bcrypt_auth',
      status: match ? 'PASS' : 'FAIL',
      data: { hash_generated: true, compare_result: match },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    verifications.push({ test: 'bcrypt_auth', status: 'FAIL', data: message });
  }

  // =======================================================================
  // 7. DSQL tables list
  // =======================================================================
  let allDsqlTablesExist = false;
  try {
    const tablesRes = await query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    const tableNames = tablesRes.rows.map((r) => r.table_name);
    const required = ['players', 'questions', 'question_aggregates', 'user_predictions', 'user_question_results'];
    allDsqlTablesExist = required.every((t) => tableNames.includes(t));
    verifications.push({
      test: 'dsql_tables_list',
      status: allDsqlTablesExist ? 'PASS' : 'FAIL',
      data: tableNames,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    verifications.push({ test: 'dsql_tables_list', status: 'FAIL', data: message });
  }

  // =======================================================================
  // Summary
  // =======================================================================
  const summary = {
    dsql_connected: connTest.connected,
    dynamo_accessible: dynamoAccessible,
    all_5_dsql_tables_exist: allDsqlTablesExist,
    seed_data_counts: tableCounts,
    all_tests_passed: verifications.every((v) => v.status === 'PASS' || v.status === 'SKIP'),
  };

  return NextResponse.json({
    success: summary.all_tests_passed,
    verifications,
    summary,
  });
}
