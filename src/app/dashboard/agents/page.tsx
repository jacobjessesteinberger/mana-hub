'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { authFetch } from '@/lib/auth-fetch'
import { cn } from '@/lib/utils'
import { AGENTS, AGENT_MAP } from '@/lib/agents-meta'
import { usePageVisible } from '@/hooks/usePageVisible'
import AgentAvatar from '@/components/ui/AgentAvatar'
import { AHDot, AHPill, PageHeader } from '@/components/ui/mana-hub'
import {
  Bot, FolderKanban, Loader2,
  Newspaper, ShieldCheck, Target
} from 'lucide-react'

const ActivityChart = dynamic(() => import('@/components/dashboard/ActivityChart'), {
  ssr: false,
  loading: () => <div className="h-32" />,
})

interface AgentActivity {
  agent: string
  active: boolean
  steps: string[]
  elapsed: string
}

interface AgentStatus {
  id: string
  name: string
  is_online: boolean
  last_seen: string | null
}

interface Issue {
  id: string
  issue_key: string
  title: string
  status: string
  priority: string
  agent_name: string
  created_at: string
}

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 5) return 'gerade eben'
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  done: { label: 'Done', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' },
  in_progress: { label: 'Active', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' },
  todo: { label: 'Todo', cls: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
  in_review: { label: 'Review', cls: 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400' },
  blocked: { label: 'Blocked', cls: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400' },
  cancelled: { label: 'Cancelled', cls: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500' },
}

export default function DashboardPage() {
  const [activities, setActivities] = useState<Record<string, AgentActivity>>({})
  const [agents, setAgents] = useState<AgentStatus[]>([])
  const [issues, setIssues] = useState<Issue[]>([])
  const [recentIssues, setRecentIssues] = useState<Issue[]>([])
  const [pendingApprovals, setPendingApprovals] = useState(0)
  const [dailyActivity, setDailyActivity] = useState<{ d: string; r: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [activityLog, setActivityLog] = useState<{ agent: string; event: string; time: string }[]>([])

  const fetchAll = useCallback(async () => {
    try {
      const [monRes, issRes, apprRes] = await Promise.all([
        authFetch('/api/agents/monitoring'),
        authFetch('/api/agents/issues?limit=50'),
        authFetch('/api/agents/approvals?status=pending').catch(() => null),
      ])

      const monData = await monRes.json()
      setAgents(monData.agents || [])
      setActivityLog((monData.activity || []).slice(0, 8).map((a: { agent_id: string; event_summary: string; created_at: string }) => ({
        agent: a.agent_id, event: a.event_summary, time: a.created_at,
      })))

      const issData = await issRes.json()
      const allIssues: Issue[] = issData.issues || []
      setIssues(allIssues)
      setRecentIssues(allIssues.slice(0, 6))

      const now = new Date()
      const dailyMap = new Map<string, number>()
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        dailyMap.set(d.toISOString().slice(5, 10), 0)
      }
      for (const iss of allIssues) {
        const key = iss.created_at?.slice(5, 10)
        if (key && dailyMap.has(key)) {
          dailyMap.set(key, (dailyMap.get(key) || 0) + 1)
        }
      }
      setDailyActivity([...dailyMap.entries()].map(([d, r]) => ({ d, r })))

      if (apprRes) {
        const apprData = await apprRes.json()
        setPendingApprovals((apprData.approvals || []).length)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  const fetchActivities = useCallback(async () => {
    try {
      const res = await authFetch('/api/agents/activity')
      const data = await res.json()
      const map = (data.activities || {}) as Record<string, AgentActivity & { active: boolean }>
      const filtered: Record<string, AgentActivity> = {}
      for (const [name, act] of Object.entries(map)) {
        if (act?.active) filtered[name] = act
      }
      setActivities(filtered)
    } catch { /* ignore */ }
  }, [])

  const visible = usePageVisible()

  useEffect(() => {
    fetchAll()
    fetchActivities()
  }, [fetchAll, fetchActivities])

  useEffect(() => {
    if (!visible) return
    const i1 = setInterval(fetchAll, 60_000)
    const i2 = setInterval(fetchActivities, 10_000)
    return () => { clearInterval(i1); clearInterval(i2) }
  }, [fetchAll, fetchActivities, visible])

  const onlineCount = agents.filter(a => a.is_online).length
  const openIssues = issues.filter(i => ['todo', 'in_progress'].includes(i.status))
  const activeAgentNames = Object.keys(activities)

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="ÜBERSICHT"
        title="Dashboard"
        description="Der Puls deines Agent-Teams. Was läuft, was wartet auf dich, was ist heute passiert."
        badges={<AHPill tone="accent"><AHDot tone="ok" /> {onlineCount} live</AHPill>}
        actions={
          <>
            <Link href="/dashboard/agents/briefings" className="btn btn-sm">
              <Newspaper className="h-3.5 w-3.5" /> Briefings
            </Link>
            <Link href="/dashboard/agents/issues?new=true" className="btn btn-primary btn-sm">
              Create Task
            </Link>
          </>
        }
      />

      <div className="page-pad" style={{ padding: '0 28px 28px' }}>
        <div className="col gap-4">
          <div className="card card-hero card-pad">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_432px]">
              <div>
                <div className="badge badge-accent"><span className="badge-dot" /> Agent Collaboration OS</div>
                <h2 className="mt-3 text-[18px] font-semibold leading-tight tracking-[-0.01em] text-[var(--fg)]">
                  Von Briefing zu freigegebener Umsetzung
                </h2>
                <p className="mt-1.5 max-w-2xl text-[11.5px] leading-5 text-[var(--fg-muted)]">
                  Agenten liefern Briefings, du antwortest mit Kontext, daraus entstehen Tasks und riskante Aktionen landen in Risk Approval.
                </p>
              </div>
              <div className="hidden grid-cols-4 divide-x divide-[var(--border)] border-l border-[var(--border)] md:grid">
                {[
                  { href: '/dashboard/agents/briefings', label: 'Briefing lesen', icon: Newspaper },
                  { href: '/dashboard/agents/projects', label: 'Workspace bündeln', icon: FolderKanban },
                  { href: '/dashboard/agents/goals', label: 'Outcome messen', icon: Target },
                  { href: '/dashboard/agents/approvals', label: 'Risk Approval', icon: ShieldCheck },
                ].map(item => (
                  <Link key={item.href} href={item.href} className="flex min-h-[74px] flex-col justify-center gap-2 px-4 text-[11px] font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]">
                    <item.icon className="h-3.5 w-3.5 text-[var(--fg-subtle)]" />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <div className="col gap-4">

          <div className="card">
            <div className="card-hd">
              <h3>Overview</h3>
              <span className="badge">This month</span>
            </div>
            <div className="card-bd">
              <div className="grid grid-cols-2 divide-y divide-[var(--border)] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
                {[
                  { label: 'Agents online', value: onlineCount, hint: 'live', tone: 'ok' },
                  { label: 'Tasks active', value: openIssues.filter(i => i.status === 'in_progress').length, hint: 'running', tone: 'info' },
                  { label: 'Recent tasks', value: recentIssues.length, hint: 'last 50', tone: 'accent' },
                  { label: 'Pending reviews', value: pendingApprovals, hint: 'approval', tone: 'warn' },
                ].map(item => (
                  <div key={item.label} className="px-2 py-1 first:pl-0 sm:px-5 sm:first:pl-0">
                    <div className="row gap-2">
                      <span className="tabular text-[24px] font-semibold leading-none tracking-[-0.03em] text-[var(--fg)]">{item.value}</span>
                      <span className={cn('badge', item.tone === 'ok' && 'badge-ok', item.tone === 'info' && 'badge-info', item.tone === 'accent' && 'badge-accent', item.tone === 'warn' && 'badge-warn')}>
                        {item.hint}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--fg-muted)]">{item.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 border-t border-[var(--border)] pt-5">
                <div className="mb-4 row" style={{ justifyContent: 'space-between' }}>
                  <div className="text-[13.5px] font-medium text-[var(--fg)]">
                    {activeAgentNames.length > 0 ? `${activeAgentNames.length} agents working now` : `${AGENTS.length} agents registered`}
                  </div>
                  <Link href="/dashboard/agents/health" className="btn btn-xs btn-ghost">View all</Link>
                </div>
                <div className="flex flex-wrap gap-4">
                  {AGENTS.map(agent => {
                    const isWorking = activeAgentNames.includes(agent.name)
                    const agentStatus = agents.find(a => a.name === agent.name)
                    return (
                      <Link key={agent.name} href={`/dashboard/agents/${agent.name}/chat`} className="group col items-center gap-1.5">
                        <div className={cn('relative rounded-full p-0.5', isWorking && 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-elev)]')}>
                          <AgentAvatar agent={agent} size="sm" />
                          {(agentStatus?.is_online || isWorking) && (
                            <span className="absolute -bottom-0 -right-0 h-2.5 w-2.5 rounded-full bg-[var(--ok)] ring-2 ring-[var(--bg-elev)]" />
                          )}
                        </div>
                        <span className="text-[11.5px] text-[var(--fg-muted)] transition-colors group-hover:text-[var(--fg)]">{agent.label}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {activeAgentNames.length > 0 && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {activeAgentNames.map(name => {
                const meta = AGENT_MAP[name]
                const activity = activities[name]
                if (!meta || !activity) return null
                const currentIssue = issues.find(i => i.agent_name === name && i.status === 'in_progress')
                return (
                  <Link key={name} href={`/dashboard/agents/${name}/chat`} className="card card-pad block">
                    <div className="row gap-2" style={{ justifyContent: 'space-between' }}>
                      <div className="row gap-2">
                        <AgentAvatar agent={meta} size="xs" />
                        <span className="font-medium text-[var(--fg)]">{meta.label}</span>
                      </div>
                      <span className="badge badge-ok"><span className="badge-dot" /> Live</span>
                    </div>
                    {currentIssue && (
                      <p className="mt-3 truncate text-[12.5px] font-medium text-[var(--fg-muted)]">
                        {currentIssue.issue_key} · {currentIssue.title}
                      </p>
                    )}
                    <div className="mt-3 max-h-16 space-y-1 overflow-hidden text-[11.5px] leading-relaxed text-[var(--fg-subtle)]">
                      {activity.steps.slice(-3).map((step, i) => <p key={i} className="truncate">{step}</p>)}
                      {activity.steps.length === 0 && <p>Waiting for output...</p>}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          <div className="card">
            <div className="card-hd">
              <h3>Activity</h3>
              <span className="badge">Last 14 days</span>
            </div>
            <div className="card-bd">
              <div className="h-48">
                <ActivityChart data={dailyActivity} />
              </div>
              <p className="mt-4 text-[26px] font-semibold tracking-[-0.025em] text-[var(--fg)]">
                {issues.length} <span className="text-[13px] font-normal text-[var(--fg-subtle)]">total tasks</span>
              </p>
            </div>
          </div>
            </div>

        <div className="col gap-4">
          <div className="card">
            <div className="card-hd">
              <h3>Active Tasks</h3>
              <Link href="/dashboard/agents/issues" className="btn btn-xs btn-ghost">All tasks</Link>
            </div>
            <div className="card-bd">
              <div className="col gap-3">
                {recentIssues.map(iss => {
                  const agent = AGENT_MAP[iss.agent_name]
                  const badge = STATUS_BADGE[iss.status] || STATUS_BADGE.todo
                  return (
                    <Link key={iss.id} href={`/dashboard/agents/issues/${iss.id}`} className="row gap-3 rounded-[16px] px-1 py-1 transition-colors hover:bg-[var(--bg-hover)]">
                      {agent && <AgentAvatar agent={agent} size="xs" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-[var(--fg)]">{iss.title}</p>
                        <p className="text-[11.5px] text-[var(--fg-subtle)]">{agent?.label} · {iss.issue_key}</p>
                      </div>
                      <span className={cn('badge', badge.label === 'Done' && 'badge-ok', badge.label === 'Active' && 'badge-info', badge.label === 'Review' && 'badge-accent', badge.label === 'Blocked' && 'badge-danger')}>
                        {badge.label}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-hd"><h3>Recent Activity</h3></div>
            <div className="card-bd">
              <div className="col gap-3">
                {(activityLog.length ? activityLog : issues.slice(0, 5).map(iss => ({
                  agent: iss.agent_name,
                  event: `created ${iss.issue_key}`,
                  time: iss.created_at,
                }))).map((entry, i) => {
                  const agent = AGENT_MAP[entry.agent]
                  return (
                    <div key={i} className="row gap-3" style={{ alignItems: 'flex-start' }}>
                      {agent ? <AgentAvatar agent={agent} size="xs" /> : <Bot className="mt-0.5 h-5 w-5 text-[var(--fg-faint)]" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-[var(--fg-muted)]">
                          <span className="font-medium text-[var(--fg)]">{agent?.label || entry.agent}</span> {entry.event}
                        </p>
                      </div>
                      <span className="mt-0.5 shrink-0 text-[10.5px] text-[var(--fg-faint)]">{relativeTime(entry.time)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
            <div className="card">
              <div className="card-hd">
                <h3>Health</h3>
                <span className="badge badge-ok">All good</span>
              </div>
              <div className="card-bd col gap-3 text-[12px] text-[var(--fg-muted)]">
                <div className="row gap-2"><span className="dot ok" /> Supabase <span className="spacer" /> Demo</div>
                <div className="row gap-2"><span className="dot ok" /> Agents <span className="spacer" /> {onlineCount} live</div>
                <div className="row gap-2"><span className="dot ok" /> Knowledge sync <span className="spacer" /> up to date</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}
