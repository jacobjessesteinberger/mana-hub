'use client'

import type { ReactNode } from 'react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Archive,
  Bookmark,
  CheckCircle2,
  Clock3,
  FileText,
  Inbox,
  Loader2,
  MessageCircle,
  Newspaper,
  RefreshCw,
  MoreHorizontal,
  Plus,
  type LucideIcon,
} from 'lucide-react'
import { authFetch } from '@/lib/auth-fetch'
import { AGENT_MAP } from '@/lib/agents-meta'
import AgentAvatar from '@/components/ui/AgentAvatar'
import { cn, relativeTime } from '@/lib/utils'
import MarkdownContent from '@/components/chat/MarkdownContent'

type MainViewKey = 'inbox' | 'all' | 'unread' | 'catchup'
type StateAction = 'mark_read' | 'mark_unread' | 'archive' | 'unarchive' | 'pin' | 'unpin' | 'dismiss_urgency'
type BriefingUrgency = 'low' | 'normal' | 'high' | 'critical'
type GroupKey = 'Heute' | 'Gestern' | 'Diese Woche' | 'Älter'

const GROUP_ORDER: GroupKey[] = ['Heute', 'Gestern', 'Diese Woche', 'Älter']

interface Briefing {
  id: string
  agent_name: string
  role: 'assistant'
  content: string
  ticket_id: string | null
  reply_to_id: string | null
  created_at: string
  metadata?: {
    title?: string
    category?: string
    urgency?: BriefingUrgency
    summary?: string
    action_required?: boolean
    [key: string]: unknown
  }
  read_at: string | null
  archived_at: string | null
  pinned_at: string | null
  dismissed_urgency_at: string | null
  is_unread: boolean
  is_archived: boolean
  is_pinned: boolean
  needs_attention: boolean
}

interface BriefingStats {
  total: number
  unread: number
  needs_attention: number
  catchup: number
  archived: number
  today_unread: number
}

