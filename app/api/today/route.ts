import { NextResponse } from "next/server"
import { query } from "@/lib/db/dsql"
import { hasPlayerVoted } from "@/lib/db/dynamo"
import { auth } from "@/auth"
import { ensureTodayQuestion } from "@/lib/auto-generate"

export async function GET() {
  try {
    // Ensure an active question exists (auto-generates via Bedrock if needed)
    const ensured = await ensureTodayQuestion()

    if (!ensured) {
      return NextResponse.json({ error: "no_question_today" }, { status: 404 })
    }

    // Use the ensured question directly (it was either found or auto-generated)
    const question = ensured
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
