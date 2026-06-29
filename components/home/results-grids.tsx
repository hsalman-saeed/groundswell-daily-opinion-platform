import { CountryResultRow } from '@/components/country-result-row'
import { SplitBar } from '@/components/split-bar'

const countryMeta: Record<string, { flag: string; name: string }> = {
  US: { flag: '🇺🇸', name: 'United States' },
  DE: { flag: '🇩🇪', name: 'Germany' },
  IN: { flag: '🇮🇳', name: 'India' },
  BR: { flag: '🇧🇷', name: 'Brazil' },
  JP: { flag: '🇯🇵', name: 'Japan' },
  PK: { flag: '🇵🇰', name: 'Pakistan' },
  GB: { flag: '🇬🇧', name: 'United Kingdom' },
  FR: { flag: '🇫🇷', name: 'France' },
  KR: { flag: '🇰🇷', name: 'South Korea' },
  NG: { flag: '🇳🇬', name: 'Nigeria' },
  MX: { flag: '🇲🇽', name: 'Mexico' },
  CN: { flag: '🇨🇳', name: 'China' },
  FI: { flag: '🇫🇮', name: 'Finland' },
  AU: { flag: '🇦🇺', name: 'Australia' },
  CA: { flag: '🇨🇦', name: 'Canada' },
}

function DiffIndicator({ predicted, actual }: { predicted: number; actual: number }) {
  const diff = parseFloat((actual - predicted).toFixed(1))
  const sign = diff >= 0 ? '+' : ''
  return (
    <span className="text-xs text-muted-foreground">
      {sign}
      {diff} from your prediction
    </span>
  )
}

export function ResultsGrids({
  countries = [],
  ageGroups = [],
  predictions = [],
}: {
  countries?: any[]
  ageGroups?: any[]
  predictions?: any[]
}) {
  const countryPred = predictions.find(
    (p) => p.target_segment_type === 'country' && p.target_segment_value === 'DE'
  )
  const agePred = predictions.find(
    (p) => p.target_segment_type === 'age_bucket' && p.target_segment_value === '18-24'
  )

  const predCountryVal = countryPred
    ? countryPred.predicted_yes_pct ?? countryPred.predicted
    : null
  const actualCountryVal = countryPred
    ? countryPred.actual_yes_pct ?? countryPred.actual
    : null

  const predAgeVal = agePred ? agePred.predicted_yes_pct ?? agePred.predicted : null
  const actualAgeVal = agePred ? agePred.actual_yes_pct ?? agePred.actual : null

  return (
    <div className="flex flex-col gap-7">
      {/* By Region */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          By Country
        </h3>

        {/* Your prediction callout for Germany (DE) */}
        {predCountryVal !== null && actualCountryVal !== null && (
          <div className="mb-2 flex items-center justify-between rounded-lg bg-blue-soft px-3 py-2">
            <span className="text-xs font-medium text-primary">
              Your prediction · Germany: {predCountryVal}%
            </span>
            <DiffIndicator predicted={predCountryVal} actual={actualCountryVal} />
          </div>
        )}

        <div className="max-h-[360px] overflow-y-auto rounded-lg border border-border bg-card px-3">
          {countries.map((c) => {
            const meta = countryMeta[c.segment_value] || { flag: '🌍', name: c.segment_value }
            return (
              <CountryResultRow
                key={c.segment_value}
                flag={meta.flag}
                name={meta.name}
                yes={c.yes_pct}
                no={c.no_pct}
                total={c.total_count}
              />
            )
          })}
        </div>
      </section>

      {/* By Age Group */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          By Age Group
        </h3>

        {predAgeVal !== null && actualAgeVal !== null && (
          <div className="mb-2 flex items-center justify-between rounded-lg bg-blue-soft px-3 py-2">
            <span className="text-xs font-medium text-primary">
              Your prediction · Age 18–24: {predAgeVal}%
            </span>
            <DiffIndicator predicted={predAgeVal} actual={actualAgeVal} />
          </div>
        )}

        <div className="rounded-lg border border-border bg-card px-3">
          {ageGroups.map((a) => (
            <div
              key={a.segment_value}
              className="flex h-11 items-center gap-3 border-b border-border last:border-b-0"
            >
              <span className="w-20 shrink-0 text-sm text-foreground">{a.segment_value}</span>
              <div className="min-w-0 flex-1">
                <SplitBar yes={a.yes_pct} no={100 - a.yes_pct} />
              </div>
              <span className="w-12 shrink-0 text-right text-[15px] font-bold tabular-nums text-foreground">
                {a.yes_pct}%
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
