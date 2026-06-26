'use client'

import { useState } from 'react'
import { Check, Loader2, Sparkles } from 'lucide-react'
import { NavBar } from '@/components/nav-bar'
import { QuestionStatusBadge } from '@/components/question-status-badge'
import { SplitBar } from '@/components/split-bar'
import {
  CANDIDATE_QUESTIONS,
  TODAY_QUESTION,
  TOPICS,
  type Candidate,
  type Topic,
} from '@/lib/mock-data'

const HISTORY = [
  { date: 'Jun 25', topic: 'Society', participants: 13902, avgYes: 64, divergence: 7.1 },
  { date: 'Jun 24', topic: 'Environment', participants: 12488, avgYes: 72, divergence: 5.8 },
  { date: 'Jun 23', topic: 'Economics', participants: 14021, avgYes: 48, divergence: 8.9 },
  { date: 'Jun 22', topic: 'Healthcare', participants: 11765, avgYes: 81, divergence: 4.2 },
  { date: 'Jun 21', topic: 'Geopolitics', participants: 13340, avgYes: 53, divergence: 9.4 },
  { date: 'Jun 20', topic: 'Culture', participants: 10982, avgYes: 67, divergence: 6.5 },
  { date: 'Jun 19', topic: 'Technology', participants: 14210, avgYes: 70, divergence: 7.7 },
]

