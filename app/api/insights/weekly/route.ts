/**
 * GET /api/insights/weekly
 *
 * Computes weekly opinion insights:
 *   - Most divergent country pair
 *   - Most divisive question
 *   - Formatted insight text
 *
 * Uses application-code approach to avoid complex DSQL JOINs.
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/db/dsql';

// Country code → name map
const COUNTRY_NAMES: Record<string, string> = {
  DE: 'Germany', BR: 'Brazil', JP: 'Japan', PK: 'Pakistan',
  US: 'United States', IN: 'India', GB: 'United Kingdom',
  FR: 'France', KR: 'South Korea', NG: 'Nigeria',
  MX: 'Mexico', CN: 'China',
};

export async function GET() {
  try {
    // 1. Get this week's finalized questions
    const questionsResult = await query(
      `SELECT question_id, question_text, category, 
              divergence_score, release_date 
       FROM questions 
       WHERE release_date >= CURRENT_DATE - 7 
       AND is_finalized = true
       ORDER BY release_date DESC`
    );

    const questions = questionsResult.rows;

    if (questions.length === 0) {
      return NextResponse.json({
        success: true,
        questions_this_week: 0,
        most_divergent_country_pair: null,
        most_divisive_question: null,
        insight_text: 'No finalized questions this week yet. Check back after midnight!',
      });
    }

    // 2. Get all country aggregates for this week's questions
    const questionIds = questions.map((q) => q.question_id);
    
    // Build parameterized IN clause
    const placeholders = questionIds.map((_: string, i: number) => `$${i + 1}`).join(', ');
    const aggregatesResult = await query(
      `SELECT question_id, segment_type, segment_value, yes_pct
       FROM question_aggregates 
       WHERE question_id IN (${placeholders})
       AND segment_type = 'country'
       AND is_final = true`,
      questionIds,
    );

    // 3. Compute most divergent country pair (application-code approach)
    // Group aggregates by question_id
    const byQuestion = new Map<string, { segment_value: string; yes_pct: number }[]>();
    for (const agg of aggregatesResult.rows) {
      const list = byQuestion.get(agg.question_id) || [];
      list.push({ segment_value: agg.segment_value, yes_pct: parseFloat(agg.yes_pct) });
      byQuestion.set(agg.question_id, list);
    }

    // For each pair of countries, compute average divergence across all questions
    const pairDivergences = new Map<string, { total: number; count: number }>();

    for (const [, countryData] of byQuestion) {
      for (let i = 0; i < countryData.length; i++) {
        for (let j = i + 1; j < countryData.length; j++) {
          const a = countryData[i];
          const b = countryData[j];
          const key = [a.segment_value, b.segment_value].sort().join(':');
          const diff = Math.abs(a.yes_pct - b.yes_pct);
          const entry = pairDivergences.get(key) || { total: 0, count: 0 };
          entry.total += diff;
          entry.count += 1;
          pairDivergences.set(key, entry);
        }
      }
    }

    let mostDivergentPair: { country_a: string; country_b: string; avg_divergence: number } | null = null;
    let maxAvgDivergence = 0;

    for (const [key, value] of pairDivergences) {
      const avg = value.total / value.count;
      if (avg > maxAvgDivergence) {
        maxAvgDivergence = avg;
        const [a, b] = key.split(':');
        mostDivergentPair = {
          country_a: a,
          country_b: b,
          avg_divergence: parseFloat(avg.toFixed(1)),
        };
      }
    }

    // 4. Find the most divisive question (highest divergence_score)
    const mostDivisive = questions.reduce((prev, curr) => {
      const prevScore = parseFloat(prev.divergence_score) || 0;
      const currScore = parseFloat(curr.divergence_score) || 0;
      return currScore > prevScore ? curr : prev;
    }, questions[0]);

    // 5. Build insight text
    let insightText = '';
    if (mostDivergentPair) {
      const nameA = COUNTRY_NAMES[mostDivergentPair.country_a] || mostDivergentPair.country_a;
      const nameB = COUNTRY_NAMES[mostDivergentPair.country_b] || mostDivergentPair.country_b;
      insightText = `${nameA} and ${nameB} disagreed most this week, averaging ${mostDivergentPair.avg_divergence} percentage points apart across ${questions.length} questions.`;
    } else {
      insightText = `${questions.length} questions finalized this week.`;
    }

    return NextResponse.json({
      success: true,
      questions_this_week: questions.length,
      most_divergent_country_pair: mostDivergentPair
        ? {
            ...mostDivergentPair,
            country_a_name: COUNTRY_NAMES[mostDivergentPair.country_a] || mostDivergentPair.country_a,
            country_b_name: COUNTRY_NAMES[mostDivergentPair.country_b] || mostDivergentPair.country_b,
          }
        : null,
      most_divisive_question: mostDivisive
        ? {
            question_text: mostDivisive.question_text,
            divergence_score: parseFloat(mostDivisive.divergence_score) || 0,
            category: mostDivisive.category,
          }
        : null,
      insight_text: insightText,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Weekly Insights] Error:', message);
    return NextResponse.json(
      { error: message, success: false },
      { status: 500 },
    );
  }
}
