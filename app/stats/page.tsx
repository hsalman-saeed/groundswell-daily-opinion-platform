'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Flame, Loader2 } from 'lucide-react'
import { NavBar } from '@/components/nav-bar'
import { RecentQuestionsTable } from '@/components/stats/recent-questions-table'

const RATING_COLOR: Record<string, string> = {
  Excellent: 'text-[var(--emerald)]',
  Strong: 'text-[var(--emerald)]',
  Good: 'text-primary',
  'Room to grow': 'text-amber',
  'Blind spot': 'text-[var(--negative)]',
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: React.ReactNode
  sub: string
  accent?: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${accent ? 'text-amber' : 'text-foreground'}`}>
        {value}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
    </div>
  )
}

export default function StatsPage() {
  const { data: session, status: authStatus } = useSession()
  const user = session?.user as any

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [recentQuestions, setRecentQuestions] = useState<any[]>([])
  const [demographicAccuracy, setDemographicAccuracy] = useState<any[]>([])
  const [bestSegment, setBestSegment] = useState<any>(null)
  const [worstSegment, setWorstSegment] = useState<any>(null)

  useEffect(() => {
    async function loadStats() {
      if (!user?.player_id) return
      setLoading(true)
      try {
        const res = await fetch(`/api/stats/${user.player_id}`)
        if (res.ok) {
          const data = await res.json()
          setProfile(data.player)
          setRecentQuestions(data.recent_questions || [])
          setDemographicAccuracy(data.demographic_accuracy || [])
          setBestSegment(data.best_segment)
          setWorstSegment(data.worst_segment)
        }
      } catch (err) {
        console.error('Error loading stats:', err)
      } finally {
        setLoading(false)
      }
    }

    if (authStatus === 'authenticated') {
      loadStats()
    } else if (authStatus === 'unauthenticated') {
      setLoading(false)
    }
  }, [user?.player_id, authStatus])

  const isLoggedIn = authStatus === 'authenticated'

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-[28px] font-bold tracking-tight text-foreground">Your Empathy Profile</h1>

        {authStatus === 'loading' ? (
          <div className="mt-12 flex items-center justify-center">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : !isLoggedIn ? (
          <div className="mt-8 rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <p className="font-semibold text-foreground">Sign In Required</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Please sign in to view your empathy profile, streaks, and prediction breakdown.
            </p>
            <Link
              href="/signin"
              className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-hover"
            >
              Sign In
            </Link>
          </div>
        ) : loading ? (
          <div className="mt-12 flex items-center justify-center">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : profile ? (
          <>
            <p className="mt-1 text-muted-foreground">Understanding others since {profile.joined_at}</p>

            {/* Stat cards */}
            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                label="Current Streak"
                value={
                  <span className="flex items-center gap-1.5">
                    <Flame className="size-6 text-amber" />
                    {profile.current_streak}
                  </span>
                }
                sub={`Longest: ${profile.longest_streak || 0} days`}
                accent
              />
              <StatCard label="Total Questions" value={profile.total_questions_answered} sub="answered" />
              <StatCard label="Avg Empathy Score" value={profile.avg_empathy_score || '0'} sub="out of 100" accent />
              <StatCard
                label="Avg Prediction Error"
                value={profile.avg_prediction_error !== null ? `±${profile.avg_prediction_error}` : '—'}
                sub="pts per demographic"
              />
            </div>

            {/* Demographic strengths */}
            <section className="mt-10">
              <h2 className="text-lg font-semibold text-foreground">Your Demographic Strengths</h2>
              <div className="mt-4 flex flex-col gap-2">
                {demographicAccuracy.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Demographic accuracy breakdown will appear once your questions are scored at midnight.
                  </p>
                ) : (
                  demographicAccuracy.map((d) => (
                    <div
                      key={d.label}
                      className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
                    >
                      <span className="w-5 shrink-0 text-sm font-bold tabular-nums text-muted-foreground">
                        {d.rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate font-medium text-foreground">{d.label}</span>
                          <span className={`shrink-0 text-sm font-medium ${RATING_COLOR[d.rating] || 'text-primary'}`}>
                            {d.rating}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${d.accuracy}%` }}
                            />
                          </div>
                          <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                            ±{d.error} pts avg
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Blind spot / Best segment */}
            {bestSegment && worstSegment && (
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <section>
                  <h2 className="text-lg font-semibold text-foreground">Your Greatest Strength</h2>
                  <div className="mt-3 rounded-xl border border-border border-l-4 border-l-[var(--emerald)] bg-[var(--emerald)]/5 p-5">
                    <p className="text-sm font-semibold text-[var(--emerald)]">
                      {bestSegment.label} · ±{bestSegment.error} pts average
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-foreground">
                      You are highly empathetic and accurate when predicting predictions for the {bestSegment.label} segment.
                    </p>
                  </div>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-foreground">Your Biggest Blind Spot</h2>
                  <div className="mt-3 rounded-xl border border-border border-l-4 border-l-[var(--negative)] bg-[var(--negative)]/5 p-5">
                    <p className="text-sm font-semibold text-[var(--negative)]">
                      {worstSegment.label} · ±{worstSegment.error} pts average
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-foreground">
                      You have the largest margin of error when predicting responses for the {worstSegment.label} segment.
                    </p>
                  </div>
                </section>
              </div>
            )}

            {/* Recent questions */}
            <section className="mt-10">
              <h2 className="text-lg font-semibold text-foreground">Recent Questions</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your last {recentQuestions.length} questions — tap a row for the prediction breakdown.
              </p>
              <div className="mt-4">
                <RecentQuestionsTable questions={recentQuestions} />
              </div>
            </section>
          </>
        ) : (
          <div className="mt-12 text-center text-sm text-muted-foreground">
            Failed to load profile. Please try again.
          </div>
        )}
      </main>
    </div>
  )
}
