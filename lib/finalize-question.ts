/**
 * Shared finalization logic for scoring a question after voting closes.
 *
 * Used by both:
 *   - POST /api/admin/finalize  (manual trigger for demo)
 *   - GET  /api/cron/nightly    (Vercel cron at midnight UTC)
 *
 * Steps:
 *   1. Read all segment counters from DynamoDB
 *   2. Compute percentages → upsert into question_aggregates (DSQL)
 *   3. Score all unscored user predictions
 *   4. Compute per-player empathy scores → update user_question_results + players
 *   5. Mark question as finalized with divergence_score
 */
import { query } from '@/lib/db/dsql';
import { getSegmentCounters } from '@/lib/db/dynamo';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface FinalizeResult {
  question_id: string;
  segments_updated: number;
  predictions_scored: number;
  players_updated: number;
  divergence_score: number;
  global_yes_pct: number;
  global_no_pct: number;
}

// ---------------------------------------------------------------------------
// Accuracy scoring tiers
// ---------------------------------------------------------------------------
function computeAccuracyScore(errorPoints: number): number {
  if (errorPoints <= 3) return 100;
  if (errorPoints <= 5) return 90;
  if (errorPoints <= 8) return 80;
  if (errorPoints <= 12) return 65;
  if (errorPoints <= 20) return 45;
  return 20;
}

// ---------------------------------------------------------------------------
// Standard deviation helper
// ---------------------------------------------------------------------------
function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return parseFloat(Math.sqrt(avgSquaredDiff).toFixed(2));
}

