import { NextResponse } from "next/server"
import { query } from "@/lib/db/dsql"
import { hasPlayerVoted, initializeCountersForQuestion } from "@/lib/db/dynamo"
import { generateQuestionCandidates } from "@/lib/bedrock"
import { auth } from "@/auth"

export async function GET() {
  try {
    // Query today's active question
    let qRes = await query(
      `SELECT question_id, question_text, category, 
              release_date, is_active, is_finalized, total_participants,
              global_yes_pct, global_no_pct, global_abstain_pct
       FROM questions 
       WHERE release_date = CURRENT_DATE AND is_active = true
       LIMIT 1`
    )

    if (qRes.rows.length === 0) {
      console.log(`[Auto-healing] No question found for today. Checking if a question is already scheduled or generating a new one...`);
      try {
        const topics = ['Technology', 'Society', 'Economics', 'Environment', 'Healthcare', 'Culture', 'Geopolitics'];
        const randomTopic = topics[Math.floor(Math.random() * topics.length)];
        
        console.log(`[Auto-healing] Auto-generating question for topic: ${randomTopic}...`);
        const { candidates } = await generateQuestionCandidates(randomTopic, []);
        const candidate = candidates[0]; // Take the first candidate

        // Insert today's auto-generated question into DSQL
        const insertRes = await query(
          `INSERT INTO questions 
           (question_text, category, release_date, ai_generated, 
            bedrock_predicted_divergence, is_active, is_finalized, total_participants)
           VALUES ($1, $2, CURRENT_DATE, true, $3, true, false, 0)
           RETURNING question_id, question_text, category, release_date, 
                     is_active, is_finalized, total_participants`,
          [candidate.question_text, candidate.category, candidate.predicted_divergence_score || null]
        );
        
        const newQuestion = insertRes.rows[0];
        console.log(`[Auto-healing] Successfully inserted auto-generated question: ${newQuestion.question_id}`);

        // Initialize DynamoDB counters
        try {
          await initializeCountersForQuestion(newQuestion.question_id);
          console.log(`[Auto-healing] Initialized DynamoDB counters for: ${newQuestion.question_id}`);
        } catch (dynamoErr) {
          console.error(`[Auto-healing] DynamoDB counter initialization failed:`, dynamoErr);
        }

        qRes = {
          rows: [newQuestion],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: []
        };
      } catch (err: any) {
        // If a unique key violation occurs, it means another request inserted it concurrently.
        // Query for it again.
        console.warn(`[Auto-healing] Insert failed (likely concurrent request): ${err.message}. Re-fetching...`);
        qRes = await query(
          `SELECT question_id, question_text, category, 
                  release_date, is_active, is_finalized, total_participants,
                  global_yes_pct, global_no_pct, global_abstain_pct
           FROM questions 
           WHERE release_date = CURRENT_DATE AND is_active = true
           LIMIT 1`
        );
        if (qRes.rows.length === 0) {
          throw new Error('Failed to retrieve or auto-generate today\'s question.');
        }
      }
    }

    const question = qRes.rows[0]
    const question_id = question.question_id

    let has_voted = false
    let player_vote: string | null = null
    let player_results: any = null
    let player_predictions: any[] | null = null

    // Get user session
    const session = await auth()
    const player_id = session?.user?.player_id

    if (player_id) {
      has_voted = await hasPlayerVoted(question_id, player_id)

      if (has_voted) {
        // Get user vote result
        const voteRes = await query(
          `SELECT vote, empathy_score, avg_prediction_error 
           FROM user_question_results 
           WHERE player_id = $1 AND question_id = $2`,
          [player_id, question_id]
        )
        if (voteRes.rows.length > 0) {
          const resRow = voteRes.rows[0]
          player_vote = resRow.vote
          player_results = {
            empathy_score: resRow.empathy_score,
            avg_prediction_error: resRow.avg_prediction_error,
          }
        }

        // Get predictions
        const predRes = await query(
          `SELECT target_segment_type, target_segment_value, 
                  predicted_yes_pct, actual_yes_pct, error_points, 
                  accuracy_score 
           FROM user_predictions 
           WHERE player_id = $1 AND question_id = $2`,
          [player_id, question_id]
        )
        player_predictions = predRes.rows
      } else {
        // Check if predictions exist even if they haven't voted (though typically predictions follow vote)
        const predRes = await query(
          `SELECT target_segment_type, target_segment_value, 
                  predicted_yes_pct, actual_yes_pct, error_points, 
                  accuracy_score 
           FROM user_predictions 
           WHERE player_id = $1 AND question_id = $2`,
          [player_id, question_id]
        )
        player_predictions = predRes.rows.length > 0 ? predRes.rows : null
      }
    }

    // Window closes at today 23:59:59 UTC
    const now = new Date()
    const closingDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999))
    const window_closes_at = closingDate.toISOString()

    return NextResponse.json({
      question,
      has_voted,
      player_vote,
      player_results,
      player_predictions,
      window_closes_at,
    })
  } catch (error: any) {
    console.error("Today's Question API error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    )
  }
}
