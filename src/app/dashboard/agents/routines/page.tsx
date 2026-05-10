"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Loader2, MessageSquare, Plus, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/ui/mana-hub'
import { AGENTS } from '@/lib/agents-meta'
import AgentAvatar from '@/components/ui/AgentAvatar'
import { authFetch } from '@/lib/auth-fetch'

interface JobCard {
  agent: string
  name: string
  schedule: string
  type: string
  status: string
  next: string
  skillCount: number
  skills: SkillRef[]
}

interface SkillRef {
  id: string
  name: string
  source: string
  usedFor: string
  confidence: string
  referenceCount: number
}

interface RoutineRow {
  agent_id?: string | null
  name?: string | null
  schedule?: string | null
  cron?: string | null
  type?: string | null
  status?: string | null
  enabled?: boolean | null
  next_run_at?: string | null
  runbook?: { skill_refs?: unknown[] } | null
}

type AgentView = 'Jobs' | 'Skills' | 'Beides'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function normalizeSkillRef(value: unknown): SkillRef | null {
  if (!isRecord(value)) return null
  const id = typeof value.skill_id === 'string' && value.skill_id.trim() ? value.skill_id.trim() : null
  const name = typeof value.skill_name === 'string' && value.skill_name.trim() ? value.skill_name.trim() : id
  if (!name) return null
  return {
    id: id || name.toLowerCase().replace(/\s+/g, '-'),
    name,
    source: typeof value.source === 'string' && value.source.trim() ? value.source.trim() : 'inferred',
    usedFor: typeof value.used_for === 'string' && value.used_for.trim() ? value.used_for.trim() : 'Automation Runbook',
    confidence: typeof value.confidence === 'string' && value.confidence.trim() ? value.confidence.trim() : 'missing',
    referenceCount: Array.isArray(value.kb_refs) ? value.kb_refs.length : 0,
  }
}

function dedupeSkills(jobs: JobCard[]) {
  const skills = new Map<string, SkillRef>()
  jobs.flatMap(job => job.skills).forEach(skill => {
    const current = skills.get(skill.id)
    if (!current) {
      skills.set(skill.id, skill)
      return
    }
    skills.set(skill.id, {
      ...current,
      referenceCount: Math.max(current.referenceCount, skill.referenceCount),
      usedFor: current.usedFor === skill.usedFor ? current.usedFor : `${current.usedFor}; ${skill.usedFor}`,
    })
  })
  return Array.from(skills.values())
}

function relativeNext(iso?: string | null) {
  if (!iso) return 'nicht geplant'
  const diff = new Date(iso).getTime() - Date.now()
  if (!Number.isFinite(diff)) return 'nicht geplant'
  if (diff <= 0) return 'faellig'
  const min = Math.floor(diff / 60000)
  if (min < 60) return `in ${min} Min`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `in ${hours} Std`
  return `in ${Math.floor(hours / 24)} T`
}

function normalizeRoutine(row: RoutineRow): JobCard {
  const paused = row.enabled === false || row.status === 'paused'
  const failed = row.status === 'error' || row.status === 'failed'
  const skills = Array.isArray(row.runbook?.skill_refs)
    ? row.runbook.skill_refs.map(normalizeSkillRef).filter((skill): skill is SkillRef => Boolean(skill))
    : []
  return {
    agent: row.agent_id || AGENTS[0]?.name || 'agent',
    name: row.name || 'Agent Job',
    schedule: row.schedule || row.cron || 'manual',
    type: row.type || 'Agent Cron',
    status: paused ? 'Pausiert' : failed ? 'Soft fail' : 'Stabil',
    next: paused ? 'paused' : relativeNext(row.next_run_at),
    skillCount: skills.length,
    skills,
  }
}

function statusClass(status: string) {
  if (status === 'Soft fail') return 'badge-warn'
  if (status === 'Pausiert') return ''
  return 'badge-ok'
}

