type Status = 'active' | 'closed' | 'completed'

type QuestionStatusBadgeProps = {
  status: Status
  label?: string
}

const STYLES: Record<Status, string> = {
  active: 'bg-[var(--emerald)]/12 text-[var(--emerald)]',
  closed: 'bg-amber-soft text-amber',
  completed: 'bg-surface text-muted-foreground',
}

const DEFAULT_LABEL: Record<Status, string> = {
  active: 'Active — closes midnight UTC',
  closed: 'Voting Closed — scoring in progress',
  completed: 'Completed',
}

export function QuestionStatusBadge({ status, label }: QuestionStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STYLES[status]}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label ?? DEFAULT_LABEL[status]}
    </span>
  )
}
