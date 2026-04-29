"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bot, Folder, Loader2, Plus, RefreshCw, Sparkles, Terminal, Workflow } from 'lucide-react'
import { PageHeader } from '@/components/ui/mana-hub'
import { AGENT_MAP } from '@/lib/agents-meta'
import AgentAvatar from '@/components/ui/AgentAvatar'
import { authFetch } from '@/lib/auth-fetch'

interface SkillCard {
  id: string
  name: string
  source: string
  agents: string[]
  jobCount: number
  status?: string | null
}

interface SkillRow {
  id: string
  name?: string | null
  source?: string | null
  status?: string | null
  job_count?: number | null
}

interface AssignmentRow {
  skill_id?: string | null
  agent_id?: string | null
}

interface DiscoveredSkillRow {
  id: string
  name: string
  source?: string
  agent_id?: string | null
  job_count?: number | null
}

const PALETTES = {
  company: { from: '#A855F7', to: '#EC4899', icon: Sparkles, label: 'Company' },
  manual: { from: '#A855F7', to: '#EC4899', icon: Sparkles, label: 'Company' },
  agent_db: { from: '#3B82F6', to: '#06B6D4', icon: Bot, label: 'Agent' },
  codex: { from: '#10B981', to: '#06B6D4', icon: Terminal, label: 'Codex' },
  runbook: { from: '#F59E0B', to: '#EF4444', icon: Workflow, label: 'Runbook' },
  local: { from: '#71717A', to: '#27272A', icon: Folder, label: 'Local' },
  cloud_hub: { from: '#10B981', to: '#06B6D4', icon: Sparkles, label: 'Hub' },
  external: { from: '#F59E0B', to: '#EF4444', icon: Workflow, label: 'External' },
} as const

function paletteFor(source: string) {
  return PALETTES[source as keyof typeof PALETTES] || PALETTES.company
}

function normalizeSkills(skills: SkillRow[], assignments: AssignmentRow[], discovered: DiscoveredSkillRow[]) {
  const bySkill = new Map<string, string[]>()
  for (const assignment of assignments) {
    if (!assignment.skill_id || !assignment.agent_id) continue
    bySkill.set(assignment.skill_id, [...(bySkill.get(assignment.skill_id) || []), assignment.agent_id])
  }
  return [
    ...skills.map(skill => ({
      id: skill.id,
      name: skill.name || 'Untitled Skill',
      source: skill.source || 'company',
      agents: bySkill.get(skill.id) || [],
      jobCount: skill.job_count || 0,
      status: skill.status,
    })),
    ...discovered.map(skill => ({
      id: skill.id,
      name: skill.name,
      source: skill.source || 'runbook',
      agents: skill.agent_id ? [skill.agent_id] : [],
      jobCount: skill.job_count ?? 0,
      status: 'discovered',
    })),
  ]
}

export default function SkillHubPage() {
  const [skills, setSkills] = useState<SkillCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadedLive, setLoadedLive] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch('/api/agents/skills/hub')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Skills konnten nicht geladen werden')
      const live = normalizeSkills(data.skills || [], data.assignments || [], data.discoveredSkills || [])
      setSkills(live.length ? live : [])
      setLoadedLive(true)
    } catch (err) {
      setSkills([])
      setLoadedLive(false)
      setError(err instanceof Error ? err.message : 'Skills konnten nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const activeSkills = skills.filter(skill => skill.agents.length > 0).length
  const reviewCount = useMemo(() => skills.filter(skill => skill.status === 'reviewing').length, [skills])

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="FAEHIGKEITEN"
        title="Skill Hub"
        description="Wiederverwendbare Skills im App-Store-Stil. Importiere neue Skills, pruefe sie, weise sie deinen Agents zu."
        actions={
          <>
            <button className="btn btn-sm" type="button" onClick={load}><RefreshCw size={13} />Sicherheits-Review</button>
            <button className="btn btn-sm btn-primary" type="button" disabled title="Skill-Import wird im Core ueber User-Space-Dateien und kuenftige Installer-Flows ergaenzt."><Plus size={13} />Skill importieren</button>
          </>
        }
      />

      <div style={{ padding: '0 28px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { key: 'Skill-Katalog', value: skills.length, hint: 'verfuegbare Skills', tone: 'fg' },
            { key: 'Aktiv genutzt', value: activeSkills, hint: 'mind. einem Agent zugeordnet', tone: 'ok' },
            { key: 'Im Review', value: reviewCount, hint: 'wartet auf Pruefung', tone: 'warn' },
          ].map(item => (
            <div key={item.key} className="card" style={{ padding: 14 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-faint)' }}>{item.key}</div>
              <div className="tabular" style={{ fontSize: 24, fontWeight: 600, marginTop: 4, color: item.tone === 'ok' ? 'var(--ok)' : item.tone === 'warn' ? 'var(--warn)' : 'var(--fg)' }}>{item.value}</div>
              <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)' }}>{item.hint}</div>
            </div>
          ))}
        </div>

        <div className="card card-overflow-visible" style={{ padding: 18 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div><h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Skill App Store</h3><div style={{ fontSize: 11.5, color: 'var(--fg-subtle)', marginTop: 2 }}>Alle Company-, lokalen und aus Cronjobs erkannten Skills an einem Ort.</div></div>
            {loadedLive ? <span className="badge">Live aus Supabase</span> : null}
          </div>

          {error ? (
            <div className="badge badge-err mb-3">{error}</div>
          ) : null}

          {loading ? (
            <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}><Loader2 size={18} className="animate-spin" /></div>
          ) : skills.length === 0 ? (
            <div style={{ padding: 18, fontSize: 13, color: 'var(--fg-muted)' }}>Noch keine Skills installiert oder erkannt.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 24, padding: '8px 4px' }}>
              {skills.map(skill => {
                const palette = paletteFor(skill.source)
                const Icon = palette.icon
                return (
                  <div key={skill.id} className="skill-app">
                    <div className="skill-app-icon" style={{ background: `linear-gradient(135deg, ${palette.from}, ${palette.to})` }}>
                      <Icon size={26} />
                      {skill.agents.length > 0 && (
                        <div className="skill-app-agents">
                          {skill.agents.slice(0, 3).map(agentName => {
                            const agent = AGENT_MAP[agentName]
                            return agent ? <AgentAvatar key={agentName} agent={agent} size="xs" /> : null
                          })}
                        </div>
                      )}
                    </div>
                    <div className="skill-app-name">{skill.name}</div>
                    <div className="skill-app-source">{palette.label} · {skill.jobCount} jobs</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