// ---------------------------------------------------------------------------
// Main finalization function
// ---------------------------------------------------------------------------
export async function finalizeQuestion(questionId: string): Promise<FinalizeResult> {
  console.log(`[Finalize] Starting finalization for question ${questionId}`);

  // =========================================================================
  // Step 1 — Read all segment counters from DynamoDB
  // =========================================================================
  const counters = await getSegmentCounters(questionId);
  console.log(`[Finalize] Step 1: Read ${counters.length} segment counters from DynamoDB`);

  if (counters.length === 0) {
    throw new Error(`No DynamoDB counters found for question ${questionId}. Has anyone voted?`);
  }

  // =========================================================================
  // Step 2 — Compute percentages and upsert into question_aggregates
  // =========================================================================
  let segmentsUpdated = 0;

  for (const counter of counters) {
    const total = counter.yes_count + counter.no_count + counter.abstain_count;
    const yesPct = total > 0 ? parseFloat(((counter.yes_count / total) * 100).toFixed(2)) : 0;
    const noPct = total > 0 ? parseFloat(((counter.no_count / total) * 100).toFixed(2)) : 0;

    // Determine segment_type and segment_value from the segment string
    let segmentType: string;
    let segmentValue: string;

    if (counter.segment.startsWith('country_')) {
      segmentType = 'country';
      segmentValue = counter.segment.replace('country_', '');
    } else if (counter.segment.startsWith('age_')) {
      segmentType = 'age_bucket';
      segmentValue = counter.segment.replace('age_', '');
    } else if (counter.segment === 'global_all') {
      segmentType = 'global';
      segmentValue = 'all';
    } else {
      console.warn(`[Finalize] Unknown segment format: ${counter.segment}, skipping`);
      continue;
    }

    try {
      await query(
        `INSERT INTO question_aggregates 
         (question_id, segment_type, segment_value, yes_count, 
          no_count, abstain_count, total_count, yes_pct, no_pct, 
          is_final, last_updated)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW())
         ON CONFLICT (question_id, segment_type, segment_value)
         DO UPDATE SET yes_count = EXCLUDED.yes_count,
           no_count = EXCLUDED.no_count,
           abstain_count = EXCLUDED.abstain_count,
           total_count = EXCLUDED.total_count,
           yes_pct = EXCLUDED.yes_pct,
           no_pct = EXCLUDED.no_pct,
           is_final = true,
           last_updated = NOW()`,
        [questionId, segmentType, segmentValue, counter.yes_count,
         counter.no_count, counter.abstain_count, total, yesPct, noPct],
      );
      segmentsUpdated++;
    } catch (err) {
      console.error(`[Finalize] Failed to upsert aggregate for ${counter.segment}:`, err);
    }
  }

  console.log(`[Finalize] Step 2: Upserted ${segmentsUpdated} aggregates into DSQL`);

  // =========================================================================
  // Step 3 — Score all unscored predictions
  // =========================================================================
  // Use two-query approach (fallback-safe for DSQL JOIN limitations)

  // 3a. Get all unscored predictions for this question
  const predictionsResult = await query(
    `SELECT prediction_id, player_id, target_segment_type, 
            target_segment_value, predicted_yes_pct
     FROM user_predictions 
     WHERE question_id = $1 AND scored_at IS NULL`,
    [questionId],
  );
  const predictions = predictionsResult.rows;
  console.log(`[Finalize] Step 3: Found ${predictions.length} unscored predictions`);

  // 3b. Get all aggregates for this question (to look up actual values)
  const aggregatesResult = await query(
    `SELECT segment_type, segment_value, yes_pct 
     FROM question_aggregates 
     WHERE question_id = $1 AND is_final = true`,
    [questionId],
  );

  // Build lookup map: "segment_type:segment_value" → yes_pct
  const aggregateMap = new Map<string, number>();
  for (const agg of aggregatesResult.rows) {
    const key = `${agg.segment_type}:${agg.segment_value}`;
    aggregateMap.set(key, parseFloat(agg.yes_pct));
  }

  // 3c. Score each prediction
  let predictionsScored = 0;
  for (const pred of predictions) {
    const key = `${pred.target_segment_type}:${pred.target_segment_value}`;
    const actualYesPct = aggregateMap.get(key);

    if (actualYesPct === undefined) {
      console.warn(`[Finalize] No aggregate found for ${key}, skipping prediction ${pred.prediction_id}`);
      continue;
    }

    const errorPoints = parseFloat(Math.abs(pred.predicted_yes_pct - actualYesPct).toFixed(1));
    const accuracyScore = computeAccuracyScore(errorPoints);

    try {
      await query(
        `UPDATE user_predictions 
         SET actual_yes_pct = $1, error_points = $2, 
             accuracy_score = $3, scored_at = NOW()
         WHERE prediction_id = $4`,
        [actualYesPct, errorPoints, accuracyScore, pred.prediction_id],
      );
      predictionsScored++;
    } catch (err) {
      console.error(`[Finalize] Failed to score prediction ${pred.prediction_id}:`, err);
    }
  }

  console.log(`[Finalize] Step 3: Scored ${predictionsScored} predictions`);

  // =========================================================================
  // Step 4 — Compute and update player empathy scores
  // =========================================================================
  // Get unique player_ids who had predictions scored
  const uniquePlayerIds = [...new Set(predictions.map((p) => p.player_id))];
  let playersUpdated = 0;

  for (const playerId of uniquePlayerIds) {
    try {
      // Get this player's scored predictions for this question
      const playerPreds = await query(
        `SELECT accuracy_score, error_points 
         FROM user_predictions 
         WHERE player_id = $1 AND question_id = $2 AND scored_at IS NOT NULL`,
        [playerId, questionId],
      );

      if (playerPreds.rows.length === 0) continue;

      const avgAccuracy = parseFloat(
        (playerPreds.rows.reduce((sum: number, r: any) => sum + Number(r.accuracy_score), 0) /
          playerPreds.rows.length
        ).toFixed(1),
      );

      const avgError = parseFloat(
        (playerPreds.rows.reduce((sum: number, r: any) => sum + Number(r.error_points), 0) /
          playerPreds.rows.length
        ).toFixed(1),
      );

      // Update user_question_results
      await query(
        `UPDATE user_question_results
         SET empathy_score = $1, avg_prediction_error = $2, scored_at = NOW()
         WHERE player_id = $3 AND question_id = $4`,
        [Math.round(avgAccuracy), avgError, playerId, questionId],
      );

      // Update player's overall stats
      await query(
        `UPDATE players SET
           total_empathy_score = total_empathy_score + $1,
           avg_empathy_score = (
             SELECT COALESCE(AVG(empathy_score), 0) 
             FROM user_question_results 
             WHERE player_id = $2 AND empathy_score IS NOT NULL
           ),
           avg_prediction_error = (
             SELECT COALESCE(AVG(avg_prediction_error), 0)
             FROM user_question_results
             WHERE player_id = $2 AND avg_prediction_error IS NOT NULL
           ),
           last_active_date = CURRENT_DATE
         WHERE player_id = $2`,
        [Math.round(avgAccuracy), playerId],
      );

      playersUpdated++;
    } catch (err) {
      console.error(`[Finalize] Failed to update player ${playerId}:`, err);
    }
  }

  console.log(`[Finalize] Step 4: Updated ${playersUpdated} players`);

  // =========================================================================
  // Step 5 — Mark question as finalized
  // =========================================================================
  // Find global yes/no pcts
  const globalCounter = counters.find((c) => c.segment === 'global_all');
  const globalYesPct = globalCounter?.yes_pct ?? 0;
  const globalNoPct = globalCounter?.no_pct ?? 0;

  // Compute divergence_score as standard deviation of country yes_pcts
  const countryYesPcts = counters
    .filter((c) => c.segment.startsWith('country_'))
    .map((c) => c.yes_pct)
    .filter((pct) => pct > 0); // Only include segments with actual votes

  const divergenceScore = standardDeviation(countryYesPcts);

  await query(
    `UPDATE questions 
     SET is_finalized = true, is_active = false,
         global_yes_pct = $1, global_no_pct = $2,
         divergence_score = $3
     WHERE question_id = $4`,
    [globalYesPct, globalNoPct, divergenceScore, questionId],
  );

  console.log(`[Finalize] Step 5: Question ${questionId} finalized. Divergence: ${divergenceScore}`);

  return {
    question_id: questionId,
    segments_updated: segmentsUpdated,
    predictions_scored: predictionsScored,
    players_updated: playersUpdated,
    divergence_score: divergenceScore,
    global_yes_pct: globalYesPct,
    global_no_pct: globalNoPct,
  };
}
