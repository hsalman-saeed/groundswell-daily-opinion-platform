/**
 * API Route: POST /api/setup/schema
 *
 * Creates all 5 Aurora DSQL tables and 5 indexes.
 * Must be triggered while `vercel dev` is running so
 * VERCEL_OIDC_TOKEN is available as the PG password.
 *
 * Each CREATE TABLE is executed individually and results reported.
 */
import { NextResponse } from 'next/server';
import { query, testConnection } from '@/lib/db/dsql';

const TABLES = [
  {
    name: 'players',
    sql: `
      CREATE TABLE IF NOT EXISTS players (
        player_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        hashed_password VARCHAR(255) NOT NULL,
        country_code CHAR(2) NOT NULL,
        country_name VARCHAR(100) NOT NULL,
        age_bucket VARCHAR(10) NOT NULL CHECK (age_bucket IN ('18-24','25-34','35-49','50-64','65+')),
        current_streak INTEGER DEFAULT 0,
        longest_streak INTEGER DEFAULT 0,
        total_questions_answered INTEGER DEFAULT 0,
        total_empathy_score INTEGER DEFAULT 0,
        avg_empathy_score DECIMAL(5,2) DEFAULT 0,
        avg_prediction_error DECIMAL(5,2),
        last_active_date DATE,
        joined_at TIMESTAMPTZ DEFAULT NOW()
      )
    `,
  },
  {
    name: 'questions',
    sql: `
      CREATE TABLE IF NOT EXISTS questions (
        question_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_text TEXT NOT NULL,
        category VARCHAR(50) NOT NULL,
        release_date DATE UNIQUE NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        is_finalized BOOLEAN DEFAULT FALSE,
        total_participants INTEGER DEFAULT 0,
        global_yes_pct DECIMAL(5,2),
        global_no_pct DECIMAL(5,2),
        global_abstain_pct DECIMAL(5,2),
        divergence_score DECIMAL(4,2),
        ai_generated BOOLEAN DEFAULT TRUE,
        bedrock_predicted_divergence DECIMAL(4,2),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `,
  },
  {
    name: 'question_aggregates',
    sql: `
      CREATE TABLE IF NOT EXISTS question_aggregates (
        aggregate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID NOT NULL,
        segment_type VARCHAR(20) NOT NULL CHECK (segment_type IN ('country','age_bucket','global')),
        segment_value VARCHAR(50) NOT NULL,
        yes_count INTEGER DEFAULT 0,
        no_count INTEGER DEFAULT 0,
        abstain_count INTEGER DEFAULT 0,
        total_count INTEGER DEFAULT 0,
        yes_pct DECIMAL(5,2) DEFAULT 0,
        no_pct DECIMAL(5,2) DEFAULT 0,
        is_final BOOLEAN DEFAULT FALSE,
        last_updated TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(question_id, segment_type, segment_value)
      )
    `,
  },
  {
    name: 'user_predictions',
    sql: `
      CREATE TABLE IF NOT EXISTS user_predictions (
        prediction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_id UUID NOT NULL,
        question_id UUID NOT NULL,
        target_segment_type VARCHAR(20) NOT NULL,
        target_segment_value VARCHAR(50) NOT NULL,
        predicted_yes_pct DECIMAL(5,2) NOT NULL,
        actual_yes_pct DECIMAL(5,2),
        error_points DECIMAL(5,2),
        accuracy_score INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        scored_at TIMESTAMPTZ,
        UNIQUE(player_id, question_id, target_segment_type, target_segment_value)
      )
    `,
  },
  {
    name: 'user_question_results',
    sql: `
      CREATE TABLE IF NOT EXISTS user_question_results (
        result_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_id UUID NOT NULL,
        question_id UUID NOT NULL,
        vote VARCHAR(10) NOT NULL CHECK (vote IN ('YES','NO','ABSTAIN')),
        empathy_score INTEGER,
        avg_prediction_error DECIMAL(5,2),
        voted_at TIMESTAMPTZ DEFAULT NOW(),
        scored_at TIMESTAMPTZ,
        UNIQUE(player_id, question_id)
      )
    `,
  },
];

const INDEXES = [
  {
    name: 'idx_aggregates_question',
    sql: `CREATE INDEX ASYNC IF NOT EXISTS idx_aggregates_question ON question_aggregates(question_id)`,
  },
  {
    name: 'idx_aggregates_segment',
    sql: `CREATE INDEX ASYNC IF NOT EXISTS idx_aggregates_segment ON question_aggregates(question_id, segment_type, segment_value)`,
  },
  {
    name: 'idx_questions_active',
    sql: `CREATE INDEX ASYNC IF NOT EXISTS idx_questions_active ON questions(release_date, is_active)`,
  },
  {
    name: 'idx_results_player',
    sql: `CREATE INDEX ASYNC IF NOT EXISTS idx_results_player ON user_question_results(player_id, voted_at)`,
  },
  {
    name: 'idx_predictions_scoring',
    sql: `CREATE INDEX ASYNC IF NOT EXISTS idx_predictions_scoring ON user_predictions(question_id, scored_at)`,
  },
];

export async function POST() {
  const results: { step: string; status: string; error?: string }[] = [];

  // 1. Test connection first
  const connTest = await testConnection();
  results.push({ step: 'connection_test', status: connTest.connected ? 'success' : 'failed', error: connTest.connected ? undefined : connTest.message });
  if (!connTest.connected) {
    return NextResponse.json({ success: false, results }, { status: 500 });
  }

  // 2. Create tables one by one
  for (const table of TABLES) {
    try {
      await query(table.sql);
      results.push({ step: `create_table_${table.name}`, status: 'success' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ step: `create_table_${table.name}`, status: 'failed', error: message });
      // Continue — don't abort on individual table failure
    }
  }

  // 3. Create indexes
  for (const idx of INDEXES) {
    try {
      await query(idx.sql);
      results.push({ step: `create_index_${idx.name}`, status: 'success' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ step: `create_index_${idx.name}`, status: 'failed', error: message });
    }
  }

  // 4. List created tables
  try {
    const tablesResult = await query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    results.push({
      step: 'list_tables',
      status: 'success',
      error: tablesResult.rows.map((r) => r.table_name).join(', '),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    results.push({ step: 'list_tables', status: 'failed', error: message });
  }

  // 5. List indexes
  try {
    const indexResult = await query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND indexname LIKE 'idx_%'
      ORDER BY indexname
    `);
    results.push({
      step: 'list_indexes',
      status: 'success',
      error: indexResult.rows.map((r) => r.indexname).join(', '),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    results.push({ step: 'list_indexes', status: 'failed', error: message });
  }

  const allSucceeded = results.every((r) => r.status === 'success');
  return NextResponse.json({ success: allSucceeded, results }, { status: allSucceeded ? 200 : 207 });
}
