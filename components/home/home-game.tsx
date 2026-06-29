'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Check, Target, Loader2 } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { CountdownTimer } from '@/components/countdown-timer'
import { EmpathyScoreRing } from '@/components/empathy-score-ring'
import { PredictionSlider } from '@/components/prediction-slider'
import { SplitBar } from '@/components/split-bar'
import { VoteButtonSet } from '@/components/vote-button-set'
import { ResultsGrids } from '@/components/home/results-grids'

type GameState = 'pre-vote' | 'prediction' | 'live' | 'scored'

const VOTE_PILL: Record<string, string> = {
  YES: 'bg-blue-soft text-primary',
  NO: 'bg-[var(--negative)]/12 text-[var(--negative)]',
  ABSTAIN: 'bg-surface text-neutral',
}

export function HomeGame() {
  const router = useRouter()
  const { data: session, status: authStatus } = useSession()
  const isLoggedIn = authStatus === 'authenticated'

  const [loading, setLoading] = useState(true)
  const [question, setQuestion] = useState<any>(null)
  const [hasVoted, setHasVoted] = useState(false)
  const [vote, setVote] = useState<'YES' | 'NO' | 'ABSTAIN'>('YES')
  const [playerResults, setPlayerResults] = useState<any>(null)
  const [playerPredictions, setPlayerPredictions] = useState<any[] | null>(null)
  const [windowClosesAt, setWindowClosesAt] = useState<string>('')
  const [state, setState] = useState<GameState>('pre-vote')

  // Live results state
  const [resultsData, setResultsData] = useState<any>(null)

  // Sliders state
  const [predGermany, setPredGermany] = useState(50)
  const [predAgeRange, setPredAgeRange] = useState(50)

  // Timer targets derived from UTC clock
  const midnightUtc = useMemo(() => {
    if (windowClosesAt) {
      return new Date(windowClosesAt).getTime()
    }
    const now = new Date()
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0)
  }, [windowClosesAt])

  const nextHour = useMemo(() => {
    const now = new Date()
    return Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours() + 1,
      0,
      0
    )
  }, [])

  // Fetch today's question on mount
  useEffect(() => {
    async function loadTodayQuestion() {
      try {
        const res = await fetch('/api/today')
        if (res.status === 404) {
          setLoading(false)
          return
        }
        const data = await res.json()
        if (data.question) {
          setQuestion(data.question)
          setHasVoted(data.has_voted)
          setWindowClosesAt(data.window_closes_at)
          
          if (data.player_vote) {
            setVote(data.player_vote)
          }
          if (data.player_results) {
            setPlayerResults(data.player_results)
          }
          if (data.player_predictions) {
            setPlayerPredictions(data.player_predictions)
          }

          // Transition states based on db status
          if (data.has_voted) {
            if (data.question.is_finalized) {
              setState('scored')
            } else if (data.player_predictions && data.player_predictions.length > 0) {
              setState('live')
            } else {
              setState('prediction')
            }
          } else {
            setState('pre-vote')
          }
        }
      } catch (err) {
        console.error('Error loading today question:', err)
      } finally {
        setLoading(false)
      }
    }
    loadTodayQuestion()
  }, [authStatus])

  // Polling for live results in state === 'live' or 'scored'
  useEffect(() => {
    if (!question?.question_id) return
    if (state !== 'live' && state !== 'scored') return

    async function fetchResults() {
      try {
        const res = await fetch(`/api/results/${question.question_id}`)
        if (res.ok) {
          const data = await res.json()
          setResultsData(data)
        }
      } catch (err) {
        console.error('Error polling results:', err)
      }
    }

    fetchResults()
    const interval = setInterval(fetchResults, 10000)
    return () => clearInterval(interval)
  }, [state, question?.question_id])

  async function handleVote(choice: 'YES' | 'NO' | 'ABSTAIN') {
    if (!isLoggedIn) {
      router.push('/signin')
      return
    }

    try {
      const res = await fetch('/api/votes/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: question.question_id, vote: choice }),
      })

      if (res.status === 409) {
        // Already voted, refresh
        setHasVoted(true)
        setState('prediction')
        return
      }

      if (res.ok) {
        setVote(choice)
        setHasVoted(true)
        setState('prediction')
      }
    } catch (err) {
      console.error('Error submitting vote:', err)
    }
  }

  async function handleSubmitPredictions() {
    if (!isLoggedIn) {
      router.push('/signin')
      return
    }

    try {
      const payload = {
        question_id: question.question_id,
        predictions: [
          {
            target_segment_type: 'country',
            target_segment_value: 'DE',
            predicted_yes_pct: predGermany,
          },
          {
            target_segment_type: 'age_bucket',
            target_segment_value: '18-24',
            predicted_yes_pct: predAgeRange,
          },
        ],
      }

      const res = await fetch('/api/predictions/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        // Set player predictions locally so we display them
        setPlayerPredictions([
          {
            target_segment_type: 'country',
            target_segment_value: 'DE',
            predicted_yes_pct: predGermany,
          },
          {
            target_segment_type: 'age_bucket',
            target_segment_value: '18-24',
            predicted_yes_pct: predAgeRange,
          },
        ])
        setState('live')
      }
    } catch (err) {
      console.error('Error submitting predictions:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!question) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="text-lg font-semibold text-foreground">No active question today.</p>
        <p className="mt-1 text-sm text-muted-foreground">Check back later or check in tomorrow!</p>
      </div>
    )
  }

  // Calculate percentages for aggregate header
  const yesPct = resultsData?.global?.yes_pct ?? question.global_yes_pct ?? 0.0
  const noPct = resultsData?.global?.no_pct ?? question.global_no_pct ?? 0.0
  const participantsCount = resultsData?.global?.total_count ?? question.total_participants ?? 0

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12 lg:w-[60%] lg:max-w-2xl">
      <div className="gs-fade-in rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        {/* ---------- STATE A: PRE-VOTE ---------- */}
        {state === 'pre-vote' && (
          <>
            <span className="inline-flex items-center rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {question.category}
            </span>
            <h1 className="mt-3 text-pretty text-[22px] font-medium leading-snug text-foreground sm:text-2xl">
              {question.question_text}
            </h1>
            <p className="mt-4 text-sm text-muted-foreground">
              {participantsCount.toLocaleString()} players have answered today
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Closes in: <CountdownTimer target={midnightUtc} />
            </p>

            <div className="mt-6">
              <VoteButtonSet onVote={handleVote} />
            </div>

            {!isLoggedIn && (
              <div className="mt-6 rounded-lg bg-surface p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  You are viewing the daily question. You must{' '}
                  <Link href="/signin" className="font-semibold text-primary hover:underline">
                    Sign In
                  </Link>{' '}
                  to vote and earn Empathy points.
                </p>
              </div>
            )}

            <p className="mt-5 text-center text-xs text-muted-foreground">
              Your vote is never shown publicly. Only aggregated percentages are visible.
            </p>
          </>
        )}

        {/* ---------- STATE B: PREDICTION ---------- */}
        {state === 'prediction' && (
          <>
            <span className="inline-flex items-center rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {question.category}
            </span>
            <h1 className="mt-3 text-pretty text-[22px] font-medium leading-snug text-foreground sm:text-2xl">
              {question.question_text}
            </h1>

            <div className="mt-4">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${VOTE_PILL[vote]}`}
              >
                Your vote: {vote}
              </span>
            </div>

            <p className="mt-6 text-sm font-medium text-muted-foreground">Now predict how others voted</p>

            <div className="mt-4 flex flex-col gap-6">
              <PredictionSlider label="Germany" value={predGermany} onChange={setPredGermany} />
              <PredictionSlider label="Age 18–24" value={predAgeRange} onChange={setPredAgeRange} />
            </div>

            <button
              type="button"
              onClick={handleSubmitPredictions}
              className="mt-7 w-full rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-foreground transition-all hover:bg-primary-hover active:scale-[0.98]"
            >
              Submit Predictions
            </button>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Results reveal in: <CountdownTimer target={nextHour} />
            </p>
          </>
        )}

        {/* ---------- STATE C & D share the aggregate header ---------- */}
        {(state === 'live' || state === 'scored') && (
          <>
            <span className="inline-flex items-center rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {question.category}
            </span>
            <h1 className="mt-3 text-pretty text-[22px] font-medium leading-snug text-foreground sm:text-2xl">
              {question.question_text}
            </h1>

            {state === 'live' ? (
              <div className="mt-5 rounded-lg bg-amber-soft px-4 py-2.5 text-sm font-medium text-amber">
                Results so far — final tallies at midnight UTC
              </div>
            ) : (
              <p className="mt-5 text-sm font-semibold text-foreground">Today&apos;s Final Results</p>
            )}

            {/* Aggregate numbers */}
            <div className="mt-5 flex items-end justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Yes</p>
                <p className="text-4xl font-bold tabular-nums text-primary">{yesPct}%</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">No</p>
                <p className="text-4xl font-bold tabular-nums text-[var(--negative)]">
                  {noPct}%
                </p>
              </div>
            </div>
            <div className="mt-3">
              <SplitBar yes={yesPct} no={noPct} height={14} />
            </div>

            {/* STATE D: Empathy score card */}
            {state === 'scored' && playerResults && (
              <div className="mt-7 flex flex-col items-center gap-4 rounded-xl border border-border bg-surface p-6 sm:flex-row sm:gap-6">
                <EmpathyScoreRing score={playerResults.empathy_score || 0} size={128} showLabel={false} />
                <div className="text-center sm:text-left">
                  <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Your Empathy Score Today
                  </p>
                  <p className="mt-1 text-5xl font-bold tabular-nums text-amber">
                    {playerResults.empathy_score || 0}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Cumulative average error: ±{playerResults.avg_prediction_error || '0.0'} pts
                  </p>
                </div>
              </div>
            )}

            {/* STATE D: accuracy breakdown */}
            {state === 'scored' && playerPredictions && playerPredictions.length > 0 && (
              <div className="mt-6 flex flex-col gap-2">
                {playerPredictions.map((p) => {
                  const errorPoints = p.error_points !== null && p.error_points !== undefined
                    ? p.error_points
                    : Math.abs((p.actual_yes_pct ?? p.actual ?? 0) - (p.predicted_yes_pct ?? p.predicted ?? 0))
                  
                  const strong = errorPoints <= 5
                  const segmentLabel = p.target_segment_type === 'country'
                    ? 'Germany'
                    : 'Age 18–24'

                  return (
                    <div
                      key={p.target_segment_value}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
                    >
                      <span
                        className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                          strong
                            ? 'bg-[var(--emerald)]/15 text-[var(--emerald)]'
                            : 'bg-amber-soft text-amber'
                        }`}
                      >
                        {strong ? <Check className="size-4" /> : '!'}
                      </span>
                      <p className="text-sm text-foreground">
                        <span className="font-semibold">{segmentLabel}</span> — You predicted{' '}
                        {p.predicted_yes_pct ?? p.predicted}%, actual was {p.actual_yes_pct ?? p.actual}% — {errorPoints} point error —{' '}
                        <span
                          className={`inline-flex items-center gap-1 align-middle font-medium ${strong ? 'text-[var(--emerald)]' : 'text-amber'}`}
                        >
                          {strong ? (
                            <>
                              <Target className="size-3.5" aria-hidden="true" /> Strong
                            </>
                          ) : (
                            'Decent'
                          )}
                        </span>
                      </p>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Region + Age grids */}
            <div className="mt-7">
              <ResultsGrids
                countries={resultsData?.countries || []}
                ageGroups={resultsData?.age_groups || []}
                predictions={playerPredictions || []}
              />
            </div>

            {/* Footer actions */}
            {state === 'live' ? (
              <Link
                href="/leaderboard"
                className="mt-7 block w-full rounded-xl bg-primary py-3 text-center text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-hover active:scale-[0.98]"
              >
                See Full Leaderboard →
              </Link>
            ) : (
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/stats"
                  className="flex flex-1 items-center justify-center rounded-xl border border-border py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface"
                >
                  See Your Stats →
                </Link>
                <Link
                  href="/leaderboard"
                  className="flex flex-1 items-center justify-center rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-hover active:scale-[0.98]"
                >
                  See Leaderboard →
                </Link>
              </div>
            )}
          </>
        )}
      </div>

      {/* Demo-only state switcher (hidden in production but nice for testing) */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Preview state:</span>
        {(
          [
            ['pre-vote', 'A · Vote'],
            ['prediction', 'B · Predict'],
            ['live', 'C · Live'],
            ['scored', 'D · Scored'],
          ] as [GameState, string][]
        ).map(([s, label]) => (
          <button
            key={s}
            type="button"
            onClick={() => setState(s)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              state === s
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:bg-surface'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