function titleFromBriefing(briefing: Briefing): string {
  if (briefing.metadata?.title?.trim()) return briefing.metadata.title
  const { content } = briefing
  const firstHeading = content.split('\n').find(line => line.trim().startsWith('#'))
  if (firstHeading) return firstHeading.replace(/^#+\s*/, '').trim().slice(0, 90)
  return content.replace(/\s+/g, ' ').trim().slice(0, 90) || 'Agent Briefing'
}

function summaryFromBriefing(briefing: Briefing): string {
  if (briefing.metadata?.summary?.trim()) return briefing.metadata.summary
  return briefing.content.replace(/\s+/g, ' ').trim().slice(0, 180)
}

function categoryFromBriefing(briefing: Briefing): string {
  return briefing.metadata?.category?.trim() || 'Briefing'
}

function groupLabel(date: string): GroupKey {
  const created = new Date(date)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (created.toDateString() === today.toDateString()) return 'Heute'
  if (created.toDateString() === yesterday.toDateString()) return 'Gestern'
  if (today.getTime() - created.getTime() < 7 * 24 * 60 * 60 * 1000) return 'Diese Woche'
  return 'Älter'
}

function applyLocalState(briefing: Briefing, state: Partial<Briefing>): Briefing {
  const next = { ...briefing, ...state }
  const urgency = next.metadata?.urgency || 'low'
  return {
    ...next,
    is_unread: !next.read_at,
    is_archived: Boolean(next.archived_at),
    is_pinned: Boolean(next.pinned_at),
    needs_attention: !next.dismissed_urgency_at && (
      urgency === 'critical' ||
      urgency === 'high' ||
      next.metadata?.action_required === true
    ),
  }
}

function isTodayBriefing(briefing: Briefing): boolean {
  return new Date(briefing.created_at).toDateString() === new Date().toDateString()
}

function adjustStatsForAction(stats: BriefingStats | null, briefing: Briefing, action: StateAction): BriefingStats | null {
  if (!stats) return stats

  const wasUnread = briefing.is_unread && !briefing.is_archived
  const wasArchived = briefing.is_archived
  const isToday = isTodayBriefing(briefing)
  const isCatchup = !isToday
  const deltaUnread = action === 'mark_read' && wasUnread
    ? -1
    : action === 'mark_unread' && !briefing.is_unread && !briefing.is_archived
      ? 1
      : action === 'archive' && wasUnread
        ? -1
        : action === 'unarchive' && briefing.is_unread && wasArchived
          ? 1
          : 0
  const deltaArchived = action === 'archive' && !wasArchived
    ? 1
    : action === 'unarchive' && wasArchived
      ? -1
      : 0

  return {
    ...stats,
    unread: Math.max(0, stats.unread + deltaUnread),
    today_unread: Math.max(0, stats.today_unread + (isToday ? deltaUnread : 0)),
    catchup: Math.max(0, stats.catchup + (isCatchup ? deltaUnread : 0)),
    archived: Math.max(0, stats.archived + deltaArchived),
  }
}

export default function BriefingsPage() {
  const [briefings, setBriefings] = useState<Briefing[]>([])
  const [stats, setStats] = useState<BriefingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [mainView, setMainView] = useState<MainViewKey>('inbox')
  const [agentFilter, setAgentFilter] = useState<string>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [briefingDetails, setBriefingDetails] = useState<Record<string, Briefing>>({})
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const selectedBriefingRef = useRef<Briefing | null>(null)

  const load = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        view: mainView === 'unread' ? 'all' : mainView,
        limit: '100',
        days: '60',
        content: 'summary',
        _t: String(Date.now()),
      })
      if (mainView === 'unread') params.set('status', 'unread')
      if (agentFilter !== 'all') params.set('agent', agentFilter)
      const res = await authFetch(`/api/agents/briefings?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Briefings konnten nicht geladen werden')
      const nextBriefings = (data.briefings || []) as Briefing[]
      setBriefings(nextBriefings)
      setStats(data.stats || null)
      setBriefingDetails(current => {
        const nextIds = new Set(nextBriefings.map(item => item.id))
        return Object.fromEntries(Object.entries(current).filter(([id]) => nextIds.has(id)))
      })
      setSelectedId(current => current && nextBriefings.some((item: Briefing) => item.id === current)
        ? current
        : nextBriefings[0]?.id || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Briefings konnten nicht geladen werden')
    }
    finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [agentFilter, mainView])

  useEffect(() => { load() }, [load])

  const agentsWithBriefings = useMemo(
    () => Object.keys(AGENT_MAP).sort(),
    [],
  )

  const selectedListBriefing = useMemo(
    () => briefings.find(briefing => briefing.id === selectedId) || null,
    [briefings, selectedId],
  )

  const selectedBriefing = useMemo(() => {
    if (!selectedListBriefing) return null
    const detail = briefingDetails[selectedListBriefing.id]
    if (!detail) return selectedListBriefing

    return {
      ...selectedListBriefing,
      ...detail,
      metadata: {
        ...(selectedListBriefing.metadata || {}),
        ...(detail.metadata || {}),
      },
      read_at: selectedListBriefing.read_at,
      archived_at: selectedListBriefing.archived_at,
      pinned_at: selectedListBriefing.pinned_at,
      dismissed_urgency_at: selectedListBriefing.dismissed_urgency_at,
      is_unread: selectedListBriefing.is_unread,
      is_archived: selectedListBriefing.is_archived,
      is_pinned: selectedListBriefing.is_pinned,
      needs_attention: selectedListBriefing.needs_attention,
    }
  }, [briefingDetails, selectedListBriefing])

  const groupedBriefings = useMemo(() => {
    const groups = briefings.reduce<Record<GroupKey, Briefing[]>>((acc, briefing) => {
      const label = groupLabel(briefing.created_at)
      acc[label].push(briefing)
      return acc
    }, {
      Heute: [],
      Gestern: [],
      'Diese Woche': [],
      Älter: [],
    })

    return GROUP_ORDER
      .map(label => ({
        label,
        items: groups[label].sort((a, b) => b.created_at.localeCompare(a.created_at)),
      }))
      .filter(group => group.items.length > 0)
  }, [briefings])

  const markReadOnLeave = useCallback(async (briefing: Briefing) => {
    await authFetch(`/api/agents/briefings/${briefing.id}/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read' }),
    }).catch(() => null)
  }, [])

  const updateBriefingState = useCallback(async (briefing: Briefing, action: StateAction) => {
    const res = await authFetch(`/api/agents/briefings/${briefing.id}/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Status konnte nicht aktualisiert werden')

    const state = data.state || {}
    setStats(current => adjustStatsForAction(current, briefing, action))
    const shouldRemoveFromCurrentView = (
      action === 'mark_read' && (mainView === 'inbox' || mainView === 'catchup' || mainView === 'unread') && selectedId !== briefing.id
    )
    setBriefings(current => current
      .map(item => item.id === briefing.id ? applyLocalState(item, state) : item)
      .filter(item => !shouldRemoveFromCurrentView || item.id !== briefing.id))
  }, [mainView, selectedId])

  const selectBriefing = useCallback(async (briefing: Briefing) => {
    const previous = selectedBriefingRef.current
    setSelectedId(briefing.id)
    if (previous && previous.id !== briefing.id && previous.is_unread) {
      void updateBriefingState(previous, 'mark_read')
      if (mainView === 'inbox' || mainView === 'catchup') {
        setBriefings(current => current.filter(item => item.id !== previous.id))
      }
    }
  }, [mainView, updateBriefingState])

  useEffect(() => {
    selectedBriefingRef.current = selectedBriefing
  }, [selectedBriefing])

  useEffect(() => {
    if (!selectedListBriefing) return
    if (selectedListBriefing.content || briefingDetails[selectedListBriefing.id]) return

    let cancelled = false
    const id = selectedListBriefing.id
    setDetailLoadingId(id)

    async function loadDetail() {
      try {
        const res = await authFetch(`/api/agents/briefings/${id}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Briefing konnte nicht geladen werden')
        if (!cancelled && data.briefing) {
          setBriefingDetails(current => ({
            ...current,
            [id]: data.briefing as Briefing,
          }))
        }
      } catch {
        if (!cancelled) setError('Report konnte nicht geladen werden')
      } finally {
        if (!cancelled) setDetailLoadingId(null)
      }
    }

    loadDetail()
    return () => { cancelled = true }
  }, [briefingDetails, selectedListBriefing])

  useEffect(() => {
    return () => {
      const current = selectedBriefingRef.current
      if (current?.is_unread) {
        void markReadOnLeave(current)
      }
    }
  }, [markReadOnLeave])

  const mainViews: { key: MainViewKey; label: string; icon: LucideIcon; count?: number }[] = [
    { key: 'inbox', label: 'Inbox', icon: Inbox, count: stats?.unread },
    { key: 'all', label: 'Alle Reports', icon: Newspaper, count: stats?.total },
    { key: 'unread', label: 'Ungelesen', icon: Archive, count: stats?.unread },
    { key: 'catchup', label: 'Catch-up', icon: Clock3, count: stats?.catchup },
  ]

  return (
    <div className="briefings-page fade-in flex h-full min-h-0 flex-col overflow-hidden">
      <div className="briefings-pagehead">
        <FileText size={16} />
        <h1>Briefing Inbox</h1>
        <div className="spacer" />
        <button onClick={load} disabled={refreshing} className="btn btn-sm btn-ghost">
              {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Aktualisieren
        </button>
      </div>

      <div className="briefings-shell">
        <div className="card briefings-toolbar">
            <div className="row gap-1" style={{ flexWrap: 'wrap' }}>
              {mainViews.map(item => (
                  <button
                    key={item.key}
                    onClick={() => setMainView(item.key)}
                    className="brief-tab"
                    data-active={mainView === item.key}
                  >
                    {item.label}
                    {typeof item.count === 'number' && item.count > 0 && (
                      <span className="brief-tab-count">
                        {item.count}
                      </span>
                    )}
                  </button>
              ))}
            </div>
            <div className="spacer" />
          <div className="row gap-1" style={{ flexWrap: 'wrap' }}>
            <button
              onClick={() => setAgentFilter('all')}
              className="brief-agent-pill"
              data-active={agentFilter === 'all'}
            >
              Alle Agents
            </button>
            {agentsWithBriefings.map(agentName => {
              const agent = AGENT_MAP[agentName]
              return (
                <button
                  key={agentName}
                  onClick={() => setAgentFilter(agentName)}
                  className="brief-agent-pill"
                  data-active={agentFilter === agentName}
                >
                  {agent && <AgentAvatar agent={agent} size="xs" />}
                  {agent?.label || agentName.toUpperCase()}
                </button>
              )
            })}
            </div>
        </div>

      {error && (
        <div className="badge badge-err mb-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="min-h-0 flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        </div>
      ) : briefings.length === 0 ? (
        <div className="card card-pad text-center">
          <FileText className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {mainView === 'inbox' ? 'Alles gelesen. Keine offenen Briefings.' : 'Keine Briefings in dieser Ansicht'}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {mainView === 'inbox'
              ? 'Deine Briefing-Inbox ist leer. Neue Reports erscheinen hier automatisch.'
              : 'Wechsel die Ansicht oder aktualisiere, sobald neue Agent-Reports angekommen sind.'}
          </p>
        </div>
      ) : (
        <div className="briefings-columns">
          <div className="card briefings-list-card">
            <div className="briefings-list-scroll">
            {groupedBriefings.map(({ label, items }) => (
              <section key={label}>
                <div className="briefings-day-header">{label}</div>
                  {items.map(briefing => (
                    <BriefingListItem
                      key={briefing.id}
                      briefing={briefing}
                      selected={selectedBriefing?.id === briefing.id}
                      onSelect={selectBriefing}
                    />
                  ))}
              </section>
            ))}
            </div>
          </div>
          {selectedBriefing && (
            <ReaderPanel
              briefing={selectedBriefing}
              loading={detailLoadingId === selectedBriefing.id && !selectedBriefing.content}
              onAction={updateBriefingState}
            />
          )}
        </div>
      )}
      </div>
    </div>
  )
}