export default function AdminPage() {
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>('Technology')
  const [loading, setLoading] = useState(false)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [approvedId, setApprovedId] = useState<string | null>(null)
  const [skipped, setSkipped] = useState<Set<string>>(new Set())

  function generate() {
    if (!selectedTopic || loading) return
    setLoading(true)
    setApprovedId(null)
    setSkipped(new Set())
    setCandidates([])
    setTimeout(() => {
      setCandidates(CANDIDATE_QUESTIONS[selectedTopic] ?? CANDIDATE_QUESTIONS.Technology)
      setLoading(false)
    }, 1400)
  }

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex items-center gap-3">
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">Question Schedule</h1>
          <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted-foreground">
            Demo Admin Panel
          </span>
        </div>
        <p className="mt-1 text-muted-foreground">{TODAY_QUESTION.date}</p>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          {/* ---------- LEFT: QUEUE ---------- */}
          <div className="flex flex-col gap-5">
            {/* Active question */}
            <div className="rounded-xl border border-border border-l-4 border-l-primary bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <QuestionStatusBadge status="active" label="Active — closes midnight UTC" />
                <button
                  type="button"
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface"
                >
                  Edit
                </button>
              </div>
              <p className="mt-3 text-base font-medium leading-snug text-foreground">
                {TODAY_QUESTION.text}
              </p>
              <span className="mt-3 inline-flex rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {TODAY_QUESTION.category}
              </span>
              <div className="mt-4">
                <SplitBar yes={TODAY_QUESTION.globalYes} no={TODAY_QUESTION.globalNo} height={10} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{TODAY_QUESTION.participants.toLocaleString()} participants</span>
                <span>
                  <span className="font-semibold text-primary">{TODAY_QUESTION.globalYes}%</span> Yes
                </span>
              </div>
            </div>

            {/* Tomorrow's queue — empty or scheduled */}
            {approvedId ? (
              <div className="rounded-xl border border-border border-l-4 border-l-amber bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-amber-soft px-2.5 py-1 text-xs font-medium text-amber">
                    Scheduled for tomorrow
                  </span>
                  <button
                    type="button"
                    onClick={() => setApprovedId(null)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface"
                  >
                    Unschedule
                  </button>
                </div>
                <p className="mt-3 text-base font-medium leading-snug text-foreground">
                  {candidates.find((c) => c.id === approvedId)?.text}
                </p>
                <span className="mt-3 inline-flex rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {selectedTopic}
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-5 py-8 text-center">
                <p className="text-sm font-medium text-foreground">
                  No question scheduled for tomorrow
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Generate one using Bedrock →
                </p>
              </div>
            )}

            {/* Recent history */}
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Recent History
              </h2>
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="grid grid-cols-[3.5rem_1fr_4rem_4rem] gap-2 border-b border-border bg-surface px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid-cols-[3.5rem_1fr_5rem_4rem_4rem]">
                  <span>Date</span>
                  <span>Topic</span>
                  <span className="hidden text-right sm:block">Players</span>
                  <span className="text-right">Yes%</span>
                  <span className="text-right">Div.</span>
                </div>
                <div className="divide-y divide-border">
                  {HISTORY.map((h) => (
                    <div
                      key={h.date}
                      className="grid grid-cols-[3.5rem_1fr_4rem_4rem] items-center gap-2 px-4 py-2.5 text-sm sm:grid-cols-[3.5rem_1fr_5rem_4rem_4rem]"
                    >
                      <span className="text-muted-foreground">{h.date}</span>
                      <span className="text-foreground">{h.topic}</span>
                      <span className="hidden text-right tabular-nums text-muted-foreground sm:block">
                        {h.participants.toLocaleString()}
                      </span>
                      <span className="text-right tabular-nums text-foreground">{h.avgYes}%</span>
                      <span className="text-right tabular-nums font-semibold text-amber">
                        {h.divergence}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ---------- RIGHT: AI GENERATOR ---------- */}
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-foreground">Generate with Bedrock</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#f3effe] px-2.5 py-1 text-xs font-medium text-[#6741d9]">
                <Sparkles className="size-3" /> Powered by Amazon Bedrock
              </span>
            </div>

            {/* Success notice */}
            {approvedId && (
              <div className="gs-fade-in flex items-center gap-2 rounded-lg border border-[var(--emerald)]/30 bg-[var(--emerald)]/10 px-4 py-3 text-sm font-medium text-[var(--emerald)]">
                <Check className="size-4" /> Question scheduled for tomorrow.
              </div>
            )}

            {/* Topic pills */}
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setSelectedTopic(topic)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    selectedTopic === topic
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:bg-surface'
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={generate}
              disabled={!selectedTopic || loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Asking Bedrock...
                </>
              ) : (
                'Generate 5 Candidates'
              )}
            </button>

            {/* Candidate cards */}
            <div className="flex flex-col gap-3">
              {candidates.map((c) => {
                const isApproved = approvedId === c.id
                const isSkipped = skipped.has(c.id)
                const dimmed = (approvedId && !isApproved) || isSkipped
                return (
                  <div
                    key={c.id}
                    className={`gs-fade-in rounded-xl border bg-card p-4 shadow-sm transition-opacity ${
                      isApproved ? 'border-[var(--emerald)]' : 'border-border'
                    } ${dimmed ? 'opacity-50' : ''}`}
                  >
                    <p className="text-sm font-medium leading-snug text-foreground">{c.text}</p>
                    <span className="mt-2 inline-flex rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {c.category}
                    </span>

                    {/* Divergence bar */}
                    <div className="mt-3">
                      <div className="relative h-6 overflow-hidden rounded-md bg-surface">
                        <div
                          className="h-full bg-amber/30"
                          style={{ width: `${c.divergence * 10}%` }}
                        />
                        <span className="absolute inset-0 flex items-center px-2 text-xs font-semibold text-amber">
                          {c.divergence.toFixed(1)} / 10 — High divergence expected
                        </span>
                      </div>
                    </div>

                    {/* Segment pills */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {c.segments.map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-surface px-2 py-0.5 text-xs text-foreground"
                        >
                          {s}
                        </span>
                      ))}
                    </div>

                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{c.rationale}</p>

                    {/* Actions */}
                    <div className="mt-4 flex gap-2">
                      {isApproved ? (
                        <span className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--emerald)]/15 py-2 text-sm font-semibold text-[var(--emerald)]">
                          <Check className="size-4" /> Scheduled
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={!!approvedId || isSkipped}
                            onClick={() => setApprovedId(c.id)}
                            className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Approve for Tomorrow
                          </button>
                          <button
                            type="button"
                            disabled={!!approvedId || isSkipped}
                            onClick={() => setSkipped((prev) => new Set(prev).add(c.id))}
                            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Skip
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
