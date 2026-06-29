'use client'

import { useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'

export const COUNTRIES = [
  { code: 'AR', flag: '🇦🇷', name: 'Argentina' },
  { code: 'AU', flag: '🇦🇺', name: 'Australia' },
  { code: 'BR', flag: '🇧🇷', name: 'Brazil' },
  { code: 'CA', flag: '🇨🇦', name: 'Canada' },
  { code: 'CN', flag: '🇨🇳', name: 'China' },
  { code: 'EG', flag: '🇪🇬', name: 'Egypt' },
  { code: 'FR', flag: '🇫🇷', name: 'France' },
  { code: 'DE', flag: '🇩🇪', name: 'Germany' },
  { code: 'IN', flag: '🇮🇳', name: 'India' },
  { code: 'ID', flag: '🇮🇩', name: 'Indonesia' },
  { code: 'IT', flag: '🇮🇹', name: 'Italy' },
  { code: 'JP', flag: '🇯🇵', name: 'Japan' },
  { code: 'KE', flag: '🇰🇪', name: 'Kenya' },
  { code: 'MX', flag: '🇲🇽', name: 'Mexico' },
  { code: 'NG', flag: '🇳🇬', name: 'Nigeria' },
  { code: 'PK', flag: '🇵🇰', name: 'Pakistan' },
  { code: 'PH', flag: '🇵🇭', name: 'Philippines' },
  { code: 'KR', flag: '🇰🇷', name: 'South Korea' },
  { code: 'ES', flag: '🇪🇸', name: 'Spain' },
  { code: 'SE', flag: '🇸🇪', name: 'Sweden' },
  { code: 'GB', flag: '🇬🇧', name: 'United Kingdom' },
  { code: 'US', flag: '🇺🇸', name: 'United States' },
].sort((a, b) => a.name.localeCompare(b.name))

export function CountrySelect({ onSelect }: { onSelect?: (country: typeof COUNTRIES[number] | null) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<(typeof COUNTRIES)[number] | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(
    () => COUNTRIES.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())),
    [query],
  )

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-input bg-card px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (
          <span className="flex items-center gap-2 text-foreground">
            <span aria-hidden="true">{selected.flag}</span>
            {selected.name}
          </span>
        ) : (
          <span className="text-muted-foreground">Select your country</span>
        )}
        <ChevronDown className="size-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="gs-fade-in absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-md">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="size-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search countries"
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">No matches</li>
            )}
            {filtered.map((c) => (
              <li key={c.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected?.code === c.code}
                  onClick={() => {
                    setSelected(c)
                    setOpen(false)
                    setQuery('')
                    if (onSelect) onSelect(c)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface"
                >
                  <span aria-hidden="true">{c.flag}</span>
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
