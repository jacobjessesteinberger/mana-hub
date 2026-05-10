"use client"

import { useCallback, useEffect, useState } from 'react'
import { Calendar, Check, Clock, Loader2, X } from 'lucide-react'
import { AHPill, PageHeader } from '@/components/ui/mana-hub'
import AgentAvatar from '@/components/ui/AgentAvatar'
import { AGENT_MAP, AGENTS } from '@/lib/agents-meta'
import { authFetch } from '@/lib/auth-fetch'

type CronStatus = 'pending' | 'approved' | 'rejected'
type CronAction = 'create' | 'update' | 'delete'

interface CronRequestRow {
  id: string
  agent_name?: string | null
  action?: CronAction | string | null
  job_name?: string | null
  schedule_hour?: number | null
  schedule_minute?: number | null
  schedule_day?: number | null
  prompt?: string | null
  reason?: string | null
  target_job_id?: string | null
  request_type?: string | null
  status?: CronStatus | string | null
  risk_level?: string | null
  source?: string | null
  created_at?: string | null
  reviewed_at?: string | null
  reviewed_by?: string | null
}

interface CronRequestItem {
  id: string
  agent: string
  jobName: string
  action: CronAction
  schedule: string
  reason: string
  prompt: string
  risk: string
  source: string
  status: CronStatus
  time: string
  reviewedBy?: string | null
}

const RISK_CLASS: Record<string, string> = {
  critical: 'badge-err',
  high: 'badge-err',
  medium: 'badge-warn',
  low: '',
}

const ACTION_LABEL: Record<CronAction, string> = {
  create: 'Anlegen',
  update: 'Aendern',
  delete: 'Loeschen',
}

function relativeTime(iso?: string | null) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(diff)) return ''
  if (diff < 60000) return 'gerade eben'
  const min = Math.floor(diff / 60000)
  if (min < 60) return `vor ${min} Min`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `vor ${hours} Std`
  return `vor ${Math.floor(hours / 24)} T`
}

function formatSchedule(hour: number | null | undefined, minute: number | null | undefined, day: number | null | undefined): string {
  if (hour === null || hour === undefined) return 'kein Zeitplan'
  const h = String(hour).padStart(2, '0')
  const m = String(minute ?? 0).padStart(2, '0')
  if (day === null || day === undefined) return `taeglich ${h}:${m}`
  const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
  return `${days[day] || `Tag ${day}`} ${h}:${m}`
}

function normalizeAction(value: unknown): CronAction {
  const s = typeof value === 'string' ? value.toLowerCase() : ''
  if (s === 'create' || s === 'update' || s === 'delete') return s
  return 'update'
}

function normalizeStatus(value: unknown): CronStatus {
  if (value === 'approved' || value === 'rejected') return value
  return 'pending'
}

function normalize(row: CronRequestRow): CronRequestItem {
  const action = normalizeAction(row.action)
  return {
    id: row.id,
    agent: row.agent_name || AGENTS[0]?.name || 'agent',
    jobName: row.job_name || 'Cron-Job',
    action,
    schedule: formatSchedule(row.schedule_hour, row.schedule_minute, row.schedule_day),
    reason: row.reason || row.prompt || 'Keine Begruendung angegeben',
    prompt: row.prompt || '',
    risk: (row.risk_level || 'medium').toLowerCase(),
    source: row.source || 'manual',
    status: normalizeStatus(row.status),
    time: relativeTime(row.created_at),
    reviewedBy: row.reviewed_by,
  }
}

export default function CronRequestsPage() {
  const [items, setItems] = useState<CronRequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const pending = items.filter(i => i.status === 'pending').length

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch('/api/agents/cron-requests')
      const data = await res.json()
      setItems(((data.requests || []) as CronRequestRow[]).map(normalize))
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function decide(id: string, action: 'approve' | 'reject') {
    setItems(current => current.map(item => item.id === id
      ? { ...item, status: action === 'approve' ? 'approved' : 'rejected' }
      : item
    ))
    try {
      await authFetch(`/api/agents/cron-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      load()
    } catch {
      load()
    }
  }

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="ARBEIT"
        title="Cron-Vorschlaege"
        description="Agents schlagen hier neue Cron-Jobs vor (anlegen, aendern, loeschen). Genehmigte Vorschlaege werden direkt im Hintergrund umgesetzt und der Agent informiert."
        badges={<AHPill tone="warn">{pending} ausstehend</AHPill>}
      />

      <div style={{ padding: '0 28px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <div className="card" style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Keine Cron-Vorschlaege offen.</div>
            <div style={{ fontSize: 12.5, color: 'var(--fg-muted)', marginTop: 4, maxWidth: 600 }}>
              Eintraege entstehen, wenn ein Agent eine Outbox-Reply mit
              <code style={{ margin: '0 4px' }}>type: cron_request</code>
              schreibt (Bridge ruft POST <code>/api/agents/cron-requests</code> auf), oder wenn jemand manuell ueber die API einen Vorschlag einstellt.
            </div>
          </div>
        ) : items.map(item => {
          const agent = AGENT_MAP[item.agent]
          return (
            <div
              key={item.id}
              className="card"
              style={{ padding: 16, opacity: item.status === 'pending' ? 1 : 0.7 }}
              title={item.id}
            >
              <div className="row gap-3 stack-actions-mobile" style={{ alignItems: 'flex-start' }}>
                {agent ? <AgentAvatar agent={agent} size="sm" /> : null}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="row gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{item.jobName}</span>
                    <span className="badge"><Calendar size={10} /> {ACTION_LABEL[item.action]}</span>
                    <span className="badge"><Clock size={10} /> {item.schedule}</span>
                    <span className={`badge ${RISK_CLASS[item.risk] || ''}`}>{item.risk}</span>
                    {item.source !== 'manual' && (
                      <span className="badge" style={{ opacity: 0.7 }}>{item.source}</span>
                    )}
                    {item.status === 'approved' && <span className="badge badge-ok"><Check size={10} />Genehmigt</span>}
                    {item.status === 'rejected' && <span className="badge badge-err"><X size={10} />Abgelehnt</span>}
                  </div>
                  <div style={{
                    fontSize: 12.5,
                    color: 'var(--fg-muted)',
                    marginTop: 6,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {item.reason}
                  </div>
                  {item.prompt && item.prompt !== item.reason && (
                    <details style={{ fontSize: 12, marginTop: 6, color: 'var(--fg-muted)' }}>
                      <summary style={{ cursor: 'pointer' }}>Vorgeschlagener Prompt</summary>
                      <pre style={{
                        whiteSpace: 'pre-wrap',
                        marginTop: 4,
                        padding: 8,
                        background: 'var(--bg-sunk, rgba(0,0,0,0.04))',
                        borderRadius: 4,
                        fontSize: 11.5,
                      }}>
                        {item.prompt}
                      </pre>
                    </details>
                  )}
                  <div style={{ fontSize: 11.5, color: 'var(--fg-muted)', marginTop: 8 }}>
                    {item.time}
                    {item.reviewedBy ? ` · entschieden von ${item.reviewedBy}` : ''}
                  </div>
                </div>
                {item.status === 'pending' && (
                  <div className="row gap-2" style={{ alignItems: 'center', flexShrink: 0 }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => decide(item.id, 'reject')}
                    >
                      Ablehnen
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => decide(item.id, 'approve')}
                    >
                      Genehmigen
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
