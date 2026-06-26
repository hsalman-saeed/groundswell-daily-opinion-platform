import { Flame } from 'lucide-react'
import { NavBar } from '@/components/nav-bar'
import { RecentQuestionsTable } from '@/components/stats/recent-questions-table'
import { CURRENT_USER, DEMOGRAPHIC_STRENGTHS, RECENT_QUESTIONS } from '@/lib/mock-data'

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
  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-[28px] font-bold tracking-tight text-foreground">Your Empathy Profile</h1>
        <p className="mt-1 text-muted-foreground">Understanding others since {CURRENT_USER.joined}</p>

        {/* Stat cards */}
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Current Streak"
            value={
              <span className="flex items-center gap-1.5">
                <Flame className="size-6 text-amber" />
                {CURRENT_USER.streak}
              </span>
            }
            sub="day streak"
            accent
          />
          <StatCard label="Total Questions" value={119} sub="answered" />
          <StatCard label="Avg Empathy Score" value={84} sub="out of 100" accent />
          <StatCard label="Avg Prediction Error" value={`±7.3`} sub="pts per demographic" />
        </div>

        {/* Demographic strengths */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-foreground">Your Demographic Strengths</h2>
          <div className="mt-4 flex flex-col gap-2">
            {DEMOGRAPHIC_STRENGTHS.map((d) => (
              <div
                key={d.rank}
                className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
              >
                <span className="w-5 shrink-0 text-sm font-bold tabular-nums text-muted-foreground">
                  {d.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-medium text-foreground">{d.label}</span>
                    <span className={`shrink-0 text-sm font-medium ${RATING_COLOR[d.rating]}`}>
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
            ))}
          </div>
        </section>

        {/* Blind spot */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-foreground">Your Biggest Blind Spot</h2>
          <div className="mt-3 rounded-xl border border-border border-l-4 border-l-amber bg-amber-soft p-5">
            <p className="text-sm font-semibold text-amber">East Asia · ±14.7 pts average</p>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground">
              You consistently underestimate how strongly East Asia responds to regulation questions.
            </p>
          </div>
        </section>

        {/* Recent questions */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-foreground">Recent Questions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your last {RECENT_QUESTIONS.length} questions — tap a row for the full breakdown.
          </p>
          <div className="mt-4">
            <RecentQuestionsTable />
          </div>
        </section>
      </main>
    </div>
  )
}
