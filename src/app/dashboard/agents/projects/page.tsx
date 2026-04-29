"use client"

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Clipboard, Filter, Layers, Loader2, MoreHorizontal, Plus, Target, X } from 'lucide-react'
import { PageHeader } from '@/components/ui/mana-hub'
import AgentAvatar from '@/components/ui/AgentAvatar'
import { AGENT_MAP, AGENTS } from '@/lib/agents-meta'
import { authFetch } from '@/lib/auth-fetch'

interface WorkspaceCard {
  id: string
  name: string
  desc: string
  tasks: number
  openTasks: number
  blockedTasks: number
  reviewTasks: number
  criticalTasks: number
  agents: string[]
  outcome: string
  pct: number
  reviewStatus: 'needs_attention' | 'active' | 'quiet'
  lastActivityAt?: string | null
  nextReviewHint?: string | null
}

interface ProjectRow {
  id: string
  name: string
  description?: string | null
  owner_agent?: string | null
  issue_count?: number | null
  open_issue_count?: number | null
  blocked_issue_count?: number | null
  review_issue_count?: number | null
  critical_issue_count?: number | null
  goal_count?: number | null
  active_goal_count?: number | null
  average_goal_progress?: number | null
  assigned_agents?: string[] | null
  review_status?: 'needs_attention' | 'active' | 'quiet' | null
  last_activity_at?: string | null
  next_review_hint?: string | null
}

function relativeTime(iso?: string | null) {
  if (!iso) return 'keine Aktivitaet'
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.max(0, Math.floor(diff / 60000))
  if (min < 1) return 'gerade eben'
  if (min < 60) return `vor ${min} Min`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `vor ${hours} Std`
  return `vor ${Math.floor(hours / 24)} T`
}

