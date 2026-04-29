'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { AGENT_MAP } from '@/lib/agents-meta'
import { Plus, Sparkles, Loader2 } from 'lucide-react'
import { authFetch } from '@/lib/auth-fetch'

interface AgentSkill {
  id: string
  agent_id: string
  name: string
  description: string | null
  category: string | null
  is_enabled: boolean
}

export default function AgentSkillsPage() {
  const { name } = useParams<{ name: string }>()
  const agentName = name?.toLowerCase() || ''
  const meta = AGENT_MAP[agentName]
  const [skills, setSkills] = useState<AgentSkill[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await authFetch(`/api/agents/${agentName}/skills`)
        const data = await res.json()
        setSkills(data.skills || [])
      } catch {
        /* ignore */
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [agentName])

  if (!meta) {
    return <div style={{ padding: 24, color: 'var(--fg-subtle)' }}>Agent nicht gefunden</div>
  }

  const accent = meta.color

  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Zugewiesene Skills</h3>
          <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)', marginTop: 2 }}>
            Methoden, die {meta.label} in seinen Crownjobs einsetzt.
          </div>
        </div>
        <button type="button" className="btn btn-sm">
          <Plus size={12} /> Skill zuweisen
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
          <Loader2 size={18} className="animate-spin" style={{ color: 'var(--fg-subtle)' }} />
        </div>
      ) : skills.length === 0 ? (
        <div
          style={{
            border: '1px dashed var(--border)',
            borderRadius: 14,
            padding: 32,
            textAlign: 'center',
            color: 'var(--fg-subtle)',
          }}
        >
          <Sparkles size={20} style={{ margin: '0 auto 8px', display: 'block', color: 'var(--fg-faint)' }} />
          <div style={{ fontSize: 13 }}>Keine Skills zugewiesen</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {skills.map(skill => (
            <div key={skill.id} className="card" style={{ padding: 14, background: 'var(--bg-elev)' }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: `linear-gradient(135deg, ${accent}, ${accent}88)`,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Sparkles size={16} />
                </div>
                <span
                  className={`badge ${skill.is_enabled ? 'badge-ok' : ''}`}
                  style={{ fontSize: 9.5 }}
                >
                  {skill.is_enabled ? 'aktiv' : 'inaktiv'}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{skill.name}</div>
              <div style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 3 }}>
                {skill.category || 'general'} · {skill.description ? 'spezifiziert' : 'standard'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
