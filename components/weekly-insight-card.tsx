'use client'

import { useState } from 'react'
import { Check, Share2 } from 'lucide-react'

type WeeklyInsightCardProps = {
  title?: string
  insights: string[]
}

export function WeeklyInsightCard({
  title = 'This Week in Global Opinion',
  insights,
}: WeeklyInsightCardProps) {
  const [copied, setCopied] = useState(false)

  function handleShare() {
    const text = `${title} — ${insights.join(' ')}`
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {})
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl border border-border border-l-4 border-l-amber bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <button
          type="button"
          onClick={handleShare}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface"
        >
          {copied ? <Check className="size-3.5 text-[var(--emerald)]" /> : <Share2 className="size-3.5" />}
          {copied ? 'Copied' : 'Share'}
        </button>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {insights.map((line, i) => (
          <p key={i} className="text-sm leading-relaxed text-muted-foreground">
            {line}
          </p>
        ))}
      </div>
    </div>
  )
}
