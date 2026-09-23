import { useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/context'
import { useMediaQuery } from '../lib/useMediaQuery'
import ThemeToggle from './ThemeToggle'
import { NAV, ROLE_LABEL, titleFor, type NavItem } from './nav'

function Links({ items, onNavigate }: { items: NavItem[]; onNavigate: () => void }) {
  return (
    <nav className="flex-1 px-2 py-2">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `relative block rounded-sm py-2 pr-3 pl-4 text-sm ${
              isActive
                ? 'bg-shell-foreground/10 text-shell-foreground'
                : 'text-shell-foreground/65 hover:bg-shell-foreground/5 hover:text-shell-foreground'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {/* the active rail */}
              {isActive && (
                <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-sm bg-primary" />
              )}
              {item.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

/**
 * One layout for every signed-in role. The sidebar is fixed on desktop and
 * an off-canvas drawer below 1024px; the page itself is never a centred
 * column, so wide content is free to use the viewport.
 */
export default function Shell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth()
  const wide = useMediaQuery('(min-width: 1024px)')
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  const estate = useQuery({
    queryKey: ['estate', profile?.estate_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estates')
        .select('name')
        .eq('id', profile!.estate_id)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!profile,
  })

  const items = profile ? NAV[profile.role] : []
  const title = titleFor(items, pathname)

  const sidebar = (
    <div className="flex h-full flex-col bg-shell text-shell-foreground">
      <div className="px-5 py-4">
        <p className="truncate text-base font-medium">
          {estate.data?.name ?? 'Maintenance desk'}
        </p>
        <p className="mt-0.5 text-xs text-shell-foreground/60">
          Maintenance desk
        </p>
      </div>

      <Links items={items} onNavigate={() => setOpen(false)} />

      <div className="border-t border-shell-foreground/10 px-4 py-4">
        <ThemeToggle />
        <p className="mt-3 truncate text-sm">{profile?.full_name}</p>
        <p className="text-xs text-shell-foreground/60">
          {profile ? ROLE_LABEL[profile.role] : ''}
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-3 w-full rounded-sm border border-shell-foreground/25 px-3 py-2 text-sm text-shell-foreground/80 hover:border-shell-foreground/50"
        >
          Sign out
        </button>
      </div>
    </div>
  )

  if (wide) {
    return (
      <div className="min-h-dvh bg-background">
        <aside className="fixed inset-y-0 left-0 z-10 w-60">{sidebar}</aside>
        <main className="min-h-dvh ml-60">{children}</main>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-subtle bg-card px-3 py-2">
        {/* 44px square: the drawer only exists below 1024px, where this is a
            touch target at every width including the 768px tablet edge. */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-expanded={open}
          className="flex size-11 shrink-0 flex-col items-center justify-center gap-1 rounded-sm border border-subtle"
        >
          {/* Drawn, not an icon font: three rules. */}
          <span aria-hidden="true" className="block h-px w-4 bg-foreground" />
          <span aria-hidden="true" className="block h-px w-4 bg-foreground" />
          <span aria-hidden="true" className="block h-px w-4 bg-foreground" />
        </button>
        <h1 className="truncate text-base">{title}</h1>
      </header>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 bg-shell/60"
          />
          <aside className="fixed inset-y-0 left-0 z-40 w-64 shadow-e3">
            {sidebar}
          </aside>
        </>
      )}

      <main>{children}</main>
    </div>
  )
}
