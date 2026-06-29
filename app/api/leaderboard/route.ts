import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { query } from "@/lib/db/dsql"

function getFlagEmoji(countryCode: string) {
  if (!countryCode || countryCode.length !== 2) return "🌍"
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = searchParams.get("scope") || "global"
    const filter = searchParams.get("filter") || ""
    const page = Math.max(1, Number(searchParams.get("page")) || 1)

    const limit = 50
    const offset = (page - 1) * limit

    let countQuery = "SELECT COUNT(*) as cnt FROM players WHERE total_questions_answered > 0"
    let countParams: any[] = []

    let listQuery = ""
    let listParams: any[] = []

    let userRankQuery = ""
    let userRankParams: any[] = []

    // Get current user session
    const session = await auth()
    const player_id = session?.user?.player_id

    if (scope === "country") {
      if (!filter) {
        return NextResponse.json({ error: "Filter (country code) is required for country scope" }, { status: 400 })
      }
      countQuery += " AND country_code = $1"
      countParams = [filter]

      listQuery = `
        WITH best_segments AS (
          SELECT player_id, target_segment_value as best_segment
          FROM (
            SELECT 
              player_id, 
              target_segment_value, 
              ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY AVG(error_points) ASC) as rn
            FROM user_predictions
            WHERE error_points IS NOT NULL
            GROUP BY player_id, target_segment_value
          ) sub
          WHERE rn = 1
        )
        SELECT 
          p.player_id, p.username, p.country_code, p.country_name, p.age_bucket,
          p.current_streak, p.total_questions_answered, p.avg_empathy_score, p.avg_prediction_error,
          bs.best_segment,
          RANK() OVER (ORDER BY p.avg_empathy_score DESC, p.avg_prediction_error ASC NULLS LAST) as global_rank
        FROM players p
        LEFT JOIN best_segments bs ON p.player_id = bs.player_id
        WHERE p.total_questions_answered > 0 AND p.country_code = $1
        ORDER BY global_rank
        LIMIT $2 OFFSET $3
      `
      listParams = [filter, limit, offset]

      if (player_id) {
        userRankQuery = `
          WITH ranked_players AS (
            SELECT 
              p.player_id, p.username, p.country_code, p.country_name, p.age_bucket,
              p.current_streak, p.total_questions_answered, p.avg_empathy_score, p.avg_prediction_error,
              RANK() OVER (ORDER BY p.avg_empathy_score DESC, p.avg_prediction_error ASC NULLS LAST) as rank_in_scope
            FROM players p
            WHERE p.total_questions_answered > 0 AND p.country_code = $1
          )
          SELECT * FROM ranked_players WHERE player_id = $2
        `
        userRankParams = [filter, player_id]
      }
    } else if (scope === "age_group") {
      if (!filter) {
        return NextResponse.json({ error: "Filter (age bucket) is required for age_group scope" }, { status: 400 })
      }
      countQuery += " AND age_bucket = $1"
      countParams = [filter]

      listQuery = `
        WITH best_segments AS (
          SELECT player_id, target_segment_value as best_segment
          FROM (
            SELECT 
              player_id, 
              target_segment_value, 
              ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY AVG(error_points) ASC) as rn
            FROM user_predictions
            WHERE error_points IS NOT NULL
            GROUP BY player_id, target_segment_value
          ) sub
          WHERE rn = 1
        )
        SELECT 
          p.player_id, p.username, p.country_code, p.country_name, p.age_bucket,
          p.current_streak, p.total_questions_answered, p.avg_empathy_score, p.avg_prediction_error,
          bs.best_segment,
          RANK() OVER (ORDER BY p.avg_empathy_score DESC, p.avg_prediction_error ASC NULLS LAST) as global_rank
        FROM players p
        LEFT JOIN best_segments bs ON p.player_id = bs.player_id
        WHERE p.total_questions_answered > 0 AND p.age_bucket = $1
        ORDER BY global_rank
        LIMIT $2 OFFSET $3
      `
      listParams = [filter, limit, offset]

      if (player_id) {
        userRankQuery = `
          WITH ranked_players AS (
            SELECT 
              p.player_id, p.username, p.country_code, p.country_name, p.age_bucket,
              p.current_streak, p.total_questions_answered, p.avg_empathy_score, p.avg_prediction_error,
              RANK() OVER (ORDER BY p.avg_empathy_score DESC, p.avg_prediction_error ASC NULLS LAST) as rank_in_scope
            FROM players p
            WHERE p.total_questions_answered > 0 AND p.age_bucket = $1
          )
          SELECT * FROM ranked_players WHERE player_id = $2
        `
        userRankParams = [filter, player_id]
      }
    } else {
      // Global scope
      listQuery = `
        WITH best_segments AS (
          SELECT player_id, target_segment_value as best_segment
          FROM (
            SELECT 
              player_id, 
              target_segment_value, 
              ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY AVG(error_points) ASC) as rn
            FROM user_predictions
            WHERE error_points IS NOT NULL
            GROUP BY player_id, target_segment_value
          ) sub
          WHERE rn = 1
        )
        SELECT 
          p.player_id, p.username, p.country_code, p.country_name, p.age_bucket,
          p.current_streak, p.total_questions_answered, p.avg_empathy_score, p.avg_prediction_error,
          bs.best_segment,
          RANK() OVER (ORDER BY p.avg_empathy_score DESC, p.avg_prediction_error ASC NULLS LAST) as global_rank
        FROM players p
        LEFT JOIN best_segments bs ON p.player_id = bs.player_id
        WHERE p.total_questions_answered > 0
        ORDER BY global_rank
        LIMIT $1 OFFSET $2
      `
      listParams = [limit, offset]

      if (player_id) {
        userRankQuery = `
          WITH ranked_players AS (
            SELECT 
              p.player_id, p.username, p.country_code, p.country_name, p.age_bucket,
              p.current_streak, p.total_questions_answered, p.avg_empathy_score, p.avg_prediction_error,
              RANK() OVER (ORDER BY p.avg_empathy_score DESC, p.avg_prediction_error ASC NULLS LAST) as rank_in_scope
            FROM players p
            WHERE p.total_questions_answered > 0
          )
          SELECT * FROM ranked_players WHERE player_id = $1
        `
        userRankParams = [player_id]
      }
    }

    // Execute queries
    const countRes = await query(countQuery, countParams)
    const total_players = parseInt(countRes.rows[0]?.cnt || "0", 10)

    const listRes = await query(listQuery, listParams)

    // Map rankings list with flag emojis
    const rankings = listRes.rows.map((row) => ({
      player_id: row.player_id,
      username: row.username,
      country_code: row.country_code,
      country_name: row.country_name,
      flag: getFlagEmoji(row.country_code),
      current_streak: row.current_streak,
      total_questions_answered: row.total_questions_answered,
      avg_empathy_score: parseFloat(Number(row.avg_empathy_score).toFixed(1)),
      avg_prediction_error: row.avg_prediction_error !== null ? parseFloat(Number(row.avg_prediction_error).toFixed(1)) : 0.0,
      global_rank: parseInt(row.global_rank, 10),
      rank: parseInt(row.global_rank, 10), // alias for rank
      bestSegment: row.best_segment || "Global",
    }))

    let current_player_rank: any = null

    if (player_id && userRankQuery) {
      const userRankRes = await query(userRankQuery, userRankParams)
      if (userRankRes.rows.length > 0) {
        const uRow = userRankRes.rows[0]
        let userBestSegment = "Global"
        const bestRes = await query(
          `SELECT target_segment_value 
           FROM user_predictions 
           WHERE player_id = $1 AND error_points IS NOT NULL 
           GROUP BY target_segment_value 
           ORDER BY AVG(error_points) ASC LIMIT 1`,
          [player_id]
        )
        if (bestRes.rows.length > 0) {
          userBestSegment = bestRes.rows[0].target_segment_value
        }

        current_player_rank = {
          player_id: uRow.player_id,
          username: uRow.username,
          country_code: uRow.country_code,
          country_name: uRow.country_name,
          flag: getFlagEmoji(uRow.country_code),
          current_streak: uRow.current_streak,
          total_questions_answered: uRow.total_questions_answered,
          avg_empathy_score: parseFloat(Number(uRow.avg_empathy_score).toFixed(1)),
          avg_prediction_error: uRow.avg_prediction_error !== null ? parseFloat(Number(uRow.avg_prediction_error).toFixed(1)) : 0.0,
          rank: parseInt(uRow.rank_in_scope, 10),
          global_rank: parseInt(uRow.rank_in_scope, 10),
          bestSegment: userBestSegment,
          isCurrentUser: true,
        }
      }
    }

    return NextResponse.json({
      rankings,
      current_player_rank,
      total_players,
      scope,
    })
  } catch (error: any) {
    console.error("Leaderboard API error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    )
  }
}
