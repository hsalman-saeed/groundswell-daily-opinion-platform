type SplitBarProps = {
  yes: number
  no: number
  className?: string
  height?: number
}

// Horizontal YES (blue) / NO (red) split bar, proportional to votes.
export function SplitBar({ yes, no, className, height = 8 }: SplitBarProps) {
  const total = yes + no || 1
  const yesPct = (yes / total) * 100
  const noPct = (no / total) * 100

  return (
    <div
      className={`flex w-full overflow-hidden rounded-full bg-surface ${className ?? ''}`}
      style={{ height }}
      role="img"
      aria-label={`${Math.round(yesPct)} percent yes, ${Math.round(noPct)} percent no`}
    >
      <div
        className="h-full bg-primary transition-all duration-500 ease-out"
        style={{ width: `${yesPct}%` }}
      />
      <div
        className="h-full bg-[var(--negative)] transition-all duration-500 ease-out"
        style={{ width: `${noPct}%` }}
      />
    </div>
  )
}
