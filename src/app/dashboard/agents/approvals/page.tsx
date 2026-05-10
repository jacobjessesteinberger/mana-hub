"use client"

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, Infinity as InfinityIcon, Loader2, Trash2, X } from 'lucide-react'
import { AHPill, PageHeader } from '@/components/ui/mana-hub'
import AgentAvatar from '@/components/ui/AgentAvatar'
import { AGENT_MAP, AGENTS } from '@/lib/agents-meta'
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
  autoApprovedByPolicyId?: string | null
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
  auto_approved_by_policy_id?: string | null
}

interface PolicyItem {
  id: string
  name: string
  description?: string | null
  trigger_value?: string | null
  agent_name?: string | null
  enabled?: boolean | null
  use_count?: number | null
  last_used_at?: string | null
  decided_by?: string | null
  created_at?: string | null
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
    agent: row.agent_name || AGENTS[0]?.name || 'agent',
    title: row.action_summary || row.action_type || 'Riskante Aktion',
    risk: labelRisk(row.risk_level),
    reason: row.risk_reason || row.action_type || 'Wartet auf manuelle Freigabe',
    time: relativeTime(row.requested_at || row.created_at),
    status: row.status === 'approved' || row.status === 'rejected' ? row.status : 'pending',
    actionType: row.action_type || 'unknown',
    executionStatus: row.execution_status || (row.status === 'approved' ? 'approved_for_execution' : row.status === 'rejected' ? 'rejected' : 'waiting_approval'),
    feedbackSentAt: row.feedback_sent_at,
    autoApprovedByPolicyId: row.auto_approved_by_policy_id,
  }
}

export default function ApprovalsPage() {
  const [items, setItems] = useState<ApprovalItem[]>([])
  const [policies, setPolicies] = useState<PolicyItem[]>([])
  const [loading, setLoading] = useState(true)
  const pending = items.filter(item => item.status === 'pending').length

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [appRes, polRes] = await Promise.all([
        authFetch('/api/agents/approvals'),
        authFetch('/api/agents/approval-policies?enabled=true'),
      ])
      const appData = await appRes.json()
      const polData = polRes.ok ? await polRes.json() : { policies: [] }
      setItems(((appData.approvals || []) as ApprovalRow[]).map(normalizeApproval))
      setPolicies((polData.policies || []) as PolicyItem[])
    } catch {
      setItems([])
      setPolicies([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function decide(id: string, status: ApprovalStatus, policy?: 'once' | 'always') {
    setItems(current => current.map(item => item.id === id ? { ...item, status } : item))
    try {
      await authFetch(`/api/agents/approvals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, policy: policy ?? 'once' }),
      })
      load()
    } catch {
      load()
    }
  }

  async function revokePolicy(id: string) {
    if (!confirm('Always-Policy deaktivieren? Naechste gleiche Anfrage wird wieder im Tab erscheinen.')) return
    try {
      await authFetch(`/api/agents/approval-policies/${id}`, { method: 'DELETE' })
      load()
    } catch {
      load()
    }
  }

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="ARBEIT"
        title="Risk Approval"
        description="Sensible Aktionen brauchen deine Freigabe. Einmalig freigeben gilt nur fuer diese Anfrage. Immer erlauben merkt sich gleichartige Aktionen und winkt sie kuenftig automatisch durch."
        badges={<AHPill tone="warn">{pending} ausstehend</AHPill>}
      />

      <div style={{ padding: '0 28px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <div className="card" style={{ padding: 24, display: 'flex', justifyContent: 'center' }}><Loader2 size={18} className="animate-spin" /></div>
          ) : items.length === 0 ? (
            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Keine offenen Anfragen.</div>
              <div style={{ fontSize: 12.5, color: 'var(--fg-muted)', marginTop: 4, maxWidth: 560 }}>
                Sobald ein Agent eine sensible Aktion plant, erscheint hier eine Karte zum Freigeben oder Ablehnen.
              </div>
            </div>
          ) : items.map(item => {
            const agent = AGENT_MAP[item.agent]
            return (
              <div key={item.id} className="card" style={{ padding: 16, opacity: item.status === 'pending' ? 1 : 0.7 }} title={item.id}>
                <div className="row gap-3" style={{ alignItems: 'flex-start' }}>
                  {agent ? <AgentAvatar agent={agent} size="sm" /> : null}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="row gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{item.title}</span>
                      <span className={`badge ${RISK_CLASS[item.risk] || ''}`}>
                        <AlertTriangle size={10} /> {item.risk}
                      </span>
                      {item.status === 'approved' && <span className="badge badge-ok"><Check size={10} />Freigegeben</span>}
                      {item.status === 'rejected' && <span className="badge badge-err"><X size={10} />Abgelehnt</span>}
                      {item.autoApprovedByPolicyId && <span className="badge badge-ok"><InfinityIcon size={10} />Dauerhaft freigegeben</span>}
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
                      <b style={{ fontWeight: 600, color: 'var(--fg)' }}>{agent?.label || item.agent}</b> moechte ausfuehren — {item.reason}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--fg-faint)', marginTop: 6, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <span>{item.time}</span>
                      <span className="mono">{item.actionType}</span>
                    </div>
                  </div>
                  {item.status === 'pending' && (
                    <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
                      <button className="btn btn-sm" onClick={() => decide(item.id, 'rejected')} type="button" title="Anfrage ablehnen.">
                        <X size={13} />Ablehnen
                      </button>
                      <button className="btn btn-sm btn-accent" onClick={() => decide(item.id, 'approved', 'once')} type="button" title="Nur diese Anfrage freigeben.">
                        <Check size={13} />Einmalig freigeben
                      </button>
                      <button className="btn btn-sm btn-accent" onClick={() => decide(item.id, 'approved', 'always')} type="button" title="Anfrage freigeben und gleichartige Aktionen kuenftig automatisch freigeben.">
                        <InfinityIcon size={13} />Immer erlauben
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: 0.5, padding: '8px 0' }}>
            Dauerhafte Freigaben{policies.length > 0 ? ` (${policies.length})` : ''}
          </div>
          {policies.length === 0 ? (
            <div className="card" style={{ padding: 14, fontSize: 12.5, color: 'var(--fg-muted)' }}>
              Noch keine dauerhaften Freigaben gespeichert.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {policies.map(policy => (
                <div key={policy.id} className="card" style={{ padding: 12 }}>
                  <div className="row gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="badge badge-ok"><InfinityIcon size={10} />Dauerhaft</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{policy.name}</span>
                    {policy.agent_name && <span className="badge">{policy.agent_name}</span>}
                    {(policy.use_count ?? 0) > 0 && (
                      <span style={{ fontSize: 11.5, color: 'var(--fg-faint)' }}>{policy.use_count}x verwendet</span>
                    )}
                    {policy.last_used_at && (
                      <span style={{ fontSize: 11.5, color: 'var(--fg-faint)' }}>zuletzt {relativeTime(policy.last_used_at)}</span>
                    )}
                    <div style={{ marginLeft: 'auto' }}>
                      <button className="btn btn-sm" onClick={() => revokePolicy(policy.id)} type="button" title="Freigabe zuruecknehmen. Naechste gleiche Anfrage erscheint wieder zur Entscheidung.">
                        <Trash2 size={12} />Zuruecknehmen
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
