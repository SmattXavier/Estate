import type { Role } from '../auth/context'

export type NavItem = { to: string; label: string; end?: boolean }

/**
 * The one place navigation is declared. Later phases add entries here and
 * the sidebar, the drawer and the mobile title all follow.
 */
export const NAV: Record<Role, NavItem[]> = {
  resident: [
    { to: '/my/new', label: 'Report a fault' },
    { to: '/my/reports', label: 'My reports' },
    { to: '/my/charges', label: 'Service charge' },
    { to: '/my/visitors', label: 'Visitors' },
  ],
  facility_manager: [
    { to: '/board', label: 'Dispatch board', end: true },
    { to: '/board/artisans', label: 'Artisans' },
    { to: '/board/charges', label: 'Service charge' },
  ],
  ceo: [
    { to: '/overview', label: 'Overview' },
    { to: '/charges', label: 'Service charge' },
  ],
  security: [
    { to: '/gate', label: 'Gate', end: true },
    { to: '/gate/today', label: 'Today' },
  ],
  artisan: [{ to: '/shifts', label: 'My shifts' }],
}

export const ROLE_LABEL: Record<Role, string> = {
  resident: 'Resident',
  facility_manager: 'Facility manager',
  ceo: 'Chief executive',
  security: 'Gate',
  artisan: 'Artisan',
}

/** The page title for the mobile top bar, from the same config. */
export function titleFor(items: NavItem[], pathname: string): string {
  const match = items
    .filter((item) => pathname === item.to || pathname.startsWith(item.to + '/'))
    .sort((a, b) => b.to.length - a.to.length)[0]
  return match?.label ?? 'Maintenance desk'
}
