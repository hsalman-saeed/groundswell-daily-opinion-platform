import { SplitBar } from '@/components/split-bar'

type CountryResultRowProps = {
  flag: string
  name: string
  yes: number
  no: number
  total: number
}

export function CountryResultRow({ flag, name, yes, no, total }: CountryResultRowProps) {
  const sum = yes + no || 1
  const yesPct = Math.round((yes / sum) * 100)

  return (
    <div className="flex h-11 items-center gap-3 border-b border-border last:border-b-0">
      <span className="text-lg leading-none" aria-hidden="true">
        {flag}
      </span>
      <span className="w-28 shrink-0 truncate text-sm text-foreground sm:w-36">{name}</span>
      <div className="min-w-0 flex-1">
        <SplitBar yes={yes} no={no} />
      </div>
      <span className="w-12 shrink-0 text-right text-[15px] font-bold tabular-nums text-foreground">
        {yesPct}%
      </span>
      <span className="hidden w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:block">
        {total.toLocaleString()}
      </span>
    </div>
  )
}
