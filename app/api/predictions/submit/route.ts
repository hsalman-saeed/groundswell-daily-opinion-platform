import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { query } from "@/lib/db/dsql"
import { hasPlayerVoted } from "@/lib/db/dynamo"

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { player_id } = session.user as any

    if (!player_id) {
      return NextResponse.json(
        { error: "Session missing player_id" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { question_id, predictions } = body

    if (!question_id || !predictions || !Array.isArray(predictions)) {
      return NextResponse.json(
        { error: "question_id and predictions array are required" },
        { status: 400 }
      )
    }

    // Validate player has voted first
    const voted = await hasPlayerVoted(question_id, player_id)
    if (!voted) {
      return NextResponse.json(
        { error: "You must vote on the question before submitting predictions" },
        { status: 403 }
      )
    }

    // Validate predictions array has exactly 2 items
    if (predictions.length !== 2) {
      return NextResponse.json(
        { error: "Exactly 2 demographic predictions are required" },
        { status: 400 }
      )
    }

    // Validate each prediction values
    for (const pred of predictions) {
      const { target_segment_type, target_segment_value, predicted_yes_pct } = pred

      if (!target_segment_type || !target_segment_value || predicted_yes_pct === undefined) {
        return NextResponse.json(
          { error: "Each prediction must have target_segment_type, target_segment_value, and predicted_yes_pct" },
          { status: 400 }
        )
      }

      if (target_segment_type !== "country" && target_segment_type !== "age_bucket") {
        return NextResponse.json(
          { error: "target_segment_type must be either 'country' or 'age_bucket'" },
          { status: 400 }
        )
      }

      const pct = Number(predicted_yes_pct)
      if (isNaN(pct) || pct < 0 || pct > 100) {
        return NextResponse.json(
          { error: "predicted_yes_pct must be a number between 0 and 100" },
          { status: 400 }
        )
      }
    }

    // Upsert predictions into DSQL
    for (const pred of predictions) {
      const { target_segment_type, target_segment_value, predicted_yes_pct } = pred
      await query(
        `INSERT INTO user_predictions (
          player_id, question_id, target_segment_type, 
          target_segment_value, predicted_yes_pct, created_at
        ) 
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (player_id, question_id, target_segment_type, target_segment_value) 
        DO UPDATE SET predicted_yes_pct = EXCLUDED.predicted_yes_pct`,
        [player_id, question_id, target_segment_type, target_segment_value, Number(predicted_yes_pct)]
      )
    }

    return NextResponse.json({
      success: true,
      message: "Predictions saved. Check back after midnight for your Empathy Score."
    })
  } catch (error: any) {
    console.error("Prediction Submission API error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    )
  }
}
