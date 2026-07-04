import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { query } from "@/lib/db/dsql"
import { submitVote, hasPlayerVoted, DuplicateVoteError } from "@/lib/db/dynamo"

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { player_id, country_code, age_bucket } = session.user as any

    if (!player_id || !country_code || !age_bucket) {
      return NextResponse.json(
        { error: "Session missing player profile details (player_id, country_code, age_bucket)" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { question_id, vote } = body

    if (!question_id || !vote) {
      return NextResponse.json(
        { error: "question_id and vote are required" },
        { status: 400 }
      )
    }

    if (vote !== "YES" && vote !== "NO" && vote !== "ABSTAIN") {
      return NextResponse.json(
        { error: "Invalid vote choice. Must be YES, NO, or ABSTAIN" },
        { status: 400 }
      )
    }

    // Confirm question exists and is active
    const qCheck = await query(
      `SELECT question_id FROM questions 
       WHERE question_id = $1 AND is_active = true AND is_finalized = false`,
      [question_id]
    )

    if (qCheck.rows.length === 0) {
      return NextResponse.json(
        { error: "Question is not active or does not exist" },
        { status: 400 }
      )
    }

    // Check if player has already voted
    const alreadyVoted = await hasPlayerVoted(question_id, player_id)
    if (alreadyVoted) {
      return NextResponse.json(
        { error: "already_voted_today" },
        { status: 409 }
      )
    }

    // Ingest the vote into DynamoDB
    try {
      await submitVote(question_id, player_id, vote, country_code, age_bucket)
    } catch (err: any) {
      if (err instanceof DuplicateVoteError || err.name === "DuplicateVoteError") {
        return NextResponse.json(
          { error: "already_voted_today" },
          { status: 409 }
        )
      }
      throw err
    }

    // Insert result record in DSQL
    await query(
      `INSERT INTO user_question_results (player_id, question_id, vote, voted_at) 
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (player_id, question_id) DO NOTHING`,
      [player_id, question_id, vote]
    )

    // Update questions total_participants in DSQL
    await query(
      `UPDATE questions 
       SET total_participants = total_participants + 1 
       WHERE question_id = $1`,
      [question_id]
    )

    return NextResponse.json({
      success: true,
      vote,
      message: "Vote recorded. Now predict how others voted."
    })
  } catch (error: any) {
    console.error("Vote Submission API error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    )
  }
}
