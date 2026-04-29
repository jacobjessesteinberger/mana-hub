'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { authFetch } from '@/lib/auth-fetch'
import { AGENT_MAP } from '@/lib/agents-meta'
import AgentAvatar from '@/components/ui/AgentAvatar'
import {
  Activity, AlertTriangle, ArrowLeft, ArrowUpRight, Eye,
  Target, Edit3, Trash2, CheckCircle2, Clock, AlertCircle, MessageSquare, Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Project {
  id: string
  slug: string
  name: string
  description: string | null
  status: string
  color: string
  owner_agent: string | null
  created_at: string
  updated_at: string
}

interface Issue {
  id: string
  issue_key?: string
  title: string
  description?: string | null
  status: string
  priority: string
  agent_name: string | null
  next_action?: string | null
  blocked_reason?: string | null
  due_at?: string | null
  created_at: string
  updated_at?: string
}

interface Goal {
  id: string
  title: string
  status: string
  level: string
  created_at: string
}

const ISSUE_STATUS_ICON: Record<string, typeof Clock> = {
  todo: Clock,
  in_progress: AlertCircle,
  in_review: AlertCircle,
  done: CheckCircle2,
  cancelled: Trash2,
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktiv',
  paused: 'Pausiert',
  completed: 'Abgeschlossen',
  archived: 'Archiviert',
}

function relativeTime(iso?: string | null) {
  if (!iso) return 'keine Aktivität'
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'gerade eben'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function TaskMiniRow({ issue }: { issue: Issue }) {
  const Icon = ISSUE_STATUS_ICON[issue.status] || Clock
  const agent = issue.agent_name ? AGENT_MAP[issue.agent_name] : null

  return (
    <Link
      href={`/dashboard/agents/issues/${issue.id}`}
      className="group flex items-start gap-3 px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-purple-200 dark:hover:border-purple-500/30 transition-colors"
    >
      <Icon className={cn(
        'w-4 h-4 flex-shrink-0 mt-0.5',
        issue.status === 'done' ? 'text-emerald-500'
          : issue.status === 'in_progress' ? 'text-blue-500'
            : issue.status === 'in_review' ? 'text-amber-500'
              : issue.status === 'blocked' ? 'text-red-500'
                : 'text-zinc-400'
      )} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-900 dark:text-white truncate group-hover:text-purple-600 dark:group-hover:text-purple-400">
            {issue.title}
          </span>
          {issue.issue_key && <span className="text-[10px] font-mono text-zinc-400">{issue.issue_key}</span>}
        </div>
        <p className="mt-0.5 text-xs text-zinc-500 truncate">
          {issue.next_action || issue.blocked_reason || issue.description || 'Kein nächster Schritt hinterlegt'}
        </p>
      </div>
      {agent && <AgentAvatar agent={agent} size="xs" />}
      <span className={cn(
        'text-[10px] font-semibold px-1.5 py-0.5 rounded-md',
        issue.priority === 'critical' ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
          : issue.priority === 'high' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400'
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
      )}>
        {issue.priority}
      </span>
    </Link>
  )
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [issues, setIssues] = useState<Issue[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await authFetch(`/api/agents/projects/${id}`)
      const json = await res.json()
      setProject(json.project)
      setIssues(json.issues || [])
      setGoals(json.goals || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!project) return
    await authFetch(`/api/agents/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editName || project.name,
        description: editDesc || project.description,
        status: editStatus || project.status,
      }),
    })
    setEditing(false)
    load()
  }

  const handleArchive = async () => {
    await authFetch(`/api/agents/projects/${id}`, { method: 'DELETE' })
    router.push('/dashboard/agents/projects')
  }

  const handleReview = async () => {
    if (!project || reviewing) return
    setReviewing(true)
    setReviewError(null)
    try {
      const res = await authFetch(`/api/agents/projects/${project.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_name: project.owner_agent || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Workspace Review konnte nicht gestartet werden')
      router.push(data.chat_url || `/dashboard/agents/${project.owner_agent || 'orchestrator'}/chat`)
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Workspace Review konnte nicht gestartet werden')
    } finally {
      setReviewing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-zinc-500">Workspace nicht gefunden.</p>
      </div>
    )
  }

  const owner = project.owner_agent ? AGENT_MAP[project.owner_agent] : null
  const liveIssues = issues.filter(issue => issue.status === 'in_progress')
  const reviewIssues = issues.filter(issue => issue.status === 'in_review')
  const blockedIssues = issues.filter(issue => issue.status === 'blocked')
  const recentDone = issues.filter(issue => issue.status === 'done').slice(0, 5)
  const needsAttention = [...blockedIssues, ...reviewIssues]
  const activeGoals = goals.filter(goal => goal.status !== 'completed')
  const lastActivity = [...issues]
    .map(issue => issue.updated_at || issue.created_at)
    .filter(Boolean)
    .sort()
    .at(-1) || project.updated_at || project.created_at

  return (
    <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-5">
      <Link
        href="/dashboard/agents/projects"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Zurück zu Workspaces
      </Link>

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-4 h-4 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: project.color }} />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-purple-500">Workspace Mission Control</p>
              <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">{project.name}</h1>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-3xl">
                {project.description || 'Dieser Workspace bündelt laufende Agent-Arbeit, Outcomes, Reviews und Blocker fuer eine konkrete Initiative.'}
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <span className={cn(
                  'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                  project.status === 'active' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : project.status === 'paused' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                )}>
                  {STATUS_LABELS[project.status] || project.status}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                  {owner ? <AgentAvatar agent={owner} size="xs" /> : <Target className="w-3.5 h-3.5" />}
                  Owner: {owner?.label || 'nicht gesetzt'}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                  <Clock className="w-3.5 h-3.5" />
                  Aktivität {relativeTime(lastActivity)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleReview}
              disabled={reviewing || !owner}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={owner ? 'Owner-Agent mit Workspace-Kontext briefen' : 'Setze zuerst einen Owner-Agent fuer diesen Workspace'}
              type="button"
            >
              {reviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
              Agent Review starten
            </button>
            <button
              onClick={() => {
                setEditName(project.name)
                setEditDesc(project.description || '')
                setEditStatus(project.status)
                setEditing(!editing)
              }}
              className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={handleArchive}
              className="p-2 rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {reviewError ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            {reviewError}
          </div>
        ) : null}

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-5">
          {[
            { label: 'Live', value: liveIssues.length, icon: Activity, tone: 'text-blue-500' },
            { label: 'Needs Review', value: reviewIssues.length, icon: Eye, tone: 'text-amber-500' },
            { label: 'Blocked', value: blockedIssues.length, icon: AlertTriangle, tone: 'text-red-500' },
            { label: 'Outcomes', value: activeGoals.length || goals.length, icon: Target, tone: 'text-purple-500' },
            { label: 'Recent Done', value: recentDone.length, icon: CheckCircle2, tone: 'text-emerald-500' },
          ].map(metric => (
            <div key={metric.label} className="rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800 px-3 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{metric.label}</span>
                <metric.icon className={cn('w-4 h-4', metric.tone)} />
              </div>
              <p className="mt-2 text-xl font-bold text-zinc-900 dark:text-white">{metric.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Form */}
      {editing && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 mb-6 space-y-3">
          <input
            value={editName}
            onChange={e => setEditName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-sm"
          />
          <textarea
            value={editDesc}
            onChange={e => setEditDesc(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-sm resize-none"
          />
          <select
            value={editStatus}
            onChange={e => setEditStatus(e.target.value)}
            className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-sm"
          >
            <option value="active">Aktiv</option>
            <option value="paused">Pausiert</option>
            <option value="completed">Abgeschlossen</option>
            <option value="archived">Archiviert</option>
          </select>
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100">
              Speichern
            </button>
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg text-xs text-zinc-500 hover:bg-zinc-100">
              Abbrechen
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-5">
        <div className="space-y-5">
          <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" />
                Live Execution
              </h2>
              <Link href="/dashboard/agents/issues" className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-purple-500">
                Execution Monitor <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            {liveIssues.length === 0 ? (
              <p className="text-xs text-zinc-500 py-5">Keine laufenden Agent-Tasks in diesem Workspace.</p>
            ) : (
              <div className="space-y-2">
                {liveIssues.map(issue => <TaskMiniRow key={issue.id} issue={issue} />)}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Needs Attention
              </h2>
              <span className="text-xs text-zinc-400">{needsAttention.length} offen</span>
            </div>
            {needsAttention.length === 0 ? (
              <p className="text-xs text-zinc-500 py-5">Keine Blocker oder offenen Reviews. Dieser Workspace läuft sauber.</p>
            ) : (
              <div className="space-y-2">
                {needsAttention.map(issue => <TaskMiniRow key={issue.id} issue={issue} />)}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-500" />
                Outcomes
              </h2>
              <span className="text-xs text-zinc-400">{goals.length} total</span>
            </div>
            {goals.length === 0 ? (
              <p className="text-xs text-zinc-500 py-5">Noch keine Outcomes verknüpft. Dieser Workspace braucht ein messbares Ziel.</p>
            ) : (
              <div className="space-y-2">
                {goals.map(goal => (
                  <div key={goal.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50">
                    <Target className="w-4 h-4 text-purple-500 flex-shrink-0" />
                    <span className="flex-1 text-sm text-zinc-900 dark:text-white truncate">{goal.title}</span>
                    <span className="text-[10px] text-zinc-400">{goal.level}</span>
                    <span className={cn(
                      'text-[10px] font-semibold px-1.5 py-0.5 rounded-md',
                      goal.status === 'completed' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : goal.status === 'in_progress' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                    )}>
                      {goal.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Recent Done
              </h2>
              <span className="text-xs text-zinc-400">{recentDone.length} erledigt</span>
            </div>
            {recentDone.length === 0 ? (
              <p className="text-xs text-zinc-500 py-5">Noch keine abgeschlossenen Tasks in diesem Workspace.</p>
            ) : (
              <div className="space-y-2">
                {recentDone.map(issue => <TaskMiniRow key={issue.id} issue={issue} />)}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
