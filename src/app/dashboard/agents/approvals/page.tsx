"use client"

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, Loader2, X } from 'lucide-react'
import { AHPill, PageHeader } from '@/components/ui/mana-hub'
import AgentAvatar from '@/components/ui/AgentAvatar'
import { AGENT_MAP } from '@/lib/agents-meta'
import { authFetch } from '@/lib/auth-fetch'

type ApprovalStatus = 'pending' | 'approved' | 'rejected'

interface ApprovalItem {
  id: string
  agent: string
  title: string
  risk: string
  reason: string
  time: string
  status: ApprovalStatus
  actionType: string
  executionStatus: string
  feedbackSentAt?: string | null
}

interface ApprovalRow {
  id: string
  agent_name?: string | null
  action_type?: string | null
  action_summary?: string | null
  risk_level?: string | null
  risk_reason?: string | null
  requested_at?: string | null
  created_at?: string | null
  status?: ApprovalStatus | string | null
  execution_status?: string | null
  feedback_sent_at?: string | null
}

const RISK_CLASS: Record<string, string> = {
  Critical: 'badge-err',
  High: 'badge-err',
  Med: 'badge-warn',
  Medium: 'badge-warn',
  Low: '',
}

function relativeTime(iso?: string | null) {
  if (!iso) return 'gerade eben'
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.max(0, Math.floor(diff / 60000))
  if (min < 1) return 'gerade eben'
  if (min < 60) return `vor ${min} Min`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `vor ${hours} Std`
  return `vor ${Math.floor(hours / 24)} T`
}

function labelRisk(risk?: string | null) {
  if (!risk) return 'Med'
  if (risk === 'critical') return 'Critical'
  if (risk === 'high') return 'High'
  if (risk === 'medium') return 'Med'
  if (risk === 'low') return 'Low'
  return risk
}

function normalizeApproval(row: ApprovalRow): ApprovalItem {
  return {
    id: row.id,
    agent: row.agent_name || 'mana',
    title: row.action_summary || row.action_type || 'Riskante Aktion',
    risk: labelRisk(row.risk_level),
    reason: row.risk_reason || row.action_type || 'Wartet auf manuelle Freigabe',
    time: relativeTime(row.requested_at || row.created_at),
    status: row.status === 'approved' || row.status === 'rejected' ? row.status : 'pending',
    actionType: row.action_type || 'unknown',
    executionStatus: row.execution_status || (row.status === 'approved' ? 'approved_for_execution' : row.status === 'rejected' ? 'rejected' : 'waiting_approval'),
    feedbackSentAt: row.feedback_sent_at,
  }
}

function executionLabel(status: string) {
  if (status === 'waiting_approval') return 'Wartet auf Freigabe'
  if (status === 'approved_for_execution') return 'Freigegeben fuer Ausfuehrung'
  if (status === 'executed') return 'Ausgefuehrt'
  if (status === 'failed') return 'Ausfuehrung fehlgeschlagen'
  if (status === 'expired') return 'Abgelaufen'
  if (status === 'rejected') return 'Abgelehnt'
  return status
}

function executionClass(status: string) {
  if (status === 'approved_for_execution' || status === 'executed') return 'badge-ok'
  if (status === 'failed' || status === 'rejected' || status === 'expired') return 'badge-err'
  return 'badge-warn'
}

export default function ApprovalsPage() {
  const [items, setItems] = useState<ApprovalItem[]>([])
  const [loading, setLoading] = useState(true)
  const pending = items.filter(item => item.status === 'pending').length

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch('/api/agents/approvals')
      const data = await res.json()
      setItems(((data.approvals || []) as ApprovalRow[]).map(normalizeApproval))
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function decide(id: string, status: ApprovalStatus) {
    setItems(current => current.map(item => item.id === id ? { ...item, status } : item))
    try {
      await authFetch(`/api/agents/approvals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
    } catch {
      load()
    }
  }

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="ARBEIT"
        title="Risk Approval"
        description="Riskante Aktionen warten hier auf eine bewusste Entscheidung. Die Entscheidung wird danach als Message an den Agent gesendet."
        badges={<AHPill tone="warn">{pending} ausstehend</AHPill>}
      />

      <div style={{ padding: '0 28px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <div className="card" style={{ padding: 24, display: 'flex', justifyContent: 'center' }}><Loader2 size={18} className="animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Keine Risk Approvals offen.</div>
            <div style={{ fontSize: 12.5, color: 'var(--fg-muted)', marginTop: 4, maxWidth: 680 }}>
              Einträge entstehen erst, wenn ein Agent oder eine Automation eine riskante Aktion ueber <code className="mono">POST /api/agents/approvals</code> beantragt.
              Der Core stoppt die Ausfuehrung dann bei <code className="mono">waiting_approval</code>, bis du freigibst oder ablehnst.
            </div>
          </div>
        ) : items.map(item => {
          const agent = AGENT_MAP[item.agent]
          return (
            <div key={item.id} className="card" style={{ padding: 16, opacity: item.status === 'pending' ? 1 : 0.7 }}>
              <div className="row gap-3" style={{ alignItems: 'flex-start' }}>
                {agent ? <AgentAvatar agent={agent} size="sm" /> : null}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="row gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--fg-faint)' }}>{item.id.slice(0, 8)}</span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{item.title}</span>
                    <span className={`badge ${RISK_CLASS[item.risk] || ''}`}>
                      <AlertTriangle size={10} /> {item.risk}
                    </span>
                    {item.status === 'approved' && <span className="badge badge-ok"><Check size={10} />Freigegeben</span>}
                    {item.status === 'rejected' && <span className="badge badge-err"><X size={10} />Abgelehnt</span>}
                    <span className={`badge ${executionClass(item.executionStatus)}`}>
                      {executionLabel(item.executionStatus)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--fg-muted)', marginTop: 4 }}>
                    <b style={{ fontWeight: 600, color: 'var(--fg)' }}>{agent?.label || item.agent}</b> moechte ausfuehren — {item.reason}.
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--fg-faint)', marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span>{item.time}</span>
                    <span>Action: {item.actionType}</span>
                    <span>{item.feedbackSentAt ? 'Entscheidung an Agent gesendet' : 'Entscheidung wird als Agent-Message gesendet'}</span>
                  </div>
                </div>
                {item.status === 'pending' && (
                  <div className="row gap-2">
                    <button className="btn btn-sm" onClick={() => decide(item.id, 'rejected')} type="button"><X size={13} />Ablehnen</button>
                    <button className="btn btn-sm btn-accent" onClick={() => decide(item.id, 'approved')} type="button"><Check size={13} />Freigeben</button>
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
