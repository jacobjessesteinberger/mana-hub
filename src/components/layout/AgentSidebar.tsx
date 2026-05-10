'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { AGENTS as AGENT_LIST } from '@/lib/agents-meta'
import AgentAvatar from '@/components/ui/AgentAvatar'
import { useNotifications } from '@/lib/notifications/NotificationContext'
import { useAuth } from '@/lib/auth/AuthContext'
import { useSidebar } from '@/components/layout/SidebarContext'
import { manaHubConfig } from '@/lib/mana-hub-config'
import {
  Plus, Home, Inbox,
  ListChecks, Layers, Target,
  FileText, Shield, Workflow, Calendar,
  PanelLeft,
  BookOpen, Activity, Building, Rocket,
  Search, ChevronRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type NavEntry =
  | { kind: 'item'; href: string; label: string; icon: LucideIcon; count?: number; exact?: boolean }
  | { kind: 'sect'; label: string }
  | { kind: 'agent'; href: string; name: string; status: 'live' | 'idle'; agentName: string }

export default function AgentSidebar() {
  const pathname = usePathname()
  const { counts, totalCount, openIssueCount, pendingApprovalCount, heartbeats } = useNotifications()
  const { isDemoMode } = useAuth()
  const { open: sbOpen, collapsed, setOpen: setSbOpen, toggleCollapsed } = useSidebar()

  const liveCount = Object.values(heartbeats).filter(
    hb => hb && ['online', 'busy', 'idle'].includes(hb.status)
  ).length

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')

  const NAV: NavEntry[] = [
    { kind: 'item', href: '/dashboard/agents/issues?new=true', label: 'New Task', icon: Plus, exact: false },
    { kind: 'item', href: '/dashboard/agents', label: 'Dashboard', icon: Home, exact: true, count: liveCount > 0 ? liveCount : undefined },
    { kind: 'item', href: '/dashboard/agents/inbox', label: 'Inbox', icon: Inbox, count: totalCount > 0 ? totalCount : undefined },
    { kind: 'sect', label: 'Work' },
    { kind: 'item', href: '/dashboard/agents/issues', label: 'Tasks', icon: ListChecks, count: openIssueCount || undefined },
    { kind: 'item', href: '/dashboard/agents/projects', label: 'Workspaces', icon: Layers },
    { kind: 'item', href: '/dashboard/agents/goals', label: 'Outcomes', icon: Target },
    { kind: 'item', href: '/dashboard/agents/briefings', label: 'Briefings', icon: FileText },
    { kind: 'item', href: '/dashboard/agents/approvals', label: 'Risk Approval', icon: Shield, count: pendingApprovalCount || undefined },
    { kind: 'item', href: '/dashboard/agents/cron-requests', label: 'Cron-Vorschlaege', icon: Calendar },
    { kind: 'item', href: '/dashboard/agents/routines', label: 'Jobs & Skills', icon: Workflow },
    { kind: 'sect', label: 'Agents' },
    ...AGENT_LIST.map<NavEntry>(a => {
      const hb = heartbeats[a.name]
      const live = hb && ['online', 'busy', 'idle'].includes(hb.status)
      return {
        kind: 'agent',
        href: `/dashboard/agents/${a.name}/chat`,
        name: a.label,
        agentName: a.name,
        status: live ? 'live' : 'idle',
      }
    }),
    { kind: 'sect', label: 'Company' },
    ...(manaHubConfig.shell.showSetupPage
      ? [{ kind: 'item' as const, href: '/dashboard/agents/setup', label: 'Setup', icon: Rocket }]
      : []),
    { kind: 'item', href: '/dashboard/agents/docs', label: 'Documentation', icon: BookOpen },
    { kind: 'item', href: '/dashboard/agents/knowledge', label: 'Knowledge Base', icon: BookOpen },
    { kind: 'item', href: '/dashboard/agents/health', label: 'Health', icon: Activity },
    { kind: 'item', href: '/dashboard/agents/org', label: 'Org', icon: Building },
  ]

  const closeDrawer = () => setSbOpen(false)
  const handleCollapse = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches) {
      closeDrawer()
      return
    }
    toggleCollapsed()
  }
  const openSearch = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('ah:open-command-palette'))
    }
  }

  return (
    <>
      <aside className={cn('sb-wrap', sbOpen && 'is-open', collapsed && 'is-collapsed')}>
        <div className="sb">
          {/* workspace header */}
          <div style={{ padding: '14px 14px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              className="sb-logo"
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                background: 'linear-gradient(135deg, var(--accent), var(--accent-strong))',
                color: 'var(--accent-fg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11.5,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                flex: 'none',
              }}
            >
              MH
            </div>
            <div className="sb-header-text" style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.005em' }}>
                Mana Hub
              </div>
              <div style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>Core Starter</div>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm sb-collapse-btn"
              title={collapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
              onClick={handleCollapse}
            >
              <PanelLeft size={13} />
            </button>
          </div>

          {/* search */}
          {manaHubConfig.shell.showSearch ? (
          <div className="sb-search" style={{ padding: '2px 10px 8px' }}>
            <button
              type="button"
              onClick={openSearch}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                height: 30,
                padding: '0 11px',
                borderRadius: 999,
                background: 'rgba(0,0,0,0.04)',
                color: 'var(--fg-subtle)',
                fontSize: 12.5,
                cursor: 'pointer',
                border: 0,
                textAlign: 'left',
              }}
            >
              <Search size={13} />
              <span style={{ flex: 1 }}>Suchen</span>
              <span className="kbd">⌘K</span>
            </button>
          </div>
          ) : null}

          {/* nav scroll */}
          <nav style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
            {NAV.map((n, i) => {
              if (n.kind === 'sect') {
                return (
                  <div key={`sect-${i}`} className="sb-section">
                    {n.label}
                  </div>
                )
              }
              if (n.kind === 'agent') {
                const active = isActive(`/dashboard/agents/${n.agentName}`)
                const meta = AGENT_LIST.find(a => a.name === n.agentName)!
                const count = counts[n.agentName] || 0
                return (
                  <Link
                    key={`a-${n.agentName}`}
                    href={n.href}
                    className={cn('sb-item', active && 'active')}
                    data-label={n.name}
                    title={n.name}
                    onClick={closeDrawer}
                  >
                    <AgentAvatar agent={meta} size="sm" />
                    <span className="sb-label" style={{ flex: 1 }}>
                      {n.name}
                    </span>
                    {count > 0 ? (
                      <span className="sb-count">{count > 9 ? '9+' : count}</span>
                    ) : (
                      <span
                        className={cn('dot', n.status === 'live' && 'ok')}
                        title={n.status}
                      />
                    )}
                  </Link>
                )
              }
              const Icon = n.icon
              const active = isActive(n.href.split('?')[0], n.exact)
              return (
                <Link
                  key={`i-${n.href}-${n.label}`}
                  href={n.href}
                  className={cn('sb-item', active && 'active')}
                  data-label={n.label}
                  title={n.label}
                  onClick={closeDrawer}
                >
                  <Icon className="sb-icon" />
                  <span className="sb-label" style={{ flex: 1 }}>
                    {n.label}
                  </span>
                  {n.count !== undefined && n.count > 0 ? (
                    <span className="sb-count">{n.count > 99 ? '99+' : n.count}</span>
                  ) : null}
                </Link>
              )
            })}
          </nav>

          {/* bottom: mode pill */}
          {manaHubConfig.shell.showEnvironmentBadge ? (
          <div className="sb-mode-card" style={{ padding: 10 }}>
            <Link
              href={manaHubConfig.shell.showSetupPage ? '/dashboard/agents/setup' : '/dashboard/agents'}
              onClick={closeDrawer}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '9px 11px',
                borderRadius: 14,
                background: isDemoMode ? 'var(--demo-soft)' : 'var(--prod-soft)',
                textDecoration: 'none',
              }}
            >
              <span
                className={cn('dot', isDemoMode ? 'warn' : 'ok')}
                style={{ width: 7, height: 7 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: isDemoMode ? 'var(--demo)' : 'var(--prod)',
                  }}
                >
                  {isDemoMode ? 'Demo Mode' : manaHubConfig.environment.label}
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: 'var(--fg-subtle)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {isDemoMode ? 'Lokale Vorschau' : manaHubConfig.environment.detail}
                </div>
              </div>
              <ChevronRight size={12} style={{ color: 'var(--fg-faint)', flex: 'none' }} />
            </Link>
          </div>
          ) : null}
        </div>
      </aside>
      {sbOpen ? <div className="sb-backdrop" onClick={closeDrawer} /> : null}
    </>
  )
}
