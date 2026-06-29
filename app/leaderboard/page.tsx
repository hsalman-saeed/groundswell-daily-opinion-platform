'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Loader2 } from 'lucide-react'
import { NavBar } from '@/components/nav-bar'
import { LeaderboardRow } from '@/components/leaderboard-row'
import { SplitBar } from '@/components/split-bar'
import { WeeklyInsightCard } from '@/components/weekly-insight-card'

const TABS = ['Global', 'My Country', 'My Age Group'] as const
type Tab = (typeof TABS)[number]

export default function LeaderboardPage() {
  const { data: session, status: authStatus } = useSession()
  const user = session?.user as any

  const [tab, setTab] = useState<Tab>('Global')
  const [loading, setLoading] = useState(true)
  const [rankings, setRankings] = useState<any[]>([])
  const [currentPlayerRank, setCurrentPlayerRank] = useState<any>(null)
  const [totalPlayers, setTotalPlayers] = useState(0)
  const [todayQuestion, setTodayQuestion] = useState<any>(null)

  // Load today's question for display
  useEffect(() => {
    fetch('/api/today')
      .then((res) => {
        if (res.ok) return res.json()
        return null
      })
      .then((data) => {
        if (data && data.question) {
          setTodayQuestion(data.question)
        }
      })
      .catch((err) => console.error('Error loading question for leaderboard:', err))
  }, [])

  // Load leaderboard rankings
  useEffect(() => {
    async function loadRankings() {
      setLoading(true)
      try {
        let url = '/api/leaderboard?scope=global'

        if (tab === 'My Country') {
          if (user?.country_code) {
            url = `/api/leaderboard?scope=country&filter=${user.country_code}`
          } else {
            setRankings([])
            setTotalPlayers(0)
            setLoading(false)
            return
          }
        } else if (tab === 'My Age Group') {
          if (user?.age_bucket) {
            url = `/api/leaderboard?scope=age_group&filter=${user.age_bucket}`
          } else {
            setRankings([])
            setTotalPlayers(0)
            setLoading(false)
            return
          }
        }

        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          setRankings(data.rankings || [])
          setCurrentPlayerRank(data.current_player_rank)
          setTotalPlayers(data.total_players || 0)
        }
      } catch (err) {
        console.error('Error loading rankings:', err)
      } finally {
        setLoading(false)
      }
    }

    if (authStatus !== 'loading') {
      loadRankings()
    }
  }, [tab, user?.country_code, user?.age_bucket, authStatus])

  const isLoggedIn = authStatus === 'authenticated'
  const isTabRestricted = tab !== 'Global' && !isLoggedIn
  const currentUserVisible = rankings.some((e) => e.isCurrentUser || e.player_id === user?.player_id)

  // Calculate percentages for question block
  const yesPct = todayQuestion?.global_yes_pct ?? 50
  const noPct = todayQuestion?.global_no_pct ?? 50
  const participantsCount = todayQuestion?.total_participants ?? 0

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-[28px] font-bold tracking-tight text-foreground">Empathy Leaderboard</h1>
        <p className="mt-1 text-muted-foreground">
          Ranked by cumulative prediction accuracy — not opinion
        </p>

        {/* Tabs */}
        <div className="mt-6 flex gap-6 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 pb-3 text-sm transition-colors ${
                tab === t
                  ? 'border-primary font-semibold text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Today's question context */}
        {todayQuestion && (
          <div className="mt-6 rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="truncate text-sm font-medium text-foreground">{todayQuestion.question_text}</p>
            <div className="mt-3">
              <SplitBar yes={yesPct} no={noPct} height={10} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                <span className="font-semibold text-primary">{yesPct}%</span> Yes ·{' '}
                <span className="font-semibold text-[var(--negative)]">{noPct}%</span> No
              </span>
              <span>{participantsCount.toLocaleString()} players answered today</span>
            </div>
          </div>
        )}

        {/* Table content / Loading / Restriction message */}
        {isTabRestricted ? (
          <div className="mt-8 rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <p className="font-semibold text-foreground">Sign In Required</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Please sign in to see rankings within your country or age group.
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
        ) : (
          <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {/* Header */}
            <div className="hidden grid-cols-[3rem_minmax(0,1fr)_8rem_5rem_6rem_6rem] gap-4 border-b border-border bg-surface px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
              <span className="text-center">Rank</span>
              <span>Player</span>
              <span>Country</span>
              <span className="text-right">Questions</span>
              <span className="text-right">Accuracy</span>
              <span className="text-right">Empathy</span>
            </div>

            <div className="divide-y divide-border">
              {rankings.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No ranked players yet in this category. Be the first!
                </div>
              ) : (
                rankings.map((entry) => {
                  const isCurrent = entry.player_id === user?.player_id
                  return (
                    <LeaderboardRow
                      key={entry.player_id}
                      entry={{
                        ...entry,
                        isCurrentUser: isCurrent,
                      }}
                    />
                  )
                })
              )}

              {/* Pinned current user if outside visible window */}
              {!currentUserVisible && currentPlayerRank && (
                <>
                  <div className="px-4 py-2 text-center text-xs tracking-widest text-muted-foreground">
                    — — —
                  </div>
                  <LeaderboardRow entry={currentPlayerRank} />
                </>
              )}
            </div>
          </div>
        )}

        {/* Weekly insight */}
        <div className="mt-8">
          <WeeklyInsightCard
            title="This Week's Biggest Cultural Divide"
            insights={[
              'Japan and Brazil disagreed most — averaging 48 percentage points apart across this week\u2019s questions.',
              'Gen Z and Boomers diverged on 6 out of 7 questions this week.',
            ]}
          />
        </div>
      </main>
    </div>
  )
}