function AgentIdentity({ briefing, size = 'sm' }: { briefing: Briefing; size?: 'xs' | 'sm' | 'md' }) {
  const agent = AGENT_MAP[briefing.agent_name]
  return agent ? (
    <AgentAvatar agent={agent} size={size} />
  ) : (
    <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs font-semibold text-zinc-500">
      {briefing.agent_name.slice(0, 2).toUpperCase()}
    </div>
  )
}

const BriefingListItem = memo(function BriefingListItem({ briefing, selected, onSelect }: {
  briefing: Briefing
  selected: boolean
  onSelect: (briefing: Briefing) => void
}) {
  const agent = AGENT_MAP[briefing.agent_name]
  return (
    <div
      onClick={() => { onSelect(briefing) }}
      className={cn('brief-list-item', !briefing.is_unread && 'opacity-75')}
      data-active={selected}
      data-unread={briefing.is_unread}
    >
      <AgentIdentity briefing={briefing} size="md" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: briefing.is_unread ? 'var(--fg)' : 'var(--fg-subtle)',
            }}
          >
            {agent?.label || briefing.agent_name.toUpperCase()}
          </span>
          <span style={{ fontSize: 11, color: 'var(--fg-faint)', flex: 'none' }}>
            {relativeTime(briefing.created_at)}
          </span>
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: briefing.is_unread ? 600 : 500,
            marginTop: 2,
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            color: briefing.is_unread ? 'var(--fg)' : 'var(--fg-muted)',
          }}
        >
          {titleFromBriefing(briefing)}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--fg-subtle)',
            marginTop: 3,
            lineHeight: 1.45,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {summaryFromBriefing(briefing)}
        </div>
      </div>
      {briefing.is_unread && <span className="brief-unread-dot" aria-hidden />}
    </div>
  )
})