export default function RoutinesPage() {
  const [jobs, setJobs] = useState<JobCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [agentViews, setAgentViews] = useState<Record<string, AgentView>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch('/api/agents/routines')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Jobs konnten nicht geladen werden')
      const liveJobs = ((data.routines || []) as RoutineRow[]).map(normalizeRoutine)
      setJobs(liveJobs.length ? liveJobs : [])
    } catch (err) {
      setJobs([])
      setError(err instanceof Error ? err.message : 'Jobs konnten nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => {
    const active = jobs.filter(job => job.status !== 'Pausiert').length
    const errors = jobs.filter(job => job.status === 'Soft fail').length
    return [
      { key: 'Total', value: jobs.length, hint: 'Routinen', tone: 'fg' },
      { key: 'Active', value: active, hint: 'aktiv', tone: 'ok' },
      { key: 'Errors', value: errors, hint: 'soft fail', tone: 'err' },
      { key: 'Skills', value: jobs.reduce((sum, job) => sum + job.skillCount, 0), hint: 'referenziert', tone: 'fg' },
    ]
  }, [jobs])

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="AUTOMATION"
        title="Jobs & Skills"
        description="Geplante Agent-Jobs, Runbooks und Skills. Workspace Reviews werden hier als Core-Automation vorbereitet, laufen in dieser Version aber stabil manuell per Workspace-Review."
        actions={
          <>
            <button className="btn btn-sm" type="button" onClick={load}><RefreshCw size={13} />Aktualisieren</button>
            <button className="btn btn-sm btn-primary" type="button" disabled title="Automation-Proposals sind als naechster Core-Schritt geplant. Workspace Reviews laufen aktuell manuell stabil."><Plus size={13} />Request Automation</button>
          </>
        }
      />

      <div style={{ padding: '0 28px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {stats.map(stat => (
            <div key={stat.key} className="card" style={{ padding: 14 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-faint)' }}>{stat.key}</div>
              <div className="tabular" style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.015em', color: stat.tone === 'ok' ? 'var(--ok)' : stat.tone === 'err' ? 'var(--err)' : stat.tone === 'warn' ? 'var(--warn)' : 'var(--fg)', marginTop: 4 }}>{stat.value}</div>
              <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)' }}>{stat.hint}</div>
            </div>
          ))}
        </div>

        <div className="card" style={{ borderColor: 'rgba(16,185,129,0.35)', background: 'var(--ok-soft)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <MessageSquare size={14} style={{ color: 'var(--ok)' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>Workspace Review Loop</div>
            <div style={{ fontSize: 11.5, color: 'var(--fg-muted)' }}>
              Manual first: Workspaces koennen ihren Owner-Agent jetzt mit echtem Kontext briefen. Der geplante Cronjob wird hier spaeter als Runbook-Typ <span className="mono">workspace_review</span> sichtbar.
            </div>
          </div>
          <span className="badge badge-ok">Core vorbereitet</span>
        </div>

        {error ? <div className="badge badge-err">{error}</div> : null}

        {loading ? (
          <div className="card" style={{ padding: 24, display: 'flex', justifyContent: 'center' }}><Loader2 size={18} className="animate-spin" /></div>
        ) : jobs.length === 0 ? (
          <div className="card" style={{ padding: 18, fontSize: 13, color: 'var(--fg-muted)' }}>Keine Agent-Jobs in Supabase gefunden.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, alignItems: 'flex-start' }}>
            {AGENTS.map(agent => {
              const agentJobs = jobs.filter(job => job.agent === agent.name)
              const agentSkills = dedupeSkills(agentJobs)
              const view = agentViews[agent.name] || 'Jobs'
              const active = agentJobs.filter(job => job.status !== 'Pausiert').length
              const pct = agentJobs.length ? Math.round((active / agentJobs.length) * 100) : 0
              return (
                <div key={agent.name} className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ position: 'relative', minHeight: 148, background: `linear-gradient(135deg, ${agent.color} 0%, ${agent.color}cc 60%, ${agent.color}88 100%)`, color: '#fff', padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', right: -40, top: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', filter: 'blur(8px)' }} />
                    <div style={{ position: 'absolute', left: -30, bottom: -40, width: 120, height: 120, borderRadius: '50%', background: 'rgba(0,0,0,0.18)', filter: 'blur(20px)' }} />
                    <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', padding: '4px 8px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(6px)' }}>Agent Card</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)' }}>{agentJobs.length} Jobs</span>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <AgentAvatar agent={agent} size="lg" className="agent-routine-avatar" />
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.75 }}>{agent.role}</div>
                      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', marginTop: 4 }}>{agent.label}</div>
                      <div style={{ fontSize: 11.5, opacity: 0.8, marginTop: 2 }}>{agent.role} · {active} aktiv</div>
                    </div>
                    <div style={{ position: 'relative', height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.35)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${pct}%`, borderRadius: 999, background: '#fff' }} /></div>
                  </div>

                  <div style={{ padding: '10px 12px 0' }}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fg-faint)' }}>Agent-Faecher</span>
                      <div className="tabs" style={{ margin: 0 }}>
                        {(['Jobs', 'Skills', 'Beides'] as AgentView[]).map(label => (
                          <button
                            key={label}
                            type="button"
                            className={`tab ${view === label ? 'active' : ''}`}
                            style={{ fontSize: 10, padding: '4px 8px', border: 0 }}
                            onClick={() => setAgentViews(current => ({ ...current, [agent.name]: label }))}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="col gap-2" style={{ padding: 12 }}>
                    {view === 'Skills' ? (
                      agentSkills.length === 0 ? (
                        <div style={{ padding: 10, borderRadius: 12, background: 'var(--bg-sunk)', fontSize: 12, color: 'var(--fg-subtle)' }}>Keine Skills fuer diesen Agent referenziert.</div>
                      ) : agentSkills.map(skill => (
                        <div key={`${agent.name}-skill-${skill.id}`} style={{ padding: 10, borderRadius: 12, background: 'var(--bg-sunk)' }}>
                          <div className="row gap-2" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{skill.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 2 }}>{skill.usedFor}</div>
                            </div>
                            <span className="badge" style={{ fontSize: 9.5 }}>{skill.source}</span>
                          </div>
                          <div style={{ fontSize: 10.5, color: 'var(--fg-faint)', marginTop: 5 }}>{skill.confidence} · {skill.referenceCount} Quellen</div>
                        </div>
                      ))
                    ) : agentJobs.length === 0 ? (
                      <div style={{ padding: 10, borderRadius: 12, background: 'var(--bg-sunk)', fontSize: 12, color: 'var(--fg-subtle)' }}>Keine Jobs fuer diesen Agent.</div>
                    ) : agentJobs.map(job => (
                      <div key={`${agent.name}-${job.name}`} style={{ padding: 10, borderRadius: 12, background: 'var(--bg-sunk)' }}>
                        <div className="row gap-2" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{job.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 2 }}>{job.schedule} · {job.type}</div>
                          </div>
                          <span className={`badge ${statusClass(job.status)}`} style={{ fontSize: 9.5 }}>{job.status === 'Stabil' && <Check size={9} />} {job.status}</span>
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--fg-faint)', marginTop: 5 }}>{job.next}</div>
                        {view === 'Beides' ? (
                          <div className="row gap-1" style={{ flexWrap: 'wrap', marginTop: 8 }}>
                            {job.skills.length === 0 ? (
                              <span className="badge" style={{ fontSize: 9.5 }}>Keine Skills referenziert</span>
                            ) : job.skills.map(skill => (
                              <span key={`${job.name}-${skill.id}`} className="badge badge-info" style={{ fontSize: 9.5 }}>{skill.name}</span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
