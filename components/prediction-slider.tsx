'use client'

type PredictionSliderProps = {
  label: string
  value: number
  onChange: (value: number) => void
}

export function PredictionSlider({ label, value, onChange }: PredictionSliderProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-lg font-bold tabular-nums text-primary">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`Predicted percentage for ${label}`}
        className="gs-slider"
        style={{
          background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${value}%, var(--surface) ${value}%, var(--surface) 100%)`,
        }}
      />
      <span className="text-xs text-muted-foreground">Your prediction: {value}% will vote YES</span>
    </div>
  )
}
