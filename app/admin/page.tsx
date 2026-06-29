'use client'

import { useState, useEffect } from 'react'
import { Check, Loader2, Sparkles, ChevronDown, Zap } from 'lucide-react'
import { NavBar } from '@/components/nav-bar'
import { QuestionStatusBadge } from '@/components/question-status-badge'
import { SplitBar } from '@/components/split-bar'
import { TOPICS, type Topic } from '@/lib/mock-data'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Candidate {
  question_text: string
  category: string
  predicted_divergence_score: number
  predicted_high_divergence_reason: string
  rationale: string
}

interface ScheduledQuestion {
  question_id: string
  question_text: string
  category: string
  release_date: string
  is_active: boolean
  is_finalized: boolean
  total_participants: number
  global_yes_pct: number | null
  global_no_pct: number | null
  divergence_score: number | null
  bedrock_predicted_divergence: number | null
}

// ---------------------------------------------------------------------------
// Admin Page
// ---------------------------------------------------------------------------
export default function AdminPage() {
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>('Technology')
  const [loading, setLoading] = useState(false)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [approvedIdx, setApprovedIdx] = useState<number | null>(null)
  const [skipped, setSkipped] = useState<Set<number>>(new Set())
  const [modelUsed, setModelUsed] = useState<string>('')
  const [isFallback, setIsFallback] = useState(false)

  // Schedule data from API
  const [questions, setQuestions] = useState<ScheduledQuestion[]>([])
  const [questionsLoading, setQuestionsLoading] = useState(true)

  // Approve state
  const [approving, setApproving] = useState(false)
  const [approveSuccess, setApproveSuccess] = useState(false)

  // Finalize state
  const [finalizing, setFinalizing] = useState(false)
  const [finalizeResult, setFinalizeResult] = useState<any>(null)
  const [selectedFinalizeId, setSelectedFinalizeId] = useState<string>('')

  // Load questions on mount
  useEffect(() => {
    loadQuestions()
  }, [])

  async function loadQuestions() {
    setQuestionsLoading(true)
    try {
      const res = await fetch('/api/admin/questions')
      if (res.ok) {
        const data = await res.json()
        setQuestions(data.questions || [])
      }
    } catch (err) {
      console.error('Failed to load questions:', err)
    } finally {
      setQuestionsLoading(false)
    }
  }

  async function generate() {
    if (!selectedTopic || loading) return
    setLoading(true)
    setApprovedIdx(null)
    setApproveSuccess(false)
    setSkipped(new Set())
    setCandidates([])
    setModelUsed('')
    setIsFallback(false)

    try {
      const res = await fetch('/api/admin/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: selectedTopic }),
      })
      const data = await res.json()
      if (data.candidates) {
        setCandidates(data.candidates)
        setModelUsed(data.model || 'unknown')
        setIsFallback(data.fallback || false)
      }
    } catch (err) {
      console.error('Generate failed:', err)
    } finally {
      setLoading(false)
    }
  }

  async function approveCandidate(idx: number) {
    if (approving || approvedIdx !== null) return
    setApproving(true)

    try {
      const candidate = candidates[idx]
      const res = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_text: candidate.question_text,
          category: candidate.category,
          predicted_divergence_score: candidate.predicted_divergence_score,
        }),
      })

      if (res.ok) {
        setApprovedIdx(idx)
        setApproveSuccess(true)
        // Reload questions to show the newly scheduled one
        await loadQuestions()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to approve question')
      }
    } catch (err) {
      console.error('Approve failed:', err)
      alert('Failed to approve question')
    } finally {
      setApproving(false)
    }
  }

  async function handleFinalize() {
    if (!selectedFinalizeId || finalizing) return
    setFinalizing(true)
    setFinalizeResult(null)

    try {
      const res = await fetch('/api/admin/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: selectedFinalizeId }),
      })
      const data = await res.json()
      setFinalizeResult(data)
      // Reload questions to reflect finalized status
      await loadQuestions()
    } catch (err) {
      console.error('Finalize failed:', err)
      setFinalizeResult({ error: 'Network error' })
    } finally {
      setFinalizing(false)
    }
  }

  // Derived data
  const activeQuestion = questions.find((q) => q.is_active && !q.is_finalized)
  const pastQuestions = questions.filter((q) => q.is_finalized)
  const unfinalizedQuestions = questions.filter((q) => !q.is_finalized)

  const formatDate = (d: string) => {
    try {
      return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return d
    }
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
        <p className="mt-1 text-muted-foreground">
          {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          {/* ---------- LEFT: QUEUE ---------- */}
          <div className="flex flex-col gap-5">
            {/* Active question */}
            {questionsLoading ? (
              <div className="flex items-center justify-center rounded-xl border border-border bg-card p-8">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
            ) : activeQuestion ? (
              <div className="rounded-xl border border-border border-l-4 border-l-primary bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <QuestionStatusBadge status="active" label="Active — closes midnight UTC" />
                </div>
                <p className="mt-3 text-base font-medium leading-snug text-foreground">
                  {activeQuestion.question_text}
                </p>
                <span className="mt-3 inline-flex rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {activeQuestion.category}
                </span>
                {activeQuestion.global_yes_pct != null && activeQuestion.global_no_pct != null && (
                  <div className="mt-4">
                    <SplitBar yes={activeQuestion.global_yes_pct} no={activeQuestion.global_no_pct} height={10} />
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{(activeQuestion.total_participants || 0).toLocaleString()} participants</span>
                  {activeQuestion.global_yes_pct != null && (
                    <span>
                      <span className="font-semibold text-primary">{activeQuestion.global_yes_pct}%</span> Yes
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-5 py-8 text-center">
                <p className="text-sm font-medium text-foreground">No active question today</p>
              </div>
            )}

            {/* Approved question banner */}
            {approveSuccess && (
              <div className="gs-fade-in rounded-xl border border-border border-l-4 border-l-amber bg-card p-5 shadow-sm">
                <span className="rounded-full bg-amber-soft px-2.5 py-1 text-xs font-medium text-amber">
                  Scheduled for tomorrow
                </span>
                <p className="mt-3 text-base font-medium leading-snug text-foreground">
                  {approvedIdx !== null ? candidates[approvedIdx]?.question_text : ''}
                </p>
                <span className="mt-3 inline-flex rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {approvedIdx !== null ? candidates[approvedIdx]?.category : selectedTopic}
                </span>
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
                  {questionsLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : pastQuestions.length === 0 ? (
                    <div className="px-4 py-4 text-center text-sm text-muted-foreground">
                      No finalized questions yet
                    </div>
                  ) : (
                    pastQuestions.map((q) => (
                      <div
                        key={q.question_id}
                        className="grid grid-cols-[3.5rem_1fr_4rem_4rem] items-center gap-2 px-4 py-2.5 text-sm sm:grid-cols-[3.5rem_1fr_5rem_4rem_4rem]"
                      >
                        <span className="text-muted-foreground">{formatDate(q.release_date)}</span>
                        <span className="text-foreground">{q.category}</span>
                        <span className="hidden text-right tabular-nums text-muted-foreground sm:block">
                          {(q.total_participants || 0).toLocaleString()}
                        </span>
                        <span className="text-right tabular-nums text-foreground">
                          {q.global_yes_pct != null ? `${q.global_yes_pct}%` : '—'}
                        </span>
                        <span className="text-right tabular-nums font-semibold text-amber">
                          {q.divergence_score != null ? q.divergence_score : '—'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* ========== FINALIZE SECTION ========== */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Zap className="size-5 text-amber" />
                <h2 className="text-base font-bold text-foreground">Finalize & Score</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Trigger the scoring pipeline for a question. Computes empathy scores from predictions.
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label htmlFor="finalize-select" className="mb-1 block text-xs font-medium text-muted-foreground">
                    Select Question
                  </label>
                  <div className="relative">
                    <select
                      id="finalize-select"
                      value={selectedFinalizeId}
                      onChange={(e) => setSelectedFinalizeId(e.target.value)}
                      className="w-full appearance-none rounded-lg border border-border bg-surface px-3 py-2 pr-8 text-sm text-foreground"
                    >
                      <option value="">Choose a question…</option>
                      {unfinalizedQuestions.map((q) => (
                        <option key={q.question_id} value={q.question_id}>
                          {formatDate(q.release_date)} — {q.question_text.slice(0, 60)}…
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!selectedFinalizeId || finalizing}
                  onClick={handleFinalize}
                  className="flex items-center justify-center gap-2 rounded-lg bg-amber px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-amber/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {finalizing ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Scoring…
                    </>
                  ) : (
                    'Finalize & Score Predictions'
                  )}
                </button>
              </div>

              {finalizeResult && (
                <div
                  className={`gs-fade-in mt-4 rounded-lg border px-4 py-3 text-sm ${
                    finalizeResult.success
                      ? 'border-[var(--emerald)]/30 bg-[var(--emerald)]/10 text-[var(--emerald)]'
                      : 'border-[var(--negative)]/30 bg-[var(--negative)]/10 text-[var(--negative)]'
                  }`}
                >
                  {finalizeResult.success ? (
                    <>
                      <p className="font-semibold">✓ Scoring complete</p>
                      <p className="mt-1">
                        {finalizeResult.segments_updated} segments updated · {finalizeResult.predictions_scored} predictions scored · {finalizeResult.players_updated} players updated
                      </p>
                      <p className="mt-0.5">Divergence score: {finalizeResult.divergence_score}</p>
                    </>
                  ) : (
                    <p>{finalizeResult.error || 'Finalization failed'}</p>
                  )}
                </div>
              )}
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

            {/* Model info */}
            {modelUsed && (
              <div className={`gs-fade-in flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-medium ${
                isFallback
                  ? 'border-amber/30 bg-amber/10 text-amber'
                  : 'border-[var(--emerald)]/30 bg-[var(--emerald)]/10 text-[var(--emerald)]'
              }`}>
                {isFallback ? '⚠ AI unavailable — showing fallback questions' : `✓ Generated by ${modelUsed}`}
              </div>
            )}

            {/* Success notice */}
            {approveSuccess && (
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
                  <Loader2 className="size-4 animate-spin" /> Asking Bedrock…
                </>
              ) : (
                'Generate 5 Candidates'
              )}
            </button>

            {/* Candidate cards */}
            <div className="flex flex-col gap-3">
              {candidates.map((c, idx) => {
                const isApproved = approvedIdx === idx
                const isSkippedCard = skipped.has(idx)
                const dimmed = (approvedIdx !== null && !isApproved) || isSkippedCard
                return (
                  <div
                    key={idx}
                    className={`gs-fade-in rounded-xl border bg-card p-4 shadow-sm transition-opacity ${
                      isApproved ? 'border-[var(--emerald)]' : 'border-border'
                    } ${dimmed ? 'opacity-50' : ''}`}
                  >
                    <p className="text-sm font-medium leading-snug text-foreground">{c.question_text}</p>
                    <span className="mt-2 inline-flex rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {c.category}
                    </span>

                    {/* Divergence bar */}
                    <div className="mt-3">
                      <div className="relative h-6 overflow-hidden rounded-md bg-surface">
                        <div
                          className="h-full bg-amber/30"
                          style={{ width: `${(c.predicted_divergence_score || 0) * 10}%` }}
                        />
                        <span className="absolute inset-0 flex items-center px-2 text-xs font-semibold text-amber">
                          {(c.predicted_divergence_score || 0).toFixed(1)} / 10 — Predicted divergence
                        </span>
                      </div>
                    </div>

                    {/* High divergence reason */}
                    {c.predicted_high_divergence_reason && (
                      <p className="mt-2 text-xs italic text-muted-foreground">
                        {c.predicted_high_divergence_reason}
                      </p>
                    )}

                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{c.rationale}</p>

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
                            disabled={approvedIdx !== null || isSkippedCard || approving}
                            onClick={() => approveCandidate(idx)}
                            className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {approving ? 'Saving…' : 'Approve for Tomorrow'}
                          </button>
                          <button
                            type="button"
                            disabled={approvedIdx !== null || isSkippedCard}
                            onClick={() => setSkipped((prev) => new Set(prev).add(idx))}
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
