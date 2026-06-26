'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { RECENT_QUESTIONS, type VoteChoice } from '@/lib/mock-data'

const VOTE_COLOR: Record<VoteChoice, string> = {
  YES: 'text-primary',
  NO: 'text-[var(--negative)]',
  ABSTAIN: 'text-neutral',
}

export function RecentQuestionsTable() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="hidden grid-cols-[4rem_6rem_minmax(0,1fr)_4rem_5rem_5rem] gap-3 border-b border-border bg-surface px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid">
        <span>Date</span>
        <span>Topic</span>
        <span>Question</span>
        <span className="text-center">Vote</span>
        <span className="text-right">Empathy</span>
        <span className="text-right">Error</span>
      </div>

      <div className="divide-y divide-border">
        {RECENT_QUESTIONS.map((q, i) => {
          const isOpen = open === i
          return (
            <div key={i}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface md:grid-cols-[4rem_6rem_minmax(0,1fr)_4rem_5rem_5rem]"
              >
                <span className="hidden text-sm text-muted-foreground md:block">{q.date}</span>
                <span className="hidden text-xs md:block">
                  <span className="rounded-full bg-surface px-2 py-0.5 text-muted-foreground">
                    {q.topic}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm text-foreground">{q.question}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground md:hidden">
                    {q.date} · {q.topic}
                  </span>
                </span>
                <span className={`hidden text-center text-sm font-semibold md:block ${VOTE_COLOR[q.vote]}`}>
                  {q.vote}
                </span>
                <span className="hidden text-right text-sm font-bold tabular-nums text-amber md:block">
                  {q.empathyScore}
                </span>
                <span className="flex items-center justify-end gap-1 text-right text-sm tabular-nums text-muted-foreground">
                  ±{q.predictionError}
                  <ChevronDown
                    className={`size-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </span>
              </button>

              {isOpen && (
                <div className="gs-fade-in border-t border-border bg-surface px-4 py-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Prediction accuracy breakdown
                  </p>
                  <div className="flex flex-col gap-2">
                    {q.breakdown.map((b) => {
                      const err = Math.abs(b.actual - b.predicted)
                      return (
                        <div
                          key={b.label}
                          className="flex items-center justify-between rounded-lg bg-card px-3 py-2 text-sm"
                        >
                          <span className="font-medium text-foreground">{b.label}</span>
                          <span className="text-muted-foreground">
                            Predicted {b.predicted}% · Actual {b.actual}% ·{' '}
                            <span className="font-semibold text-foreground">{err} pt error</span>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
