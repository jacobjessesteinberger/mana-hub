'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { AGENT_MAP } from '@/lib/agents-meta'
import { Book, Check, Loader2 } from 'lucide-react'

interface Guardrail {
  label: string
  active: boolean
}

const DEFAULT_GUARDRAILS: Guardrail[] = [
  { label: 'Keine externen API-Calls ohne Approval', active: true },
  { label: 'Keine Code-Pushes auf main', active: true },
  { label: 'Bei kritischen Aktionen immer Operator-Handoff', active: true },
  { label: 'Antworten auf Deutsch, ausser anders gefordert', active: false },
]

export default function InstructionsPage() {
  const { name } = useParams<{ name: string }>()
  const agentName = name?.toLowerCase() || ''
  const meta = AGENT_MAP[agentName]
  const role = meta?.role || 'Agent'
  const bio = meta?.bio || ''

  const [system, setSystem] = useState<string>('')
  const [original, setOriginal] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [guardrails, setGuardrails] = useState<Guardrail[]>(DEFAULT_GUARDRAILS)

  const loadEntryFile = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch(`/api/agents/${agentName}/files?file=CLAUDE.md`)
      if (res.ok) {
        const data = await res.json()
        setSystem(data.content || '')
        setOriginal(data.content || '')
      } else {
        const fallback = `Du bist ${meta?.label || agentName}, Rolle: ${role}.\n\nDeine Aufgabe:\n${bio}\n\nStilrichtlinien:\n- Klar, knapp, konkret. Keine Floskeln.\n- Quellen immer mit Link, mind. 2 unabhaengige Quellen pro Story.\n- Bei high/critical Risk: Kein Auto-Run, immer Approval.\n\nOutput-Vorgaben:\n- TL;DR ganz oben (max 2 Saetze)\n- Top-3 Stories nummeriert\n- Einordnung in eigenem Block\n`
        setSystem(fallback)
        setOriginal(fallback)
      }
    } catch {
      setSystem('')
      setOriginal('')
    } finally {
      setLoading(false)
    }
  }, [agentName, bio, meta?.label, role])

  useEffect(() => { loadEntryFile() }, [loadEntryFile])

  const isDirty = system !== original

  const knowledgeRefs = [
    `playbooks/${agentName}.md`,
    'company/brand-voice.md',
    `runbooks/${role.toLowerCase()}.md`,
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 16, alignItems: 'start' }} className="agent-instructions-grid">
      <div className="col gap-3" style={{ minWidth: 0 }}>
        <div className="card" style={{ padding: 18 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>System Prompt</h3>
              <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)', marginTop: 2 }}>
                Was {meta?.label || agentName} immer tun soll.
              </div>
            </div>
            <span className="badge">CLAUDE.md</span>
          </div>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
              <Loader2 size={18} className="animate-spin" style={{ color: 'var(--fg-subtle)' }} />
            </div>
          ) : (
            <textarea
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              style={{
                width: '100%',
                minHeight: 260,
                resize: 'vertical',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 14,
                font: '13px var(--font-mono)',
                color: 'var(--fg)',
                background: 'var(--bg-sunk)',
                outline: 'none',
                lineHeight: 1.55,
              }}
            />
          )}
          <div className="row gap-2" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-sm" disabled={!isDirty} onClick={() => setSystem(original)}>
              Verwerfen
            </button>
            <button type="button" className="btn btn-sm btn-primary" disabled title="Speichern benoetigt eine sichere Write-API fuer Agent-Instructions und ist im Core bewusst deaktiviert.">
              <Check size={11} /> Speichern
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Guardrails</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {guardrails.map((g, i) => (
              <button
                key={i}
                type="button"
                onClick={() =>
                  setGuardrails(prev => prev.map((x, idx) => (idx === i ? { ...x, active: !x.active } : x)))
                }
                className="row"
                style={{
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: 'var(--bg-sunk)',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  color: 'var(--fg)',
                }}
              >
                <span style={{ fontSize: 13 }}>{g.label}</span>
                <span className={`badge ${g.active ? 'badge-ok' : ''}`} style={{ fontSize: 10.5 }}>
                  {g.active ? 'Aktiv' : 'Inaktiv'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="col gap-3 agent-instructions-aside" style={{ minWidth: 0 }}>
        <div className="card" style={{ padding: 14 }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--fg-faint)',
              marginBottom: 8,
            }}
          >
            Modell
          </div>
          {[
            ['Provider', 'Anthropic'],
            ['Modell', 'claude-sonnet-4.5'],
            ['Temperature', '0.4'],
            ['Max Tokens', '4096'],
          ].map(([k, v]) => (
            <div key={k} className="row" style={{ justifyContent: 'space-between', padding: '6px 0' }}>
              <span style={{ fontSize: 12.5, color: 'var(--fg-subtle)' }}>{k}</span>
              <b className="tabular" style={{ fontSize: 12.5 }}>{v}</b>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--fg-faint)',
              marginBottom: 8,
            }}
          >
            Knowledge-Refs
          </div>
          {knowledgeRefs.map(p => (
            <div key={p} className="row gap-2" style={{ padding: '6px 0', fontSize: 11.5 }}>
              <Book size={11} style={{ color: 'var(--fg-subtle)', flex: 'none' }} />
              <span
                className="mono"
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {p}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
