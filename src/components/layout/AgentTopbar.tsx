'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Bell, Menu, Moon, Search, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth/AuthContext'
import { useSidebar } from '@/components/layout/SidebarContext'
import AgentAvatar from '@/components/ui/AgentAvatar'
import { AGENTS } from '@/lib/agents-meta'
import { manaHubConfig } from '@/lib/mana-hub-config'

const TITLE_MAP: Record<string, string> = {
  '/dashboard/agents': 'Dashboard',
  '/dashboard/agents/inbox': 'Inbox',
  '/dashboard/agents/issues': 'Tasks',
  '/dashboard/agents/projects': 'Workspaces',
  '/dashboard/agents/goals': 'Outcomes',
  '/dashboard/agents/briefings': 'Briefings',
  '/dashboard/agents/approvals': 'Risk Approval',
  '/dashboard/agents/routines': 'Jobs & Skills',
  '/dashboard/agents/setup': 'Setup',
  '/dashboard/agents/knowledge': 'Knowledge Base',
  '/dashboard/agents/health': 'Health',
  '/dashboard/agents/org': 'Org',
}

function buildBreadcrumb(pathname: string): { items: string[]; title: string } {
  if (TITLE_MAP[pathname]) return { items: [], title: TITLE_MAP[pathname] }
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length >= 3 && segments[0] === 'dashboard' && segments[1] === 'agents') {
    const third = segments[2]
    const agent = AGENTS.find(a => a.name === third)
    if (agent) {
      const tab = segments[3] ?? 'chat'
      const tabLabel = ({ chat: 'Chat', instructions: 'Instructions', skills: 'Skills', dashboard: 'Dashboard' } as Record<string, string>)[tab] ?? tab
      return { items: ['Agents', agent.label, tabLabel], title: agent.label }
    }
    if (segments[2] === 'issues' && segments[3]) {
      return { items: ['Tasks', segments[3]], title: 'Task' }
    }
    if (segments[2] === 'projects' && segments[3]) {
      return { items: ['Workspaces', segments[3]], title: 'Workspace' }
    }
  }
  const last = segments[segments.length - 1] ?? ''
  return { items: [], title: last.charAt(0).toUpperCase() + last.slice(1) || 'Mana Hub' }
}

export default function AgentTopbar() {
  const pathname = usePathname()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { isDemoMode } = useAuth()
  const { open: sbOpen, toggle: toggleSidebar } = useSidebar()

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])
  const activeTheme = mounted ? (theme === 'system' ? resolvedTheme : theme) : null

  const { items: breadcrumb, title } = buildBreadcrumb(pathname || '')

  const openSearch = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('ah:open-command-palette'))
    }
  }

  return (
    <div className="tb">
      <button
        type="button"
        className="sb-toggle"
        onClick={toggleSidebar}
        aria-label="Menu"
        aria-expanded={sbOpen}
        title="Menu"
      >
        <Menu size={16} />
      </button>

      {breadcrumb.length > 0 ? (
        <div className="row gap-2" style={{ fontSize: 13 }}>
          {breadcrumb.map((b, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {i > 0 ? <span style={{ color: 'var(--fg-faint)' }}>›</span> : null}
              <span
                style={{
                  color: i === breadcrumb.length - 1 ? 'var(--fg)' : 'var(--fg-muted)',
                  fontWeight: i === breadcrumb.length - 1 ? 500 : 400,
                }}
              >
                {b}
              </span>
            </span>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 13.5, fontWeight: 500 }}>{title}</div>
      )}

      <div className="spacer" />

      {manaHubConfig.shell.showEnvironmentBadge ? (
        <Link
          href={manaHubConfig.shell.showSetupPage ? '/dashboard/agents/setup' : '/dashboard/agents'}
          className={cn('mode-pill tb-mode-pill', isDemoMode ? 'demo' : 'prod')}
          title={isDemoMode ? 'Demo Mode · klick zum Verbinden' : `${manaHubConfig.environment.label} · ${manaHubConfig.environment.detail}`}
        >
          <span className={cn('dot', isDemoMode ? 'warn' : 'ok')} />
          <span className="mode-pill-label">{isDemoMode ? 'Demo' : manaHubConfig.environment.label}</span>
          <span className="mode-pill-action">
            {isDemoMode ? 'Mit Supabase verbinden' : manaHubConfig.environment.detail}
          </span>
        </Link>
      ) : null}

      {manaHubConfig.shell.showSearch ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm tb-search"
          title="Suchen"
          onClick={openSearch}
          style={{ paddingRight: 8 }}
        >
          <Search size={13} />
          <span style={{ color: 'var(--fg-muted)' }}>Suchen</span>
          <span className="kbd" style={{ marginLeft: 6 }}>⌘K</span>
        </button>
      ) : null}

      {manaHubConfig.shell.showThemeToggle ? (
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-sm"
          onClick={() => setTheme(activeTheme === 'dark' ? 'light' : 'dark')}
          title="Theme"
          suppressHydrationWarning
        >
          <span suppressHydrationWarning>
            {activeTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </span>
        </button>
      ) : null}

      <button type="button" className="btn btn-ghost btn-icon btn-sm" title="Notifications">
        <Bell size={14} />
      </button>

      {manaHubConfig.shell.showUserAvatar ? (
        <AgentAvatar
          agent={{ avatar: '', label: 'You', color: 'linear-gradient(135deg, #10B981, #059669)' }}
          size="md"
        />
      ) : null}
    </div>
  )
}
