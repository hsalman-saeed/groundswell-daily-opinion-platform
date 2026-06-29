import { NextResponse } from "next/server"
import { query } from "@/lib/db/dsql"
import { getSegmentCounters } from "@/lib/db/dynamo"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ question_id: string }> }
) {
  try {
    const { question_id } = await params

    if (!question_id) {
      return NextResponse.json({ error: "question_id is required" }, { status: 400 })
    }

    // 1. Check if finalized in DSQL
    const qRes = await query(
      "SELECT is_finalized FROM questions WHERE question_id = $1",
      [question_id]
    )

    if (qRes.rows.length === 0) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }

    const is_finalized = qRes.rows[0].is_finalized

    if (is_finalized) {
      // Return final results from DSQL
      const aggRes = await query(
        `SELECT segment_type, segment_value, yes_count, no_count, abstain_count, total_count, yes_pct, no_pct, is_final 
         FROM question_aggregates 
         WHERE question_id = $1 
         ORDER BY segment_type, yes_pct DESC`,
        [question_id]
      )

      const dsqlRows = aggRes.rows
      const countries = dsqlRows
        .filter((r) => r.segment_type === "country")
        .map((r) => ({
          segment_value: r.segment_value,
          yes_pct: parseFloat(Number(r.yes_pct).toFixed(1)),
          no_pct: parseFloat(Number(r.no_pct).toFixed(1)),
          total_count: Number(r.total_count),
        }))
        // Ensure countries are sorted by yes_pct descending (already sorted by query, but good to ensure)
        .sort((a, b) => b.yes_pct - a.yes_pct)

      const age_groups = dsqlRows
        .filter((r) => r.segment_type === "age_bucket")
        .map((r) => ({
          segment_value: r.segment_value,
          yes_pct: parseFloat(Number(r.yes_pct).toFixed(1)),
          no_pct: parseFloat(Number(r.no_pct).toFixed(1)),
          total_count: Number(r.total_count),
        }))
        .sort((a, b) => b.yes_pct - a.yes_pct)

      const globalRow = dsqlRows.find((r) => r.segment_type === "global")
      const global = globalRow
        ? {
            segment_value: globalRow.segment_value,
            yes_pct: parseFloat(Number(globalRow.yes_pct).toFixed(1)),
            no_pct: parseFloat(Number(globalRow.no_pct).toFixed(1)),
            total_count: Number(globalRow.total_count),
          }
        : null

      return NextResponse.json({
        is_final: true,
        source: "dsql",
        countries,
        age_groups,
        global,
        last_updated: new Date().toISOString(),
      })
    } else {
      // Query live results from DynamoDB
      const dynamoCounters = await getSegmentCounters(question_id)

      const countries: any[] = []
      const age_groups: any[] = []
      let global: any = null

      for (const item of dynamoCounters) {
        const { segment, yes_count, no_count, abstain_count } = item as any
        const total = yes_count + no_count + abstain_count
        const yes_pct = total > 0 ? parseFloat(((yes_count / total) * 100).toFixed(1)) : 0.0
        const no_pct = total > 0 ? parseFloat(((no_count / total) * 100).toFixed(1)) : 0.0

        if (segment.startsWith("country_")) {
          countries.push({
            segment_value: segment.replace("country_", ""),
            yes_pct,
            no_pct,
            total_count: total,
          })
        } else if (segment.startsWith("age_")) {
          age_groups.push({
            segment_value: segment.replace("age_", ""),
            yes_pct,
            no_pct,
            total_count: total,
          })
        } else if (segment === "global_all") {
          global = {
            segment_value: "all",
            yes_pct,
            no_pct,
            total_count: total,
          }
        }
      }

      countries.sort((a, b) => b.yes_pct - a.yes_pct)
      age_groups.sort((a, b) => b.yes_pct - a.yes_pct)

      return NextResponse.json({
        is_final: false,
        source: "dynamodb",
        countries,
        age_groups,
        global,
        last_updated: new Date().toISOString(),
      })
    }
  } catch (error: any) {
    console.error("Results API error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    )
  }
}
