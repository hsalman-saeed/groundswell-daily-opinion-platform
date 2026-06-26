'use client'

import { useEffect, useState } from 'react'

type CountdownTimerProps = {
  target: number // target timestamp in ms
  prefix?: string
  className?: string
}

function pad(n: number) {
  return n.toString().padStart(2, '0')
}

export function CountdownTimer({ target, prefix, className }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(() => Math.max(0, target - Date.now()))

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, target - Date.now()))
    }, 1000)
    return () => clearInterval(id)
  }, [target])

  if (remaining <= 0) {
    return <span className={`text-neutral ${className ?? ''}`}>Closed</span>
  }

  const totalSeconds = Math.floor(remaining / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const underTenMin = remaining < 10 * 60 * 1000
  const underHour = remaining < 60 * 60 * 1000

  const color = underTenMin
    ? 'text-[var(--negative)]'
    : underHour
      ? 'text-amber'
      : 'text-muted-foreground'

  const display = underHour
    ? `${pad(minutes)}:${pad(seconds)}`
    : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`

  return (
    <span className={`font-mono tabular-nums ${color} ${className ?? ''}`}>
      {prefix}
      {display}
    </span>
  )
}
