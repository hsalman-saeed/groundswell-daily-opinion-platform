'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { CountrySelect } from '@/components/country-select'

function getStrength(pw: string): { level: number; label: string; color: string } {
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++

  if (pw.length === 0) return { level: 0, label: '', color: 'var(--border)' }
  if (score <= 1) return { level: 1, label: 'Weak', color: 'var(--negative)' }
  if (score <= 2) return { level: 2, label: 'Decent', color: 'var(--amber)' }
  return { level: 3, label: 'Strong', color: 'var(--emerald)' }
}

export default function SignUpPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const strength = getStrength(password)

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <Link href="/" className="text-xl font-bold tracking-tight text-primary">
          Groundswell
        </Link>
        <h1 className="mt-6 text-2xl font-bold text-foreground">Join Groundswell</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Predict how the world thinks. Track your understanding.
        </p>

        <form className="mt-6 flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
          {/* Username */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="username" className="text-sm font-medium text-foreground">
              Username
            </label>
            <input
              id="username"
              type="text"
              placeholder="your_handle"
              className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-blue-soft/40"
            />
            <p className="text-xs text-muted-foreground">This appears on the global leaderboard</p>
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-blue-soft/40"
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-input bg-card px-3 py-2.5 pr-10 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-blue-soft/40"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {/* Strength bar */}
            <div className="mt-1 flex items-center gap-2">
              <div className="flex flex-1 gap-1">
                {[1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 flex-1 rounded-full transition-colors"
                    style={{
                      backgroundColor: i <= strength.level ? strength.color : 'var(--border)',
                    }}
                  />
                ))}
              </div>
              {strength.label && (
                <span className="text-xs font-medium" style={{ color: strength.color }}>
                  {strength.label}
                </span>
              )}
            </div>
          </div>

          {/* Country */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Country</label>
            <CountrySelect />
          </div>

          <button
            type="submit"
            className="mt-2 w-full rounded-lg bg-primary py-2.5 text-sm text-primary-foreground transition-all hover:bg-primary-hover active:scale-[0.98]"
          >
            Create Account
          </button>
        </form>

        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
          By joining, you agree that opinion responses are used only for aggregated demographic
          insights. Your identity is never linked to your individual vote.
        </p>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/signin" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
