import { CountryResultRow } from '@/components/country-result-row'
import { SplitBar } from '@/components/split-bar'
import { AGE_RESULTS, COUNTRY_RESULTS, CURRENT_USER } from '@/lib/mock-data'

// Region prediction is keyed to "Europe" (slider 1), age prediction to "Age 18–24" (slider 2).
const REGION_PREDICTION = CURRENT_USER.predictions[0] // Europe
const AGE_PREDICTION = CURRENT_USER.predictions[1] // Age 18–24

function DiffIndicator({ predicted, actual }: { predicted: number; actual: number }) {
  const diff = actual - predicted
  const sign = diff >= 0 ? '+' : ''
  return (
    <span className="text-xs text-muted-foreground">
      {sign}
      {diff} from your prediction
    </span>
  )
}

export function ResultsGrids() {
  const sortedCountries = [...COUNTRY_RESULTS].sort((a, b) => b.players - a.players)

  return (
    <div className="flex flex-col gap-7">
      {/* By Region */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          By Region
        </h3>

        {/* Your prediction callout for Europe */}
        <div className="mb-2 flex items-center justify-between rounded-lg bg-blue-soft px-3 py-2">
          <span className="text-xs font-medium text-primary">
            Your prediction · {REGION_PREDICTION.label}: {REGION_PREDICTION.predicted}%
          </span>
          <DiffIndicator predicted={REGION_PREDICTION.predicted} actual={REGION_PREDICTION.actual} />
        </div>

        <div className="max-h-[360px] overflow-y-auto rounded-lg border border-border bg-card px-3">
          {sortedCountries.map((c) => (
            <CountryResultRow
              key={c.code}
              flag={c.flag}
              name={c.name}
              yes={c.yes}
              no={c.no}
              total={c.players}
            />
          ))}
        </div>
      </section>

      {/* By Age Group */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          By Age Group
        </h3>

        <div className="mb-2 flex items-center justify-between rounded-lg bg-blue-soft px-3 py-2">
          <span className="text-xs font-medium text-primary">
            Your prediction · {AGE_PREDICTION.label}: {AGE_PREDICTION.predicted}%
          </span>
          <DiffIndicator predicted={AGE_PREDICTION.predicted} actual={AGE_PREDICTION.actual} />
        </div>

        <div className="rounded-lg border border-border bg-card px-3">
          {AGE_RESULTS.map((a) => (
            <div
              key={a.bucket}
              className="flex h-11 items-center gap-3 border-b border-border last:border-b-0"
            >
              <span className="w-20 shrink-0 text-sm text-foreground">{a.bucket}</span>
              <div className="min-w-0 flex-1">
                <SplitBar yes={a.yes} no={100 - a.yes} />
              </div>
              <span className="w-12 shrink-0 text-right text-[15px] font-bold tabular-nums text-foreground">
                {a.yes}%
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
