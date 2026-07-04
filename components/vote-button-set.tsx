'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { VoteChoice } from '@/lib/mock-data'

type VoteButtonSetProps = {
  onVote: (choice: VoteChoice) => void | Promise<void>
  disabled?: boolean
}

export function VoteButtonSet({ onVote, disabled }: VoteButtonSetProps) {
  const [pending, setPending] = useState<VoteChoice | null>(null)

  async function handleVote(choice: VoteChoice) {
    if (pending || disabled) return
    setPending(choice)
    try {
      await onVote(choice)
    } catch {
      // Reset spinner on failure so user can retry
      setPending(null)
    }
  }

  const locked = disabled || pending !== null

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
      <button
        type="button"
        disabled={locked}
        onClick={() => handleVote('YES')}
        className="flex h-14 flex-[1.2] items-center justify-center rounded-xl bg-primary text-base font-semibold text-primary-foreground transition-all hover:bg-primary-hover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending === 'YES' ? <Loader2 className="size-5 animate-spin" /> : 'YES'}
      </button>

      <button
        type="button"
        disabled={locked}
        onClick={() => handleVote('NO')}
        className="flex h-14 flex-1 items-center justify-center rounded-xl border-2 border-border bg-card text-base font-semibold text-foreground transition-all hover:border-foreground/40 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending === 'NO' ? <Loader2 className="size-5 animate-spin" /> : 'NO'}
      </button>

      <button
        type="button"
        disabled={locked}
        onClick={() => handleVote('ABSTAIN')}
        className="flex h-12 flex-[0.8] items-center justify-center self-center rounded-xl border border-dashed border-neutral text-sm font-medium text-neutral transition-all hover:border-neutral/70 hover:bg-surface active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 sm:h-14"
      >
        {pending === 'ABSTAIN' ? <Loader2 className="size-4 animate-spin" /> : 'ABSTAIN'}
      </button>
    </div>
  )
}
