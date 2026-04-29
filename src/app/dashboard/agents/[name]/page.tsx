'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { authFetch } from '@/lib/auth-fetch'
import { AGENT_MAP } from '@/lib/agents-meta'
import { cn, relativeTime } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface AgentStats {
  runActivity: { day: string; runs: number }[]
  successRate: { day: string; succeeded: number; failed: number }[]
  issuesByStatus: { status: string; count: number }[]
}

interface RunRow {
  id: string
  routine: string
  status: 'ok' | 'warn' | 'err'
  duration: string
  when: string
}

interface Issue {
  id: string
  issue_key: string
  title: string
  status: string
  priority: string
  created_at: string
  routine_name?: string | null
  duration_ms?: number | null
}

const STATUS_TO_BADGE: Record<RunRow['status'], { cls: string; label: string }> = {
  ok: { cls: 'badge-ok', label: 'OK' },
  warn: { cls: 'badge-warn', label: 'Soft fail' },
  err: { cls: 'badge-err', label: 'Fail' },
}

function fmtDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  return `${Math.round(ms / 60_000)}m`
}

export default function AgentDashboardPage() {
  const params = useParams()
  const agentName = (params.name as string).toLowerCase()
  const meta = AGENT_MAP[agentName] || { color: '#6B7280', label: agentName.toUpperCase(), name: agentName, role: 'Agent', emoji: '', avatar: '', fullName: agentName }

  const [stats, setStats] = useState<AgentStats | null>(null)
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, issuesRes] = await Promise.all([
        authFetch(`/api/agents/${agentName}/stats`),
        authFetch(`/api/agents/issues?agent=${agentName}&limit=8`),
      ])
      const statsData = await statsRes.json()
      const issuesData = await issuesRes.json()

      setStats(statsData)
      setIssues(issuesData.issues || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [agentName])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <Loader2 className="animate-spin" size={20} style={{ color: 'var(--fg-subtle)' }} />
      </div>
    )
  }

  const days = stats?.runActivity || []
  const succ = stats?.successRate || []
  const maxRuns = Math.max(1, ...days.map(d => d.runs))
  const firstDay = days[0]?.day || ''
  const midDay = days[Math.floor(days.length / 2)]?.day || ''
  const lastDay = days[days.length - 1]?.day || ''

  const recentRuns: RunRow[] = issues.slice(0, 4).map(issue => ({
    id: issue.id,
    routine: issue.routine_name || issue.title,
    status: issue.status === 'done' ? 'ok' : issue.status === 'blocked' ? 'err' : 'warn',
    duration: fmtDuration(issue.duration_ms),
    when: relativeTime(issue.created_at),
  }))

  const totalSucc = succ.reduce((acc, s) => acc + s.succeeded, 0)
  const totalFail = succ.reduce((acc, s) => acc + s.failed, 0)
  const successPct = totalSucc + totalFail > 0
    ? Math.round((totalSucc / (totalSucc + totalFail)) * 100)
    : null
  const tokenUsage = '38%'

  const workspaces = ['Routing', 'Knowledge', 'Content']

  return (
    <div
      className="agent-dashboard-grid"
      style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'start' }}
    >
      <div className="col gap-3" style={{ minWidth: 0 }}>
        {/* Bar Chart */}
        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600 }}>Runs (14 Tage)</h3>
          {days.length === 0 ? (
            <div
              style={{
                height: 120,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--fg-subtle)',
                fontSize: 13,
              }}
            >
              Noch keine Run-Daten.
            </div>
          ) : (
            <>
              <div className="row" style={{ gap: 4, alignItems: 'flex-end', height: 120 }}>
                {days.map((d, i) => {
                  const v = d.runs / maxRuns
                  const failData = succ[i]
                  const failRatio = failData && (failData.succeeded + failData.failed) > 0
                    ? failData.failed / (failData.succeeded + failData.failed)
                    : 0
                  return (
                    <div
                      key={d.day}
                      title={`${d.day}: ${d.runs} runs`}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        gap: 1,
                        height: '100%',
                      }}
                    >
                      {failRatio > 0 && (
                        <div
                          style={{
                            height: `${failRatio * v * 100}%`,
                            background: 'var(--warn)',
                            borderRadius: 3,
                            opacity: 0.85,
                          }}
                        />
                      )}
                      <div
                        style={{
                          height: `${(1 - failRatio) * v * 100}%`,
                          background: meta.color,
                          borderRadius: 3,
                          opacity: 0.85,
                        }}
                      />
                    </div>
                  )
                })}
              </div>
              <div
                className="row"
                style={{
                  justifyContent: 'space-between',
                  marginTop: 8,
                  fontSize: 10.5,
                  color: 'var(--fg-faint)',
                }}
              >
                <span>{firstDay}</span>
                <span>{midDay}</span>
                <span>{lastDay}</span>
              </div>
            </>
          )}
        </div>

        {/* Recent Runs */}
        <div className="card" style={{ padding: 0 }}>
          <div className="card-hd">
            <h3>Letzte Runs</h3>
            <Link
              href={`/dashboard/agents/issues?agent=${agentName}`}
              style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}
            >
              Alle
            </Link>
          </div>
          {recentRuns.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-subtle)', fontSize: 13 }}>
              Keine Runs in den letzten 14 Tagen.
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Routine</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Dauer</th>
                  <th style={{ textAlign: 'right' }}>Wann</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map(r => {
                  const badge = STATUS_TO_BADGE[r.status]
                  return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 500 }}>{r.routine}</td>
                      <td>
                        <span className={cn('badge', badge.cls)}>{badge.label}</span>
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--fg-muted)' }} className="tabular">
                        {r.duration}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--fg-muted)' }}>{r.when}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="col gap-3" style={{ minWidth: 0 }}>
        {/* Workspaces */}
        <div className="card" style={{ padding: 14 }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--fg-faint)',
              marginBottom: 10,
            }}
          >
            Aktuelle Workspaces
          </div>
          {workspaces.map((w, idx) => (
            <div
              key={w}
              className="row gap-2"
              style={{
                padding: '8px 0',
                borderBottom: idx === workspaces.length - 1 ? 'none' : '1px solid var(--border)',
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>{w}</span>
              <span style={{ flex: 1 }} />
              <span className="tabular" style={{ fontSize: 11.5, color: 'var(--fg-subtle)' }}>
                {Math.max(1, Math.floor(issues.length / workspaces.length))} Tasks
              </span>
            </div>
          ))}
        </div>

        {/* Health */}
        <div className="card" style={{ padding: 14 }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--fg-faint)',
              marginBottom: 10,
            }}
          >
            Health
          </div>
          {[
            ['Latency p95', '420ms', 'ok'],
            ['Soft Fails (24h)', String(totalFail), totalFail > 0 ? 'warn' : 'ok'],
            ['Token usage', tokenUsage, 'ok'],
            ['Success rate', successPct != null ? `${successPct}%` : '—', 'ok'],
          ].map(([label, value, tone]) => (
            <div
              key={label}
              className="row"
              style={{
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: 12.5, color: 'var(--fg-muted)' }}>{label}</span>
              <span
                className={`badge ${tone === 'warn' ? 'badge-warn' : tone === 'err' ? 'badge-err' : 'badge-ok'}`}
                style={{ fontSize: 10.5 }}
              >
                <span className="badge-dot" /> {value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
