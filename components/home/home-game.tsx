'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Check, Target } from 'lucide-react'
import { CountdownTimer } from '@/components/countdown-timer'
import { EmpathyScoreRing } from '@/components/empathy-score-ring'
import { PredictionSlider } from '@/components/prediction-slider'
import { SplitBar } from '@/components/split-bar'
import { VoteButtonSet } from '@/components/vote-button-set'
import { ResultsGrids } from '@/components/home/results-grids'
import { CURRENT_USER, TODAY_QUESTION, type VoteChoice } from '@/lib/mock-data'

type GameState = 'pre-vote' | 'prediction' | 'live' | 'scored'

const VOTE_PILL: Record<VoteChoice, string> = {
  YES: 'bg-blue-soft text-primary',
  NO: 'bg-[var(--negative)]/12 text-[var(--negative)]',
  ABSTAIN: 'bg-surface text-neutral',
}

function CategoryBadge({ small }: { small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-surface font-medium text-muted-foreground ${
        small ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      }`}
    >
      {TODAY_QUESTION.category}
    </span>
  )
}

function QuestionHeading() {
  return (
    <>
      <CategoryBadge />
      <h1 className="mt-3 text-pretty text-[22px] font-medium leading-snug text-foreground sm:text-2xl">
        {TODAY_QUESTION.text}
      </h1>
    </>
  )
}

export function HomeGame() {
  const [state, setState] = useState<GameState>('pre-vote')
  const [vote, setVote] = useState<VoteChoice>('YES')
  const [predEurope, setPredEurope] = useState(50)
  const [predAge, setPredAge] = useState(50)

  // Targets derived from UTC clock.
  const midnightUtc = useMemo(() => {
    const now = new Date()
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0)
  }, [])
  const nextHour = useMemo(() => {
    const now = new Date()
    return Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours() + 1,
      0,
      0,
    )
  }, [])

  function handleVote(choice: VoteChoice) {
    setVote(choice)
    setState('prediction')
  }

  function handleSubmitPredictions() {
    setState('live')
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12 lg:w-[60%] lg:max-w-2xl">
      <div className="gs-fade-in rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        {/* ---------- STATE A: PRE-VOTE ---------- */}
        {state === 'pre-vote' && (
          <>
            <QuestionHeading />
            <p className="mt-4 text-sm text-muted-foreground">
              {TODAY_QUESTION.participants.toLocaleString()} players have answered today
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Closes in: <CountdownTimer target={midnightUtc} />
            </p>

            <div className="mt-6">
              <VoteButtonSet onVote={handleVote} />
            </div>

            <p className="mt-5 text-center text-xs text-muted-foreground">
              Your vote is never shown publicly. Only aggregated percentages are visible.
            </p>
          </>
        )}

        {/* ---------- STATE B: PREDICTION ---------- */}
        {state === 'prediction' && (
          <>
            <QuestionHeading />

            <div className="mt-4">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${VOTE_PILL[vote]}`}
              >
                Your vote: {vote}
              </span>
            </div>

            <p className="mt-6 text-sm font-medium text-muted-foreground">Now predict how others voted</p>

            <div className="mt-4 flex flex-col gap-6">
              <PredictionSlider label="Europe" value={predEurope} onChange={setPredEurope} />
              <PredictionSlider label="Age 18–24" value={predAge} onChange={setPredAge} />
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
            <QuestionHeading />

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
                <p className="text-4xl font-bold tabular-nums text-primary">{TODAY_QUESTION.globalYes}%</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">No</p>
                <p className="text-4xl font-bold tabular-nums text-[var(--negative)]">
                  {TODAY_QUESTION.globalNo}%
                </p>
              </div>
            </div>
            <div className="mt-3">
              <SplitBar yes={TODAY_QUESTION.globalYes} no={TODAY_QUESTION.globalNo} height={14} />
            </div>

            {/* STATE D: Empathy score card */}
            {state === 'scored' && (
              <div className="mt-7 flex flex-col items-center gap-4 rounded-xl border border-border bg-surface p-6 sm:flex-row sm:gap-6">
                <EmpathyScoreRing score={CURRENT_USER.empathyToday} size={128} showLabel={false} />
                <div className="text-center sm:text-left">
                  <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Your Empathy Score Today
                  </p>
                  <p className="mt-1 text-5xl font-bold tabular-nums text-amber">
                    {CURRENT_USER.empathyToday}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Better than {CURRENT_USER.betterThan}% of players today
                  </p>
                </div>
              </div>
            )}

            {/* STATE D: accuracy breakdown */}
            {state === 'scored' && (
              <div className="mt-6 flex flex-col gap-2">
                {CURRENT_USER.predictions.map((p) => {
                  const strong = p.error <= 5
                  return (
                    <div
                      key={p.label}
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
                        <span className="font-semibold">{p.label}</span> — You predicted{' '}
                        {p.predicted}%, actual was {p.actual}% — {p.error} point error —{' '}
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
              <ResultsGrids />
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

      {/* Demo-only state switcher */}
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
