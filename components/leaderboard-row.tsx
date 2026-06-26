import { Medal } from 'lucide-react'
import type { LeaderboardEntry } from '@/lib/mock-data'

const MEDAL_COLORS: Record<number, string> = {
  1: 'text-amber',
  2: 'text-muted-foreground',
  3: 'text-[var(--bronze)]',
}

export function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  const { rank, username, flag, country, questions, avgError, empathyScore, bestSegment, isCurrentUser } =
    entry
  const topThree = rank <= 3

  return (
    <div
      className={`grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-3 py-3 sm:grid-cols-[3rem_minmax(0,1fr)_8rem_5rem_6rem_6rem] sm:gap-4 sm:px-4 ${
        isCurrentUser ? 'border-l-2 border-l-primary bg-blue-soft' : ''
      }`}
    >
      {/* Rank */}
      <div className="flex justify-center text-base font-bold tabular-nums text-foreground">
        {topThree ? (
          <Medal className={`size-5 ${MEDAL_COLORS[rank]}`} aria-label={`Rank ${rank}`} />
        ) : (
          `#${rank}`
        )}
      </div>

      {/* Player */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-foreground">{username}</span>
          {isCurrentUser && (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
              You
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">Best at: {bestSegment}</p>
      </div>

      {/* Country */}
      <div className="hidden items-center gap-2 text-sm text-foreground sm:flex">
        <span aria-hidden="true">{flag}</span>
        <span className="truncate">{country}</span>
      </div>

      {/* Questions */}
      <div className="hidden text-right text-sm tabular-nums text-foreground sm:block">
        {questions}
      </div>

      {/* Accuracy */}
      <div className="hidden text-right text-sm tabular-nums text-muted-foreground sm:block">
        ±{avgError.toFixed(1)} pts
      </div>

      {/* Empathy score */}
      <div
        className={`text-right text-lg font-bold tabular-nums ${
          topThree ? 'text-amber' : 'text-foreground'
        }`}
      >
        {empathyScore}
      </div>
    </div>
  )
}
