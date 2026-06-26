'use client'

import { useState } from 'react'
import { NavBar } from '@/components/nav-bar'
import { LeaderboardRow } from '@/components/leaderboard-row'
import { SplitBar } from '@/components/split-bar'
import { WeeklyInsightCard } from '@/components/weekly-insight-card'
import { LEADERBOARD, TODAY_QUESTION } from '@/lib/mock-data'

const TABS = ['Global', 'My Country', 'My Age Group'] as const
type Tab = (typeof TABS)[number]

const PAGE_SIZE = 8

export default function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>('Global')
  const [visible, setVisible] = useState(PAGE_SIZE)

  const rows = LEADERBOARD.slice(0, visible)
  const hasMore = visible < LEADERBOARD.length
  // Ensure the current user is always reachable; pin if outside the visible set.
  const currentUser = LEADERBOARD.find((e) => e.isCurrentUser)
  const currentUserVisible = rows.some((e) => e.isCurrentUser)

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
        <div className="mt-6 rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="truncate text-sm font-medium text-foreground">{TODAY_QUESTION.text}</p>
          <div className="mt-3">
            <SplitBar yes={TODAY_QUESTION.globalYes} no={TODAY_QUESTION.globalNo} height={10} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              <span className="font-semibold text-primary">{TODAY_QUESTION.globalYes}%</span> Yes ·{' '}
              <span className="font-semibold text-[var(--negative)]">{TODAY_QUESTION.globalNo}%</span>{' '}
              No
            </span>
            <span>{TODAY_QUESTION.participants.toLocaleString()} players answered today</span>
          </div>
        </div>

        {/* Table */}
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
            {rows.map((entry) => (
              <LeaderboardRow key={entry.rank} entry={entry} />
            ))}

            {/* Pinned current user if outside visible window */}
            {!currentUserVisible && currentUser && (
              <>
                <div className="px-4 py-2 text-center text-xs tracking-widest text-muted-foreground">
                  — — —
                </div>
                <LeaderboardRow entry={currentUser} />
              </>
            )}
          </div>
        </div>

        {hasMore && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface"
            >
              Show more
            </button>
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
