import { NextResponse } from "next/server"
import { query } from "@/lib/db/dsql"

const countryNames: Record<string, string> = {
  US: "United States",
  DE: "Germany",
  IN: "India",
  BR: "Brazil",
  JP: "Japan",
  PK: "Pakistan",
  GB: "United Kingdom",
  FR: "France",
  KR: "South Korea",
  NG: "Nigeria",
  MX: "Mexico",
  CN: "China",
  FI: "Finland",
  AU: "Australia",
  CA: "Canada",
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ player_id: string }> }
) {
  try {
    const { player_id } = await params

    if (!player_id) {
      return NextResponse.json({ error: "player_id is required" }, { status: 400 })
    }

    // 1. Get player profile
    const pRes = await query(
      `SELECT player_id, username, country_code, country_name, 
              age_bucket, current_streak, longest_streak, 
              total_questions_answered, total_empathy_score, 
              avg_empathy_score, avg_prediction_error, 
              last_active_date, joined_at
       FROM players WHERE player_id = $1`,
      [player_id]
    )

    if (pRes.rows.length === 0) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const player = pRes.rows[0]

    // 2. Query last 20 question results
    let recentRows: any[] = []
    try {
      // Attempt JOIN query
      const joinRes = await query(
        `SELECT 
          uqr.result_id,
          uqr.vote,
          uqr.empathy_score,
          uqr.avg_prediction_error,
          uqr.voted_at,
          uqr.question_id,
          q.question_text,
          q.category,
          q.release_date,
          q.global_yes_pct
        FROM user_question_results uqr
        JOIN questions q ON uqr.question_id = q.question_id
        WHERE uqr.player_id = $1
        ORDER BY uqr.voted_at DESC
        LIMIT 20`,
        [player_id]
      )
      recentRows = joinRes.rows
    } catch (joinError) {
      console.warn("DSQL JOIN failed, attempting fallback multi-query selection:", joinError)
      // Fallback: Query results first
      const resultsRes = await query(
        `SELECT result_id, vote, empathy_score, avg_prediction_error, voted_at, question_id
         FROM user_question_results
         WHERE player_id = $1
         ORDER BY voted_at DESC
         LIMIT 20`,
        [player_id]
      )

      const results = resultsRes.rows
      if (results.length > 0) {
        const questionIds = results.map((r) => r.question_id)
        // Query questions matching the IDs
        const questionsRes = await query(
          `SELECT question_id, question_text, category, release_date, global_yes_pct
           FROM questions
           WHERE question_id = ANY($1::uuid[])`,
          [questionIds]
        )

        const questionsMap = new Map(questionsRes.rows.map((q) => [q.question_id, q]))
        recentRows = results.map((r) => {
          const q = questionsMap.get(r.question_id) || {}
          return {
            ...r,
            question_text: q.question_text,
            category: q.category,
            release_date: q.release_date,
            global_yes_pct: q.global_yes_pct,
          }
        })
      }
    }

    // Enhance recent questions with their predictions breakdown via a single batch query
    const recent_questions = []
    if (recentRows.length > 0) {
      const questionIds = recentRows.map((r) => r.question_id)
      const predRes = await query(
        `SELECT question_id, target_segment_type, target_segment_value, predicted_yes_pct, actual_yes_pct, error_points, accuracy_score
         FROM user_predictions
         WHERE player_id = $1 AND question_id = ANY($2::uuid[])`,
        [player_id, questionIds]
      )

      const predictionsByQuestion = new Map<string, any[]>()
      for (const p of predRes.rows) {
        if (!predictionsByQuestion.has(p.question_id)) {
          predictionsByQuestion.set(p.question_id, [])
        }
        predictionsByQuestion.get(p.question_id)!.push(p)
      }

      for (const row of recentRows) {
        const preds = predictionsByQuestion.get(row.question_id) || []
        const breakdown = preds.map((p) => {
          const label = p.target_segment_type === "country"
            ? (countryNames[p.target_segment_value] || p.target_segment_value)
            : `Age ${p.target_segment_value}`

          return {
            label,
            predicted: parseFloat(Number(p.predicted_yes_pct).toFixed(1)),
            actual: p.actual_yes_pct !== null ? parseFloat(Number(p.actual_yes_pct).toFixed(1)) : 0.0,
          }
        })

        // Format date like "Jun 25"
        const dateObj = new Date(row.voted_at || row.release_date)
        const formattedDate = dateObj.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })

        recent_questions.push({
          date: formattedDate,
          topic: row.category || "Society",
          question: row.question_text || "",
          vote: row.vote,
          empathyScore: row.empathy_score || 0,
          predictionError: row.avg_prediction_error !== null ? parseFloat(Number(row.avg_prediction_error).toFixed(1)) : 0.0,
          breakdown,
        })
      }
    }

    // 3. Query accuracy by demographic segment
    const accRes = await query(
      `SELECT 
        target_segment_type,
        target_segment_value,
        COUNT(*) as total_predictions,
        AVG(error_points) as avg_error,
        COUNT(CASE WHEN error_points <= 5 THEN 1 END) as excellent_predictions
      FROM user_predictions
      WHERE player_id = $1 AND error_points IS NOT NULL
      GROUP BY target_segment_type, target_segment_value
      ORDER BY avg_error ASC`,
      [player_id]
    )

    const demographic_accuracy = accRes.rows.map((row, index) => {
      const avgError = parseFloat(Number(row.avg_error).toFixed(1))
      let rating = "Blind spot"
      if (avgError <= 3.5) rating = "Excellent"
      else if (avgError <= 5.5) rating = "Strong"
      else if (avgError <= 8.0) rating = "Good"
      else if (avgError <= 12.0) rating = "Room to grow"

      const label = row.target_segment_type === "country"
        ? (countryNames[row.target_segment_value] || row.target_segment_value)
        : `Age ${row.target_segment_value}`

      return {
        rank: index + 1,
        label,
        error: avgError,
        rating,
        accuracy: Math.max(0, Math.min(100, Math.round(100 - avgError * 5))),
      }
    })

    const best_segment = demographic_accuracy.length > 0 ? demographic_accuracy[0] : null
    const worst_segment = demographic_accuracy.length > 0 ? demographic_accuracy[demographic_accuracy.length - 1] : null

    return NextResponse.json({
      player: {
        player_id: player.player_id,
        username: player.username,
        country_code: player.country_code,
        country_name: player.country_name,
        age_bucket: player.age_bucket,
        current_streak: player.current_streak || 0,
        longest_streak: player.longest_streak || 0,
        total_questions_answered: player.total_questions_answered || 0,
        total_empathy_score: player.total_empathy_score || 0,
        avg_empathy_score: parseFloat(Number(player.avg_empathy_score).toFixed(1)),
        avg_prediction_error: player.avg_prediction_error !== null ? parseFloat(Number(player.avg_prediction_error).toFixed(1)) : null,
        joined_at: new Date(player.joined_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      },
      recent_questions,
      demographic_accuracy,
      best_segment,
      worst_segment,
    })
  } catch (error: any) {
    console.error("Stats API error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    )
  }
}