function StateButton({ onClick, icon: Icon, children }: {
  onClick: () => void
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <button type="button" onClick={onClick} className="btn btn-xs btn-ghost">
      <Icon className="w-3.5 h-3.5" />
      {children}
    </button>
  )
}

const ReaderPanel = memo(function ReaderPanel({ briefing, loading, onAction }: {
  briefing: Briefing
  loading: boolean
  onAction: (briefing: Briefing, action: StateAction) => Promise<void>
}) {
  const agent = AGENT_MAP[briefing.agent_name]
  const [menuOpen, setMenuOpen] = useState(false)
  const [taskCreating, setTaskCreating] = useState(false)
  const [taskCreatedId, setTaskCreatedId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const kind = categoryFromBriefing(briefing)
  const kindCls = kind.toLowerCase().includes('morning')
    ? 'badge-info'
    : kind.toLowerCase().includes('maintenance')
      ? 'badge-warn'
      : 'badge'

  async function runAction(action: StateAction) {
    setActionError(null)
    try {
      await onAction(briefing, action)
      setMenuOpen(false)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Aktion konnte nicht ausgefuehrt werden')
    }
  }

  async function createTaskFromBriefing() {
    if (taskCreating) return
    setTaskCreating(true)
    setActionError(null)
    try {
      const urgency = briefing.metadata?.urgency || 'normal'
      const res = await authFetch('/api/agents/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: titleFromBriefing(briefing).slice(0, 120),
          description: `Aus Briefing vom ${new Date(briefing.created_at).toLocaleString('de-DE')}\n\n${summaryFromBriefing(briefing)}\n\n---\n\n${briefing.content || ''}`.slice(0, 10000),
          status: 'todo',
          priority: urgency === 'critical' ? 'critical' : urgency === 'high' ? 'high' : 'medium',
          agent_name: briefing.agent_name,
          labels: ['briefing'],
          source_type: 'briefing',
          source_id: briefing.id,
          next_action: 'Briefing in einen konkreten naechsten Schritt uebersetzen.',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Task konnte nicht erstellt werden')
      setTaskCreatedId(data.issue?.id || null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Task konnte nicht erstellt werden')
    } finally {
      setTaskCreating(false)
    }
  }

  return (
    <article className="card briefings-detail-card">
      <div
        style={{
          padding: '18px 24px 14px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          flex: 'none',
        }}
      >
        <div className="row gap-3" style={{ alignItems: 'center' }}>
          <AgentIdentity briefing={briefing} size="md" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>
              {agent?.label || briefing.agent_name.toUpperCase()}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)' }}>
              {new Date(briefing.created_at).toLocaleString('de-DE')}
            </div>
          </div>
          <button
            className={`btn btn-ghost btn-icon btn-sm ${briefing.is_pinned ? 'active' : ''}`}
            title={briefing.is_pinned ? 'Merker entfernen' : 'Merken'}
            type="button"
            onClick={() => { void runAction(briefing.is_pinned ? 'unpin' : 'pin') }}
          >
            <Bookmark size={14} fill={briefing.is_pinned ? 'currentColor' : 'none'} />
          </button>
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-ghost btn-icon btn-sm"
              title="Weitere Aktionen"
              type="button"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(open => !open)}
            >
              <MoreHorizontal size={14} />
            </button>
            {menuOpen ? (
              <div className="card" style={{ position: 'absolute', right: 0, top: 34, zIndex: 20, width: 190, padding: 6, boxShadow: 'var(--shadow-card)' }}>
                <button className="btn btn-ghost btn-sm" type="button" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => { void runAction(briefing.is_unread ? 'mark_read' : 'mark_unread') }}>
                  {briefing.is_unread ? 'Als gelesen markieren' : 'Als ungelesen markieren'}
                </button>
                <button className="btn btn-ghost btn-sm" type="button" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => { void runAction(briefing.is_archived ? 'unarchive' : 'archive') }}>
                  {briefing.is_archived ? 'Aus Archiv holen' : 'Archivieren'}
                </button>
                {briefing.needs_attention ? (
                  <button className="btn btn-ghost btn-sm" type="button" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => { void runAction('dismiss_urgency') }}>
                    Aktion erledigt
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.015em', lineHeight: 1.3 }}>
          {titleFromBriefing(briefing)}
        </h1>
        <div className="row gap-1" style={{ flexWrap: 'wrap' }}>
          <span className={`badge ${kindCls}`}>{kind}</span>
          {briefing.is_unread && <span className="badge badge-accent">Ungelesen</span>}
          {briefing.is_pinned && <span className="badge badge-info">Gemerkt</span>}
          {actionError && <span className="badge badge-err">{actionError}</span>}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px 24px' }}>
        {loading ? (
          <div style={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
          </div>
        ) : (
          <div className="briefing-body">
            <MarkdownContent content={briefing.content} />
          </div>
        )}
      </div>

      <div
        style={{
          padding: '10px 14px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-elev)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          flex: 'none',
        }}
      >
        <button
          onClick={() => { void runAction(briefing.is_unread ? 'mark_read' : 'mark_unread') }}
          className="btn btn-ghost btn-sm"
          type="button"
        >
          <CheckCircle2 size={12} /> {briefing.is_unread ? 'Als gelesen markieren' : 'Als ungelesen markieren'}
        </button>
        {briefing.needs_attention && (
          <StateButton onClick={() => { void runAction('dismiss_urgency') }} icon={CheckCircle2}>
            Aktion erledigt
          </StateButton>
        )}
        <span style={{ flex: 1 }} />
        {taskCreatedId ? (
          <Link className="btn btn-sm" href={`/dashboard/agents/issues/${taskCreatedId}`}>
            Task oeffnen
          </Link>
        ) : (
          <button className="btn btn-sm" type="button" onClick={createTaskFromBriefing} disabled={taskCreating}>
            {taskCreating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Task erstellen
          </button>
        )}
        <Link
          href={`/dashboard/agents/${briefing.agent_name}/chat?briefing=${briefing.id}`}
          className="btn btn-primary btn-sm"
        >
          <MessageCircle size={12} />
          Im Chat antworten
        </Link>
      </div>
    </article>
  )
})

