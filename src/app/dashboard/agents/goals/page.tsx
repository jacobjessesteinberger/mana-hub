"use client"

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Check, Edit3, Loader2, Plus, Target, X } from 'lucide-react'
import { PageHeader } from '@/components/ui/mana-hub'
import { authFetch } from '@/lib/auth-fetch'
import { AGENTS } from '@/lib/agents-meta'

interface OutcomeCard {
  id: string
  title: string
  target: string
  curr: number
  kind: string
  badge: string
  quarter: string
  workspace: string
  currentValue: number | null
  targetValue: number | null
  unit: string | null
  trackingSource: string
  confidence: string
  taskCount: number
  completedTaskCount: number
}

interface GoalRow {
  id: string
  title: string
  project?: string | null
  level?: string | null
  status?: string | null
  progress?: number | null
  target_value?: number | null
  current_value?: number | null
  unit?: string | null
  deadline?: string | null
  tracking_source?: string | null
  confidence?: string | null
  task_count?: number | null
  completed_task_count?: number | null
}

interface WorkspaceRow {
  id: string
  slug?: string | null
  name: string
}

function quarterFromDeadline(deadline?: string | null) {
  if (!deadline) return `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`
  const month = new Date(deadline).getMonth() + 1
  if (!Number.isFinite(month)) return `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`
  return `Q${Math.ceil(month / 3)}`
}

function normalizeGoal(goal: GoalRow): OutcomeCard {
  const progress = Math.max(0, Math.min(100, Number(goal.progress || 0)))
  const target = goal.target_value
    ? `${goal.target_value}${goal.unit ? ` ${goal.unit}` : ''}`
    : goal.unit || 'Outcome'
  const atRisk = progress < 35 || goal.status === 'blocked'
  return {
    id: goal.id,
    title: goal.title,
    target,
    curr: progress / 100,
    kind: atRisk ? 'at risk' : goal.status || 'on track',
    badge: atRisk ? 'badge-warn' : progress >= 80 ? 'badge-ok' : 'badge-info',
    quarter: quarterFromDeadline(goal.deadline),
    workspace: goal.project || goal.level || 'Company',
    currentValue: goal.current_value ?? null,
    targetValue: goal.target_value ?? null,
    unit: goal.unit ?? null,
    trackingSource: goal.tracking_source || 'not_connected',
    confidence: goal.confidence || 'low',
    taskCount: goal.task_count ?? 0,
    completedTaskCount: goal.completed_task_count ?? 0,
  }
}

function trackingLabel(source: string) {
  if (source === 'live_api') return 'Live API'
  if (source === 'agent_report') return 'Agent Report'
  if (source === 'manual') return 'Manual'
  return 'Not connected'
}

