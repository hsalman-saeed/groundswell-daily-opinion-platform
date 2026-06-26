type EmpathyScoreRingProps = {
  score: number // 0 - 100
  size?: number
  showLabel?: boolean
}

export function EmpathyScoreRing({ score, size = 128, showLabel = true }: EmpathyScoreRingProps) {
  const stroke = size > 80 ? 10 : 5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, score))
  const offset = circumference - (clamped / 100) * circumference
  const isLarge = size > 80

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--surface)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--amber)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-bold tabular-nums text-amber"
            style={{ fontSize: isLarge ? size * 0.34 : size * 0.4 }}
          >
            {Math.round(clamped)}
          </span>
        </div>
      </div>
      {showLabel && (
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Empathy Score
        </span>
      )}
    </div>
  )
}
