'use client'

import { notFound, useParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { AGENT_MAP } from '@/lib/agents-meta'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/lib/notifications/NotificationContext'
import AgentAvatar from '@/components/ui/AgentAvatar'
import {
  MessageSquare, FileText, Sparkles, Activity,
} from 'lucide-react'

const TABS = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'instructions', label: 'Instructions', icon: FileText },
  { id: 'skills', label: 'Skills', icon: Sparkles },
  { id: '', label: 'Dashboard', icon: Activity },
] as const

export default function AgentDetailLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const pathname = usePathname()
  const agentName = (params.name as string).toLowerCase()
  const meta = AGENT_MAP[agentName]
  if (!meta) notFound()
  const { heartbeats } = useNotifications()
  const heartbeat = heartbeats[agentName] || null

  const basePath = `/dashboard/agents/${agentName}`
  const activeTab = pathname.replace(basePath, '').replace(/^\//, '') || ''
  const isChat = activeTab === 'chat'

  const status = heartbeat?.status ?? 'offline'
  const isLive = status === 'online' || status === 'busy'

  const role = (meta?.role || 'Agent').toUpperCase()
  const bio = meta?.bio || ''
  const contextUsage = heartbeat?.context_usage_percent
  const contextPct = contextUsage == null ? null : Math.max(0, Math.min(100, Math.round(contextUsage)))
  const contextTone = contextPct == null
    ? 'var(--fg-faint)'
    : contextPct >= 85
      ? 'var(--warn)'
      : 'var(--accent)'

  return (
    <div
      className={cn('agent-detail', 'fade-in')}
      style={
        isChat
          ? { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }
          : { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }
      }
    >
      {/* Compact Hero */}
      <div style={{ padding: '18px 28px 0', flex: 'none' }}>
        <div className="card" style={{ padding: '12px 16px', overflow: 'visible', position: 'relative' }}>
          <div className="row gap-3" style={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 10 }}>
            <AgentAvatar agent={meta} size="lg" className="agent-hero-avatar" />
            <div style={{ minWidth: 0, flex: '0 1 auto' }}>
              <div className="row gap-2" style={{ alignItems: 'baseline', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>
                  {meta?.label || agentName.toUpperCase()}
                </h1>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--fg-subtle)',
                  }}
                >
                  {role}
                </span>
                {isLive ? (
                  <span className="badge badge-ok" style={{ fontSize: 10.5 }}>
                    <span className="badge-dot" /> live
                  </span>
                ) : (
                  <span className="badge" style={{ fontSize: 10.5 }}>
                    <span className="badge-dot" /> {status}
                  </span>
                )}
              </div>
              {bio && (
                <div
                  style={{
                    fontSize: 11.5,
                    color: 'var(--fg-muted)',
                    marginTop: 2,
                    maxWidth: 520,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {bio}
                </div>
              )}
            </div>
            <div
              className="row gap-3 agent-hero-right"
              style={{ flex: '1 1 auto', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}
            >
              <div style={{ minWidth: 190, maxWidth: 260, flex: '1 1 220px' }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--fg-faint)' }}>
                    Context window
                  </span>
                  <span className="tabular" style={{ fontSize: 13, fontWeight: 650, color: contextTone }}>
                    {contextPct == null ? '—' : `${contextPct}%`}
                  </span>
                </div>
                <div style={{ height: 7, borderRadius: 999, background: 'var(--bg-sunk)', overflow: 'hidden', border: '1px solid var(--border)', marginTop: 6 }} title="Context window usage before compaction">
                  <div style={{ width: `${contextPct ?? 0}%`, height: '100%', borderRadius: 999, background: contextTone, transition: 'width .2s ease' }} />
                </div>
                <div style={{ marginTop: 4, fontSize: 10.5, color: 'var(--fg-faint)' }}>
                  before compaction
                </div>
              </div>
              <div className="row gap-2">
                <button type="button" className="btn btn-sm">Konfigurieren</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs row */}
      <div
        style={{ padding: '10px 28px 0', display: 'flex', gap: 4, overflowX: 'auto', flex: 'none' }}
        className="scrollbar-none"
      >
        {TABS.map(tab => {
          const href = tab.id ? `${basePath}/${tab.id}` : basePath
          const isActive = activeTab === tab.id
          return (
            <Link key={tab.id || 'dashboard'} href={href} className="agent-tab" data-active={isActive}>
              <tab.icon size={13} />
              {tab.label}
            </Link>
          )
        })}
      </div>

      {/* Tab Content */}
      <div
        style={
          isChat
            ? {
                flex: 1,
                minHeight: 0,
                padding: '12px 28px 16px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }
            : { flex: 1, minHeight: 0, padding: '14px 28px 28px' }
        }
      >
        {children}
      </div>
    </div>
  )
}