function OutcomesPageContent() {
  const searchParams = useSearchParams()
  const projectFilter = searchParams.get('project')
  const [outcomes, setOutcomes] = useState<OutcomeCard[]>([])
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newWorkspaceId, setNewWorkspaceId] = useState('')
  const [newAgentName, setNewAgentName] = useState('')
  const [newTargetValue, setNewTargetValue] = useState('')
  const [newCurrentValue, setNewCurrentValue] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [newDeadline, setNewDeadline] = useState('')
  const [editingOutcomeId, setEditingOutcomeId] = useState<string | null>(null)
  const [editCurrentValue, setEditCurrentValue] = useState('')
  const [updatingOutcomeId, setUpdatingOutcomeId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [goalRes, workspaceRes] = await Promise.all([
        authFetch(projectFilter ? `/api/agents/goals?project=${encodeURIComponent(projectFilter)}` : '/api/agents/goals'),
        authFetch('/api/agents/projects'),
      ])
      const data = await goalRes.json()
      if (!goalRes.ok) throw new Error(data.error || 'Outcomes konnten nicht geladen werden')
      const workspaceData = await workspaceRes.json()
      if (workspaceRes.ok) setWorkspaces((workspaceData.projects || []) as WorkspaceRow[])
      const goals = (data.goals || []) as GoalRow[]
      setOutcomes(goals.length ? goals.map(normalizeGoal) : [])
    } catch (err) {
      setOutcomes([])
      setError(err instanceof Error ? err.message : 'Outcomes konnten nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }, [projectFilter])

  useEffect(() => { load() }, [load])

  async function createOutcome() {
    if (!newTitle.trim() || creating) return
    const workspace = workspaces.find(item => item.id === newWorkspaceId)
    const targetValue = newTargetValue.trim() ? Number(newTargetValue) : null
    const currentValue = newCurrentValue.trim() ? Number(newCurrentValue) : null
    setCreating(true)
    setCreateError(null)
    try {
      const res = await authFetch('/api/agents/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim() || undefined,
          level: workspace ? 'project' : 'company',
          project: workspace?.slug || workspace?.name || undefined,
          project_id: workspace?.id || null,
          agent_name: newAgentName || undefined,
          target_value: Number.isFinite(targetValue) ? targetValue : null,
          current_value: Number.isFinite(currentValue) ? currentValue : null,
          unit: newUnit.trim() || null,
          deadline: newDeadline ? new Date(`${newDeadline}T12:00:00`).toISOString() : null,
          tracking_source: 'manual',
          confidence: 'low',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Outcome konnte nicht erstellt werden')
      setShowCreate(false)
      setNewTitle('')
      setNewDescription('')
      setNewWorkspaceId('')
      setNewAgentName('')
      setNewTargetValue('')
      setNewCurrentValue('')
      setNewUnit('')
      setNewDeadline('')
      await load()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Outcome konnte nicht erstellt werden')
    } finally {
      setCreating(false)
    }
  }

  async function updateOutcomeProgress(outcome: OutcomeCard) {
    const currentValue = editCurrentValue.trim() ? Number(editCurrentValue) : null
    if (updatingOutcomeId || currentValue === null || !Number.isFinite(currentValue)) return
    setUpdatingOutcomeId(outcome.id)
    try {
      const res = await authFetch(`/api/agents/goals/${outcome.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_value: currentValue,
          tracking_source: 'manual',
          confidence: 'medium',
          last_checked_at: new Date().toISOString(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Outcome konnte nicht aktualisiert werden')
      setEditingOutcomeId(null)
      setEditCurrentValue('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Outcome konnte nicht aktualisiert werden')
    } finally {
      setUpdatingOutcomeId(null)
    }
  }

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="ARBEIT"
        title="Outcomes"
        description={projectFilter ? 'Gefilterte Outcomes fuer diesen Workspace. Fortschritt kann manuell gepflegt oder spaeter per Connector aktualisiert werden.' : 'Was du tatsaechlich erreichen willst. Outcomes verbinden Workspaces mit messbaren Ergebnissen.'}
        actions={<button className="btn btn-sm btn-primary" type="button" onClick={() => setShowCreate(true)}><Plus size={13} />Outcome anlegen</button>}
      />

      <div style={{ padding: '0 28px 28px' }}>
        {error ? <div className="badge badge-err mb-3">{error}</div> : null}
        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}><Loader2 size={18} className="animate-spin" /></div>
          ) : outcomes.length === 0 ? (
            <div style={{ padding: 18, fontSize: 13, color: 'var(--fg-muted)' }}>Noch keine Outcomes in Supabase.</div>
          ) : outcomes.map((outcome, index) => {
            const pct = Math.round(outcome.curr * 100)
            return (
              <div
                key={outcome.id}
                style={{
                  padding: '16px 20px',
                  borderTop: index === 0 ? 0 : '1px solid var(--border)',
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0,1fr) 220px 120px',
                  gap: 16,
                  alignItems: 'center',
                }}
              >
                <div>
                  <div className="row gap-2" style={{ alignItems: 'center' }}>
                    <Target size={14} style={{ color: 'var(--fg-subtle)' }} />
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{outcome.title}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 4 }}>
                    <span className="badge" style={{ height: 16, fontSize: 10 }}>{outcome.quarter}</span>
                    <span style={{ margin: '0 8px', color: 'var(--fg-faint)' }}>·</span>
                    <span>{outcome.workspace}</span>
                    <span style={{ margin: '0 8px', color: 'var(--fg-faint)' }}>·</span>
                    <span>Ziel: {outcome.target}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)', marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span className="badge" style={{ height: 18, fontSize: 10.5 }}>{trackingLabel(outcome.trackingSource)}</span>
                    <span className="badge" style={{ height: 18, fontSize: 10.5 }}>Confidence: {outcome.confidence}</span>
                    <span>{outcome.completedTaskCount}/{outcome.taskCount} Tasks erledigt</span>
                    {outcome.currentValue !== null || outcome.targetValue !== null ? (
                      <span>
                        Ist/Ziel: {outcome.currentValue ?? 'n/a'} / {outcome.targetValue ?? 'n/a'} {outcome.unit || ''}
                      </span>
                    ) : (
                      <span>Kein Live-Wert verbunden</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="row" style={{ justifyContent: 'space-between', fontSize: 11, color: 'var(--fg-subtle)', marginBottom: 4 }}>
                    <span>Fortschritt</span>
                    <span className="tabular">{pct}%</span>
                  </div>
                  <div className="bar">
                    <span style={{ width: `${pct}%`, background: outcome.badge === 'badge-warn' ? 'var(--warn)' : 'var(--accent)' }} />
                  </div>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                  <span className={`badge ${outcome.badge}`}>{outcome.kind}</span>
                  {editingOutcomeId === outcome.id ? (
                    <div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
                      <input
                        className="input"
                        type="number"
                        value={editCurrentValue}
                        onChange={event => setEditCurrentValue(event.target.value)}
                        placeholder="Istwert"
                        style={{ width: 90, height: 28, fontSize: 11.5 }}
                      />
                      <button className="btn btn-icon btn-xs" type="button" onClick={() => updateOutcomeProgress(outcome)} disabled={updatingOutcomeId === outcome.id}>
                        {updatingOutcomeId === outcome.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-ghost btn-xs"
                      type="button"
                      onClick={() => {
                        setEditingOutcomeId(outcome.id)
                        setEditCurrentValue(outcome.currentValue !== null ? String(outcome.currentValue) : '')
                      }}
                    >
                      <Edit3 size={11} /> Istwert
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="card" style={{ width: 'min(640px, 100%)', padding: 0, overflow: 'hidden' }} onClick={event => event.stopPropagation()}>
            <div className="card-hd">
              <div>
                <h3>Outcome anlegen</h3>
                <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)', marginTop: 2 }}>Messbares Ziel fuer Company, Workspace oder Agent.</div>
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" type="button" onClick={() => setShowCreate(false)}>
                <X size={14} />
              </button>
            </div>
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {createError ? <div className="badge badge-err">{createError}</div> : null}
              <label className="col gap-1">
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-muted)' }}>Titel</span>
                <input className="input" value={newTitle} onChange={event => setNewTitle(event.target.value)} placeholder="z.B. Finance-Automation produktionsreif" />
              </label>
              <label className="col gap-1">
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-muted)' }}>Beschreibung</span>
                <textarea
                  className="input"
                  value={newDescription}
                  onChange={event => setNewDescription(event.target.value)}
                  placeholder="Warum ist dieses Outcome wichtig?"
                  rows={3}
                  style={{ height: 'auto', resize: 'vertical' }}
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="col gap-1">
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-muted)' }}>Workspace</span>
                  <select className="input" value={newWorkspaceId} onChange={event => setNewWorkspaceId(event.target.value)}>
                    <option value="">Company Outcome</option>
                    {workspaces.map(workspace => (
                      <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
                    ))}
                  </select>
                </label>
                <label className="col gap-1">
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-muted)' }}>Agent</span>
                  <select className="input" value={newAgentName} onChange={event => setNewAgentName(event.target.value)}>
                    <option value="">Kein Agent</option>
                    {AGENTS.map(agent => (
                      <option key={agent.name} value={agent.name}>{agent.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                <label className="col gap-1">
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-muted)' }}>Zielwert</span>
                  <input className="input" type="number" value={newTargetValue} onChange={event => setNewTargetValue(event.target.value)} placeholder="100" />
                </label>
                <label className="col gap-1">
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-muted)' }}>Istwert</span>
                  <input className="input" type="number" value={newCurrentValue} onChange={event => setNewCurrentValue(event.target.value)} placeholder="0" />
                </label>
                <label className="col gap-1">
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-muted)' }}>Einheit</span>
                  <input className="input" value={newUnit} onChange={event => setNewUnit(event.target.value)} placeholder="%" />
                </label>
                <label className="col gap-1">
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-muted)' }}>Deadline</span>
                  <input className="input" type="date" value={newDeadline} onChange={event => setNewDeadline(event.target.value)} />
                </label>
              </div>
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 4 }}>
                <button className="btn btn-sm" type="button" onClick={() => setShowCreate(false)}>Abbrechen</button>
                <button className="btn btn-sm btn-primary" type="button" onClick={createOutcome} disabled={!newTitle.trim() || creating}>
                  {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  Outcome erstellen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function OutcomesPage() {
  return (
    <Suspense fallback={<div className="fade-in" style={{ padding: 28 }}><Loader2 size={18} className="animate-spin" /></div>}>
      <OutcomesPageContent />
    </Suspense>
  )
}
