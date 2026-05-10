'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { authFetch } from '@/lib/auth-fetch'
import { AGENTS, AGENT_MAP } from '@/lib/agents-meta'
import AgentAvatar from '@/components/ui/AgentAvatar'
import { cn, relativeTime } from '@/lib/utils'
import { onAgentEvent, useNotifications } from '@/lib/notifications/NotificationContext'
import { PageHeader } from '@/components/ui/mana-hub'
import {
  Loader2, MessageSquare, AlertCircle,
  CheckCircle2, RefreshCw, Inbox as InboxIcon, Clock, ArrowRight,
} from 'lucide-react'

interface Message {
  id: string
  agent_name: string
  role: string
  content: string
  created_at: string
}

interface ActivityItem {
  id: number
  agent_id: string
  event_type: string
  event_summary: string
  created_at: string
}

type InboxItem =
  | { kind: 'message'; data: Message }
  | { kind: 'activity'; data: ActivityItem }

type TabKey = 'all' | 'messages' | 'activity'

export default function InboxPage() {
  const router = useRouter()
  const { clear } = useNotifications()
  const [messages, setMessages] = useState<Message[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('all')
  const [selected, setSelected] = useState<string | null>(null)

  const fetchInbox = useCallback(async () => {
    try {
      const ts = Date.now()
      const agents = AGENTS.map(agent => agent.name)
      const [actRes, ...msgResults] = await Promise.all([
        authFetch(`/api/agents/activity?limit=30&_t=${ts}`).then(r => r.json()).then(d => (d.activity || []) as ActivityItem[]).catch(() => [] as ActivityItem[]),
        ...agents.map(a =>
          authFetch(`/api/agents/messages?agent=${a}&limit=10&sort=desc&_t=${ts}`).then(r => r.json()).then(d => (d.messages || []) as Message[]).catch(() => [] as Message[])
        ),
      ])
      const allMsgs = msgResults.flat()
        .filter((m: Message) => m.role === 'assistant')
        .sort((a: Message, b: Message) => b.created_at.localeCompare(a.created_at))
        .slice(0, 30)
      setMessages(allMsgs)
      setActivity(actRes)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchInbox() }, [fetchInbox])

  useEffect(() => {
    return onAgentEvent(() => { fetchInbox() })
  }, [fetchInbox])

  const items: InboxItem[] = (() => {
    const all: InboxItem[] = [
      ...messages.map(m => ({ kind: 'message' as const, data: m })),
      ...activity.map(a => ({ kind: 'activity' as const, data: a })),
    ]
    all.sort((a, b) => b.data.created_at.localeCompare(a.data.created_at))
    return all
  })()

  const filtered = tab === 'all' ? items
    : tab === 'messages' ? items.filter(i => i.kind === 'message')
    : items.filter(i => i.kind === 'activity')

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'all', label: 'Alle', count: items.length },
    { key: 'messages', label: 'Nachrichten', count: messages.length },
    { key: 'activity', label: 'Aktivitäten', count: activity.length },
  ]

  const eventIcon = (type: string) => {
    if (type.includes('error')) return <AlertCircle size={14} style={{ color: 'var(--err)' }} />
    if (type.includes('ok') || type.includes('done')) return <CheckCircle2 size={14} style={{ color: 'var(--ok)' }} />
    if (type.includes('cron')) return <RefreshCw size={14} style={{ color: 'var(--info)' }} />
    return <Clock size={14} style={{ color: 'var(--fg-muted)' }} />
  }

  const selectedItem = filtered.find(item => {
    const id = item.kind === 'message' ? `msg-${item.data.id}` : `act-${item.data.id}`
    return id === selected
  }) || filtered[0]

  if (loading) {
    return (
      <div className="row" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Loader2 size={20} className="animate-spin" style={{ color: 'var(--fg-muted)' }} />
      </div>
    )
  }

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="EINGANG"
        title="Inbox"
        description="Alle Nachrichten und Aktivitäten deiner Agents."
      />

      <div style={{ padding: '4px 28px 0' }}>
        <div className="tabs-scroll">
        <div className="tabs">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn('tab', tab === t.key && 'active')}
            >
              {t.label}
              <span className="brief-tab-count">{t.count}</span>
            </button>
          ))}
        </div>
        </div>
      </div>

      <div style={{ padding: '14px 28px 28px' }}>
        {filtered.length === 0 ? (
          <div className="card card-pad" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <InboxIcon size={28} style={{ margin: '0 auto 10px', color: 'var(--fg-faint)' }} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>Keine Einträge</div>
            <div style={{ fontSize: 12.5, color: 'var(--fg-muted)', marginTop: 4 }}>
              Sobald Agents arbeiten, erscheinen hier ihre Nachrichten und Aktivitäten.
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, display: 'grid', gridTemplateColumns: '360px 1fr', minHeight: 480 }}>
            {/* List */}
            <div style={{ borderRight: '1px solid var(--border)', overflowY: 'auto', maxHeight: '70vh' }}>
              {filtered.map(item => {
                const id = item.kind === 'message' ? `msg-${item.data.id}` : `act-${item.data.id}`
                const isActive = (selected || `msg-${filtered[0]?.kind === 'message' ? filtered[0].data.id : ''}` || id) === id
                if (item.kind === 'message') {
                  const msg = item.data
                  const agent = AGENT_MAP[msg.agent_name]
                  return (
                    <button
                      key={id}
                      onClick={() => setSelected(id)}
                      className={cn('row gap-3', isActive && 'active')}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border)',
                        background: isActive ? 'var(--bg-active)' : 'transparent',
                        cursor: 'pointer',
                        alignItems: 'flex-start',
                      }}
                    >
                      {agent ? <AgentAvatar agent={agent} size="md" /> : <div className="avatar" style={{ background: '#888' }}>?</div>}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{agent?.label || msg.agent_name}</span>
                          <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>{relativeTime(msg.created_at)}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {msg.content.slice(0, 90)}
                        </div>
                      </div>
                    </button>
                  )
                }
                const act = item.data
                const agent = AGENT_MAP[act.agent_id]
                return (
                  <button
                    key={id}
                    onClick={() => setSelected(id)}
                    className={cn('row gap-3', isActive && 'active')}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border)',
                      background: isActive ? 'var(--bg-active)' : 'transparent',
                      cursor: 'pointer',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div className="avatar" style={{ background: 'var(--bg-sunk)' }}>{eventIcon(act.event_type)}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{agent?.label || act.agent_id}</span>
                        <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>{relativeTime(act.created_at)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {act.event_summary}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Detail */}
            <div style={{ padding: '24px 28px', overflowY: 'auto', maxHeight: '70vh' }}>
              {selectedItem ? (
                selectedItem.kind === 'message' ? (
                  <>
                    {(() => {
                      const msg = selectedItem.data
                      const agent = AGENT_MAP[msg.agent_name]
                      return (
                        <>
                          <div className="row gap-3" style={{ alignItems: 'center' }}>
                            {agent ? <AgentAvatar agent={agent} size="lg" /> : <div className="avatar avatar-lg" style={{ background: '#888' }}>?</div>}
                            <div>
                              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: '-0.005em' }}>{agent?.label || msg.agent_name}</h2>
                              <div className="row gap-2" style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 3 }}>
                                <MessageSquare size={11} /> Nachricht · {relativeTime(msg.created_at)}
                              </div>
                            </div>
                          </div>
                          <div style={{ marginTop: 18, fontSize: 13.5, lineHeight: 1.65, color: 'var(--fg)', whiteSpace: 'pre-wrap', maxWidth: '68ch' }}>
                            {msg.content}
                          </div>
                          <div className="row gap-2" style={{ marginTop: 22 }}>
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() => { clear(msg.agent_name); router.push(`/dashboard/agents/${msg.agent_name}/chat`) }}
                            >
                              <MessageSquare size={13} /> Antworten
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => router.push(`/dashboard/agents/${msg.agent_name}`)}
                            >
                              Agent öffnen <ArrowRight size={13} />
                            </button>
                          </div>
                        </>
                      )
                    })()}
                  </>
                ) : (
                  <>
                    {(() => {
                      const act = selectedItem.data
                      const agent = AGENT_MAP[act.agent_id]
                      return (
                        <>
                          <div className="row gap-3" style={{ alignItems: 'center' }}>
                            {agent ? <AgentAvatar agent={agent} size="lg" /> : <div className="avatar avatar-lg" style={{ background: '#888' }}>?</div>}
                            <div>
                              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{agent?.label || act.agent_id}</h2>
                              <div className="row gap-2" style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 3 }}>
                                {eventIcon(act.event_type)}
                                <span className="mono">{act.event_type}</span> · {relativeTime(act.created_at)}
                              </div>
                            </div>
                          </div>
                          <div style={{ marginTop: 18, fontSize: 13.5, lineHeight: 1.65, color: 'var(--fg)', maxWidth: '68ch' }}>
                            {act.event_summary}
                          </div>
                        </>
                      )
                    })()}
                  </>
                )
              ) : (
                <div style={{ color: 'var(--fg-muted)', fontSize: 13 }}>Wähle einen Eintrag aus der Liste.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
