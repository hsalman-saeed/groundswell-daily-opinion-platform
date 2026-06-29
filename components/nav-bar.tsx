'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Flame, Menu, X, ChevronDown } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'

const NAV_LINKS = [
  { href: '/', label: 'Today' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/stats', label: 'My Stats' },
]

export function NavBar({ showTopicPill = false }: { showTopicPill?: boolean }) {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [category, setCategory] = useState("Technology")

  const isLoggedIn = status === 'authenticated'
  const user = session?.user as any
  const username = user?.username || user?.name || 'Guest'
  const initial = username.charAt(0).toUpperCase()
  const streak = user?.current_streak ?? 0

  useEffect(() => {
    setDrawerOpen(false)
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (showTopicPill) {
      fetch('/api/today')
        .then((res) => res.json())
        .then((data) => {
          if (data?.question?.category) {
            setCategory(data.question.category)
          }
        })
        .catch((err) => console.error('Error fetching category:', err))
    }
  }, [showTopicPill])

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Left: wordmark */}
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-bold tracking-tight text-primary">
            Groundswell
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? 'font-semibold text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Center: topic pill (homepage only) */}
        {showTopicPill && (
          <div className="absolute left-1/2 hidden -translate-x-1/2 lg:block">
            <span className="rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground">
              Today: {category}
            </span>
          </div>
        )}

        {/* Right: streak + user */}
        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <>
              <span className="flex items-center gap-1 text-sm font-semibold text-amber">
                <Flame className="size-4" aria-hidden="true" />
                {streak}
              </span>

              <div className="relative hidden md:block">
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-surface"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {initial}
                  </span>
                  <span className="text-sm font-medium text-foreground">{username}</span>
                  <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="gs-fade-in absolute right-0 mt-2 w-44 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-md"
                  >
                    <Link
                      href="/stats"
                      role="menuitem"
                      className="block px-4 py-2 text-sm text-foreground hover:bg-surface"
                    >
                      My Stats
                    </Link>
                    <button
                      type="button"
                      onClick={() => signOut({ callbackUrl: '/signin' })}
                      role="menuitem"
                      className="block w-full text-left px-4 py-2 text-sm text-foreground hover:bg-surface"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link
              href="/signin"
              className="hidden rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-hover md:block"
            >
              Sign In
            </Link>
          )}

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex size-9 items-center justify-center rounded-md text-foreground hover:bg-surface md:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-foreground/30"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="gs-fade-in absolute right-0 top-0 flex h-full w-72 flex-col bg-card p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-primary">Groundswell</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex size-9 items-center justify-center rounded-md hover:bg-surface"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>

            {isLoggedIn && (
              <div className="mt-6 flex items-center gap-3 rounded-lg bg-surface p-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground">
                  {initial}
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{username}</p>
                  <p className="flex items-center gap-1 text-xs text-amber">
                    <Flame className="size-3" /> {streak} day streak
                  </p>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-1">
              {NAV_LINKS.map((link) => {
                const active = pathname === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-md px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? 'bg-blue-soft font-semibold text-primary'
                        : 'text-foreground hover:bg-surface'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              })}
              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: '/signin' })}
                  className="rounded-md px-3 py-2.5 text-left text-sm text-foreground hover:bg-surface"
                >
                  Sign Out
                </button>
              ) : (
                <Link
                  href="/signin"
                  className="rounded-md px-3 py-2.5 text-sm text-foreground hover:bg-surface font-semibold text-primary"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