function normalizeProject(project: ProjectRow): WorkspaceCard {
  const tasks = project.issue_count ?? 0
  const open = project.open_issue_count ?? 0
  const doneish = Math.max(0, tasks - open)
  const taskPct = tasks > 0 ? Math.round((doneish / tasks) * 100) : 0
  const owner = project.owner_agent && AGENT_MAP[project.owner_agent] ? project.owner_agent : null
  const assigned = (project.assigned_agents || []).filter(agent => AGENT_MAP[agent])
  const agents = assigned.length ? assigned : owner ? [owner] : []
  return {
    id: project.id,
    name: project.name,
    desc: project.description || 'Live Workspace aus Supabase.',
    tasks,
    openTasks: open,
    blockedTasks: project.blocked_issue_count ?? 0,
    reviewTasks: project.review_issue_count ?? 0,
    criticalTasks: project.critical_issue_count ?? 0,
    agents,
    outcome: `${project.active_goal_count ?? project.goal_count ?? 0} aktive Outcomes`,
    pct: Math.max(0, Math.min(100, project.average_goal_progress ?? taskPct)),
    reviewStatus: project.review_status || 'quiet',
    lastActivityAt: project.last_activity_at,
    nextReviewHint: project.next_review_hint,
  }
}

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newOwnerAgent, setNewOwnerAgent] = useState('')
  const [newColor, setNewColor] = useState('#10B981')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch('/api/agents/projects')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Workspaces konnten nicht geladen werden')
      const projects = (data.projects || []) as ProjectRow[]
      setWorkspaces(projects.length ? projects.map(normalizeProject) : [])
    } catch (err) {
      setWorkspaces([])
      setError(err instanceof Error ? err.message : 'Workspaces konnten nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function createWorkspace() {
    if (!newName.trim() || creating) return
    setCreating(true)
    setCreateError(null)
    try {
      const res = await authFetch('/api/agents/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || null,
          owner_agent: newOwnerAgent || null,
          color: newColor,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Workspace konnte nicht erstellt werden')
      setShowCreate(false)
      setNewName('')
      setNewDescription('')
      setNewOwnerAgent('')
      setNewColor('#10B981')
      await load()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Workspace konnte nicht erstellt werden')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="ARBEIT"
        title="Workspaces"
        description="Buendel von Tasks, Agents und einem klaren Outcome. Ein Workspace = ein Ziel."
        actions={
          <>
            <button className="btn btn-sm" type="button" onClick={load}><Filter size={13} />Aktualisieren</button>
            <button className="btn btn-sm btn-primary" type="button" onClick={() => setShowCreate(true)}><Plus size={13} />Neuer Workspace</button>
          </>
        }
      />

      {error ? <div style={{ padding: '0 28px 12px' }}><span className="badge badge-err">{error}</span></div> : null}

      <div style={{ padding: '0 28px 28px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {loading ? (
          <div className="card" style={{ padding: 24, display: 'flex', justifyContent: 'center' }}><Loader2 size={18} className="animate-spin" /></div>
        ) : workspaces.length === 0 ? (
          <div className="card" style={{ padding: 18, fontSize: 13, color: 'var(--fg-muted)' }}>Noch keine Workspaces in Supabase.</div>
        ) : workspaces.map(workspace => (
          <div key={workspace.id} className="card" style={{ padding: 16, position: 'relative' }}>
            <div className="row gap-2" style={{ alignItems: 'center' }}>
              <Layers size={14} style={{ color: 'var(--accent)' }} />
              <Link href={`/dashboard/agents/projects/${workspace.id}`} style={{ color: 'inherit', textDecoration: 'none', minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{workspace.name}</h3>
              </Link>
              <span className="spacer" />
              {workspace.reviewStatus === 'needs_attention' ? (
                <span className="badge badge-warn" style={{ height: 20, fontSize: 10.5 }}>
                  <AlertTriangle size={10} /> Review
                </span>
              ) : workspace.reviewStatus === 'active' ? (
                <span className="badge badge-info" style={{ height: 20, fontSize: 10.5 }}>Aktiv</span>
              ) : (
                <span className="badge" style={{ height: 20, fontSize: 10.5 }}>Ruhig</span>
              )}
              <button
                className="btn btn-ghost btn-icon btn-xs"
                type="button"
                aria-label={`${workspace.name} Aktionen`}
                aria-expanded={openMenuId === workspace.id}
                onClick={() => setOpenMenuId(current => current === workspace.id ? null : workspace.id)}
              >
                <MoreHorizontal size={13} />
              </button>
              {openMenuId === workspace.id ? (
                <div
                  className="card"
                  style={{
                    position: 'absolute',
                    top: 42,
                    right: 12,
                    zIndex: 20,
                    width: 190,
                    padding: 6,
                    boxShadow: 'var(--shadow-card)',
                  }}
                >
                  <Link className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }} href={`/dashboard/agents/projects/${workspace.id}`} onClick={() => setOpenMenuId(null)}>
                    Mission Control
                  </Link>
                  <Link className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }} href={`/dashboard/agents/issues?project=${workspace.id}`} onClick={() => setOpenMenuId(null)}>
                    Workspace Tasks
                  </Link>
                  <Link className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }} href={`/dashboard/agents/goals?project=${workspace.id}`} onClick={() => setOpenMenuId(null)}>
                    Workspace Outcomes
                  </Link>
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    style={{ width: '100%', justifyContent: 'flex-start' }}
                    onClick={() => {
                      void navigator.clipboard?.writeText(workspace.id)
                      setOpenMenuId(null)
                    }}
                  >
                    <Clipboard size={12} /> ID kopieren
                  </button>
                </div>
              ) : null}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--fg-muted)', marginTop: 4 }}>{workspace.desc}</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 14 }}>
              <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '8px 9px', background: 'var(--bg-sunk)' }}>
                <div className="tabular" style={{ fontSize: 16, fontWeight: 650 }}>{workspace.openTasks}</div>
                <div style={{ fontSize: 10.5, color: 'var(--fg-subtle)' }}>offen</div>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '8px 9px', background: 'var(--bg-sunk)' }}>
                <div className="tabular" style={{ fontSize: 16, fontWeight: 650, color: workspace.blockedTasks > 0 ? 'var(--warn)' : 'var(--fg)' }}>{workspace.blockedTasks}</div>
                <div style={{ fontSize: 10.5, color: 'var(--fg-subtle)' }}>blockiert</div>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '8px 9px', background: 'var(--bg-sunk)' }}>
                <div className="tabular" style={{ fontSize: 16, fontWeight: 650 }}>{workspace.reviewTasks}</div>
                <div style={{ fontSize: 10.5, color: 'var(--fg-subtle)' }}>review</div>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 11, color: 'var(--fg-subtle)', marginBottom: 4 }}>
                <span><Target size={11} style={{ display: 'inline', marginRight: 4 }} />Outcome: <span style={{ color: 'var(--fg-muted)' }}>{workspace.outcome}</span></span>
                <span className="tabular">{workspace.pct}%</span>
              </div>
              <div className="bar"><span style={{ width: `${workspace.pct}%` }} /></div>
            </div>

            <div className="row" style={{ marginTop: 14, gap: 4 }}>
              {workspace.agents.map(agentName => {
                const agent = AGENT_MAP[agentName]
                return agent ? <AgentAvatar key={agentName} agent={agent} size="sm" /> : null
              })}
              <span style={{ fontSize: 11.5, color: 'var(--fg-subtle)', marginLeft: 6 }}>{workspace.agents.length} agents</span>
              <span className="spacer" />
              <span className="badge" style={{ height: 18, fontSize: 10.5 }}>{workspace.tasks} tasks</span>
            </div>
            <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--fg-faint)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span>{relativeTime(workspace.lastActivityAt)}</span>
              <span>{workspace.nextReviewHint || 'regelmaessig pruefen'}</span>
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="card" style={{ width: 'min(560px, 100%)', padding: 0, overflow: 'hidden' }} onClick={event => event.stopPropagation()}>
            <div className="card-hd">
              <div>
                <h3>Neuer Workspace</h3>
                <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)', marginTop: 2 }}>Ein klares Arbeitsbuendel fuer Tasks, Agents und Outcomes.</div>
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" type="button" onClick={() => setShowCreate(false)}>
                <X size={14} />
              </button>
            </div>
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {createError ? <div className="badge badge-err">{createError}</div> : null}
              <label className="col gap-1">
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-muted)' }}>Name</span>
                <input className="input" value={newName} onChange={event => setNewName(event.target.value)} placeholder="z.B. Finance Automation" />
              </label>
              <label className="col gap-1">
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-muted)' }}>Beschreibung</span>
                <textarea
                  className="input"
                  value={newDescription}
                  onChange={event => setNewDescription(event.target.value)}
                  placeholder="Was gehoert in diesen Workspace?"
                  rows={3}
                  style={{ height: 'auto', resize: 'vertical' }}
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
                <label className="col gap-1">
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-muted)' }}>Owner-Agent</span>
                  <select className="input" value={newOwnerAgent} onChange={event => setNewOwnerAgent(event.target.value)}>
                    <option value="">Kein Owner</option>
                    {AGENTS.map(agent => (
                      <option key={agent.name} value={agent.name}>{agent.label}</option>
                    ))}
                  </select>
                </label>
                <label className="col gap-1">
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-muted)' }}>Farbe</span>
                  <input className="input" type="color" value={newColor} onChange={event => setNewColor(event.target.value)} style={{ padding: 4 }} />
                </label>
              </div>
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 4 }}>
                <button className="btn btn-sm" type="button" onClick={() => setShowCreate(false)}>Abbrechen</button>
                <button className="btn btn-sm btn-primary" type="button" onClick={createWorkspace} disabled={!newName.trim() || creating}>
                  {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  Workspace erstellen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
