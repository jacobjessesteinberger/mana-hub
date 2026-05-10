'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  Activity,
  Inbox,
  LayoutGrid,
  MessageSquare,
  Moon,
  Sun,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AGENTS } from '@/lib/agents-meta'
import AgentAvatar from '@/components/ui/AgentAvatar'
import { useNotifications } from '@/lib/notifications/NotificationContext'

const HOME_HREF = '/dashboard/agents'
const INBOX_HREF = '/dashboard/agents/inbox'
const HEALTH_HREF = '/dashboard/agents/health'

export default function MobileTabBar() {
  const pathname = usePathname() || ''
  const router = useRouter()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { totalCount, counts } = useNotifications()

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  const [chatPickerOpen, setChatPickerOpen] = useState(false)

  const isHome = pathname === HOME_HREF
  const isInbox = pathname.startsWith(INBOX_HREF)
  const isHealth = pathname.startsWith(HEALTH_HREF)
  const isChat = /^\/dashboard\/agents\/[^/]+\/chat(?:\/)?$/.test(pathname)

  const onlyAgent = AGENTS.length === 1 ? AGENTS[0] : null

  const openChats = () => {
    if (onlyAgent) {
      router.push(`/dashboard/agents/${onlyAgent.name}/chat`)
      return
    }
    setChatPickerOpen(true)
  }

  const toggleTheme = () => {
    const current = (theme === 'system' ? resolvedTheme : theme) ?? 'dark'
    setTheme(current === 'dark' ? 'light' : 'dark')
  }

  const themeIcon = !mounted
    ? <Moon size={18} />
    : (theme === 'system' ? resolvedTheme : theme) === 'dark'
      ? <Sun size={18} />
      : <Moon size={18} />

  return (
    <>
      <nav className="mobile-tabbar" aria-label="Schnellnavigation">
        <Link
          href={HOME_HREF}
          className={cn('mobile-tab', isHome && 'is-active')}
          aria-current={isHome ? 'page' : undefined}
        >
          <LayoutGrid size={18} />
          <span>Dashboard</span>
        </Link>

        <button
          type="button"
          onClick={openChats}
          className={cn('mobile-tab', isChat && 'is-active')}
          aria-current={isChat ? 'page' : undefined}
        >
          <MessageSquare size={18} />
          <span>Chats</span>
        </button>

        <Link
          href={INBOX_HREF}
          className={cn('mobile-tab', isInbox && 'is-active')}
          aria-current={isInbox ? 'page' : undefined}
        >
          <span className="mobile-tab-icon-wrap">
            <Inbox size={18} />
            {totalCount > 0 ? (
              <span className="mobile-tab-badge">
                {totalCount > 9 ? '9+' : totalCount}
              </span>
            ) : null}
          </span>
          <span>Inbox</span>
        </Link>

        <Link
          href={HEALTH_HREF}
          className={cn('mobile-tab', isHealth && 'is-active')}
          aria-current={isHealth ? 'page' : undefined}
        >
          <Activity size={18} />
          <span>Health</span>
        </Link>

        <button
          type="button"
          onClick={toggleTheme}
          className="mobile-tab"
          aria-label="Theme wechseln"
        >
          {themeIcon}
          <span>Theme</span>
        </button>
      </nav>

      {chatPickerOpen ? (
        <div
          className="mobile-tabbar-sheet-backdrop"
          onClick={() => setChatPickerOpen(false)}
        >
          <div
            className="mobile-tabbar-sheet"
            role="dialog"
            aria-label="Chat auswaehlen"
            onClick={e => e.stopPropagation()}
          >
            <div className="mobile-tabbar-sheet-head">
              <div>
                <div className="mobile-tabbar-sheet-eyebrow">Chats</div>
                <div className="mobile-tabbar-sheet-title">Agent auswaehlen</div>
              </div>
              <button
                type="button"
                className="mobile-tabbar-sheet-close"
                onClick={() => setChatPickerOpen(false)}
                aria-label="Schliessen"
              >
                <X size={16} />
              </button>
            </div>
            <ul className="mobile-tabbar-sheet-list">
              {AGENTS.map(agent => {
                const count = counts[agent.name] || 0
                return (
                  <li key={agent.name}>
                    <Link
                      href={`/dashboard/agents/${agent.name}/chat`}
                      className="mobile-tabbar-sheet-row"
                      onClick={() => setChatPickerOpen(false)}
                    >
                      <AgentAvatar agent={agent} size="md" />
                      <div className="mobile-tabbar-sheet-row-text">
                        <div className="mobile-tabbar-sheet-row-name">
                          {agent.label}
                        </div>
                        <div className="mobile-tabbar-sheet-row-role">
                          {agent.role}
                        </div>
                      </div>
                      {count > 0 ? (
                        <span className="mobile-tabbar-sheet-row-count">
                          {count > 9 ? '9+' : count}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  )
}
