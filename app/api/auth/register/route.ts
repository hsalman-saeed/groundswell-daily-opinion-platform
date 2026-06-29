import { NextResponse } from "next/server"
import { query } from "@/lib/db/dsql"
import bcrypt from "bcryptjs"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { username, email, password, country_code, country_name, age_bucket } = body

    if (!username || !email || !password || !country_code || !country_name || !age_bucket) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      )
    }

    // Check if username is taken
    const usernameCheck = await query(
      "SELECT player_id FROM players WHERE username = $1",
      [username]
    )
    if (usernameCheck.rows.length > 0) {
      return NextResponse.json(
        { error: "Username is already taken" },
        { status: 400 }
      )
    }

    // Check if email is taken
    const emailCheck = await query(
      "SELECT player_id FROM players WHERE email = $1",
      [email]
    )
    if (emailCheck.rows.length > 0) {
      return NextResponse.json(
        { error: "Email is already taken" },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Insert new player
    const insertRes = await query(
      `INSERT INTO players (
        username, email, hashed_password, country_code, country_name, age_bucket,
        current_streak, longest_streak, total_questions_answered, total_empathy_score,
        avg_empathy_score, last_active_date
      ) VALUES ($1, $2, $3, $4, $5, $6, 0, 0, 0, 0, 0, CURRENT_DATE)
      RETURNING player_id, username`,
      [username, email, hashedPassword, country_code, country_name, age_bucket]
    )

    const newPlayer = insertRes.rows[0]

    return NextResponse.json(
      {
        player_id: newPlayer.player_id,
        username: newPlayer.username,
        message: "Registration successful"
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("Register API error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    )
  }
}
