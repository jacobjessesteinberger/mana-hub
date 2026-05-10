'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { authFetch } from '@/lib/auth-fetch'
import { AGENT_MAP } from '@/lib/agents-meta'
import AgentAvatar from '@/components/ui/AgentAvatar'
import { cn, relativeTime } from '@/lib/utils'
import { onAgentEvent } from '@/lib/notifications/NotificationContext'
import {
  ArrowLeft, Loader2, Circle, CheckCircle2, Clock, Pause,
  AlertTriangle, Send, MessageSquare, Activity,
  ChevronDown, X, Trash2, Eye, RotateCcw, Copy,
  ExternalLink, MoreHorizontal,
  Archive, ArchiveRestore
} from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'

interface Issue {
  id: string
  issue_key: string
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked'
  priority: 'low' | 'medium' | 'high' | 'critical'
  agent_name: string | null
  reviewer_agent: string | null
  project: string | null
  labels: string[]
  goal_id: string | null
  due_at: string | null
  acceptance_criteria: string | null
  next_action: string | null
  blocked_reason: string | null
  source_type: string | null
  source_id: string | null
  created_by: string
  result: string | null
  started_at: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  archived?: boolean
}

interface Comment {
  id: string
  issue_id: string
  author: string
  content: string
  created_at: string
}

interface Run {
  id: string
  issue_id: string
  agent_name: string
  status: 'running' | 'succeeded' | 'failed' | 'stopped'
  run_id: string
  output: string | null
  tokens_used: number | null
  started_at: string
  completed_at: string | null
  duration_seconds: number | null
}

const STATUS_OPTIONS = [
  { value: 'todo', label: 'Todo', icon: Circle, color: 'text-zinc-400', dot: 'bg-zinc-400' },
  { value: 'in_progress', label: 'In Progress', icon: Clock, color: 'text-blue-400', dot: 'bg-blue-500' },
  { value: 'in_review', label: 'In Review', icon: Eye, color: 'text-amber-400', dot: 'bg-amber-500' },
  { value: 'done', label: 'Done', icon: CheckCircle2, color: 'text-emerald-400', dot: 'bg-emerald-500' },
  { value: 'blocked', label: 'Blocked', icon: Pause, color: 'text-red-400', dot: 'bg-red-500' },
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'text-zinc-400', bg: 'bg-zinc-500/10' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  { value: 'high', label: 'High', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  { value: 'critical', label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/10' },
]

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

const REVIEW_AUTO_ACCEPT_DAYS = 3
const RISK_TERMS = /critical|kritisch|finance|geld|zahlung|rechnung|legal|vertrag|publish|veröffentlichen|posten|delete|löschen|security|credential|token|oauth|extern|kunde|client/i

function isRiskyReview(issue: Issue): boolean {
  if (issue.priority === 'critical') return true
  return RISK_TERMS.test([
    issue.title,
    issue.description,
    issue.project,
    issue.next_action,
    issue.acceptance_criteria,
    ...issue.labels,
  ].filter(Boolean).join('\n'))
}

function reviewAutoAcceptText(issue: Issue): string {
  if (isRiskyReview(issue)) return 'Kein Auto-Accept, weil diese Task als kritisch/riskant eingestuft ist.'
  const autoAcceptAt = new Date(new Date(issue.updated_at).getTime() + REVIEW_AUTO_ACCEPT_DAYS * 24 * 60 * 60 * 1000)
  return `Auto-Accept am ${formatDate(autoAcceptAt.toISOString())}, falls kein Feedback kommt.`
}

function WorkflowTextCard({
  title,
  empty,
  value,
  editing,
  editValue,
  onStartEdit,
  onChange,
  onSave,
  onCancel,
  tone = 'default',
}: {
  title: string
  empty: string
  value: string | null
  editing: boolean
  editValue: string
  onStartEdit: () => void
  onChange: (value: string) => void
  onSave: () => void
  onCancel: () => void
  tone?: 'default' | 'blocked'
}) {
  return (
    <div className={cn(
      'rounded-2xl shadow-sm dark:shadow-none border p-4',
      tone === 'blocked'
        ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/50'
        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
    )}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{title}</span>
        {!editing && (
          <button onClick={onStartEdit} className="text-[11px] text-zinc-500 hover:text-purple-400 transition-colors">
            Bearbeiten
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={editValue}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            className="w-full text-sm text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/30 resize-none"
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={onSave} className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100">Save</button>
            <button onClick={onCancel} className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 text-xs hover:bg-zinc-700">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={onStartEdit} className="w-full text-left">
          <p className={cn(
            'text-sm whitespace-pre-wrap leading-relaxed',
            value ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-500 italic'
          )}>
            {value || empty}
          </p>
        </button>
      )}
    </div>
  )
}

export default function IssueDetailPage() {
  const params = useParams()
  const router = useRouter()
  const issueId = params.id as string

  const [issue, setIssue] = useState<Issue | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'chat' | 'activity'>('chat')
  const [commentText, setCommentText] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [statusDropdown, setStatusDropdown] = useState(false)
  const [priorityDropdown, setPriorityDropdown] = useState(false)
  const [agentDropdown, setAgentDropdown] = useState(false)
  const [reviewerDropdown, setReviewerDropdown] = useState(false)
  const [moreMenu, setMoreMenu] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editingDesc, setEditingDesc] = useState(false)
  const [editDesc, setEditDesc] = useState('')
  const [editingNextAction, setEditingNextAction] = useState(false)
  const [editNextAction, setEditNextAction] = useState('')
  const [editingAcceptance, setEditingAcceptance] = useState(false)
  const [editAcceptance, setEditAcceptance] = useState('')
  const [editingBlocked, setEditingBlocked] = useState(false)
  const [editBlocked, setEditBlocked] = useState('')
  const [reviewFeedback, setReviewFeedback] = useState('')
  const [sendingReview, setSendingReview] = useState(false)
  const commentsEndRef = useRef<HTMLDivElement>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [issueRes, commentsRes, runsRes] = await Promise.all([
        authFetch(`/api/agents/issues/${issueId}`),
        authFetch(`/api/agents/issues/${issueId}/comments`),
        authFetch(`/api/agents/issues/${issueId}/runs`),
      ])
      const issueData = await issueRes.json()
      const commentsData = await commentsRes.json()
      const runsData = await runsRes.json()
      setIssue(issueData.issue || null)
      setComments(commentsData.comments || [])
      setRuns(runsData.runs || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [issueId])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    return onAgentEvent((event) => {
      if (event.type === 'issue_update' || event.type === 'run_update') {
        fetchAll()
      }
    })
  }, [fetchAll])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick() {
      setStatusDropdown(false)
      setPriorityDropdown(false)
      setAgentDropdown(false)
      setReviewerDropdown(false)
      setMoreMenu(false)
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  async function updateIssue(field: string, value: unknown) {
    if (!issue) return
    try {
      const res = await authFetch(`/api/agents/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      if (res.ok) {
        const data = await res.json()
        setIssue(data.issue)
      }
    } catch { /* ignore */ }
  }

  async function sendComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentText.trim() || sendingComment) return
    setSendingComment(true)

    try {
      await authFetch(`/api/agents/issues/${issueId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText.trim() }),
      })
      setCommentText('')
      fetchAll()
    } catch { /* ignore */ }
    finally { setSendingComment(false) }
  }

  async function deleteIssue() {
    if (!confirm('Task wirklich löschen?')) return
    try {
      await authFetch(`/api/agents/issues/${issueId}`, { method: 'DELETE' })
      router.push('/dashboard/agents/issues')
    } catch { /* ignore */ }
  }

  async function saveTitle() {
    if (!editTitle.trim() || !issue) return
    await updateIssue('title', editTitle.trim())
    setEditingTitle(false)
  }

  async function saveDesc() {
    if (!issue) return
    await updateIssue('description', editDesc.trim() || null)
    setEditingDesc(false)
  }

  async function saveNextAction() {
    if (!issue) return
    await updateIssue('next_action', editNextAction.trim() || null)
    setEditingNextAction(false)
  }

  async function saveAcceptance() {
    if (!issue) return
    await updateIssue('acceptance_criteria', editAcceptance.trim() || null)
    setEditingAcceptance(false)
  }

  async function saveBlockedReason() {
    if (!issue) return
    await updateIssue('blocked_reason', editBlocked.trim() || null)
    setEditingBlocked(false)
  }

  async function submitReview(action: 'accept' | 'revise' | 'block') {
    if (!issue || sendingReview) return
    setSendingReview(true)

    const feedback = reviewFeedback.trim()
    const headline = action === 'accept'
      ? 'Review akzeptiert'
      : action === 'revise'
        ? 'Review mit Feedback zur Nacharbeit'
        : 'Review blockiert'
    const nextStatus = action === 'accept' ? 'done' : action === 'revise' ? 'in_progress' : 'blocked'
    const content = [
      `${headline}: ${issue.issue_key} - ${issue.title}`,
      feedback ? `Feedback:\n${feedback}` : 'Kein zusätzliches Feedback.',
      '',
      action === 'accept'
        ? 'Outcome ist akzeptiert. Bitte als positives Signal für zukünftige Aufgaben berücksichtigen.'
        : action === 'revise'
          ? 'Bitte diese Aufgabe anhand des Feedbacks verbessern und erneut zur Review geben.'
          : 'Bitte nicht weiterarbeiten, bis der Blocker geklärt ist.',
    ].join('\n')

    try {
      await authFetch(`/api/agents/issues/${issueId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: 'review', content }),
      })

      if (issue.agent_name) {
        await authFetch('/api/agents/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent_name: issue.agent_name,
            content,
          }),
        })
      }

      await authFetch(`/api/agents/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'block'
          ? { status: nextStatus, blocked_reason: feedback || issue.blocked_reason || 'Review blockiert.' }
          : { status: nextStatus }),
      })

      setReviewFeedback('')
      fetchAll()
    } catch { /* ignore */ }
    finally { setSendingReview(false) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (!issue) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <AlertTriangle className="w-8 h-8 text-zinc-400" />
        <p className="text-sm text-zinc-400">Task nicht gefunden</p>
        <Link href="/dashboard/agents/issues" className="text-sm text-purple-400 hover:underline">
          Zurück zu Tasks
        </Link>
      </div>
    )
  }

  const liveRuns = runs.filter(r => r.status === 'running')
  const completedRuns = runs.filter(r => r.status !== 'running')
  const statusConfig = STATUS_OPTIONS.find(s => s.value === issue.status)
  const priorityConfig = PRIORITY_OPTIONS.find(p => p.value === issue.priority)
  const totalRunCost = runs.reduce((s, r) => s + (r.tokens_used || 0), 0)

  const activityItems = [
    ...runs.map(r => ({ type: 'run' as const, data: r, time: r.started_at })),
    ...comments.map(c => ({ type: 'comment' as const, data: c, time: c.created_at })),
  ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

  return (
    <div className="p-4 lg:p-6">
      {/* Breadcrumb + Actions */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Link
          href="/dashboard/agents/issues"
          className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
        </Link>
        <span className="text-xs text-zinc-500">Tasks</span>
        <span className="text-xs text-zinc-600">/</span>
        <span className="text-xs font-mono text-purple-400">{issue.issue_key}</span>
        {issue.archived && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 font-medium">
            Archiviert
          </span>
        )}
        {issue.project && (
          <>
            <span className="text-xs text-zinc-600">in</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{issue.project}</span>
          </>
        )}
        <div className="flex-1" />

        {/* Re-open / Re-assign */}
        {issue.status === 'done' && (
          <button
            onClick={() => updateIssue('status', 'todo')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Re-open
          </button>
        )}

        {/* More menu */}
        <div className="relative" ref={moreMenuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setMoreMenu(!moreMenu) }}
            className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {moreMenu && (
            <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => { navigator.clipboard.writeText(issue.issue_key); setMoreMenu(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" /> Copy Task Key
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(window.location.href); setMoreMenu(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Copy Link
              </button>
              <button
                onClick={async () => {
                  await authFetch(`/api/agents/issues/${issue.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ archived: !issue.archived }),
                  })
                  fetchAll()
                  setMoreMenu(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-400 hover:bg-amber-500/10 transition-colors"
              >
                {issue.archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                {issue.archived ? 'Wiederherstellen' : 'Archivieren'}
              </button>
              <div className="h-px bg-zinc-800" />
              <button
                onClick={deleteIssue}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Task
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-3 lg:gap-6">
        {/* Main Content */}
        <div className="space-y-4">
          {/* Title — click to edit */}
          {editingTitle ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
                className="flex-1 text-xl font-bold text-white bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                autoFocus
              />
              <button onClick={saveTitle} className="px-3 py-2 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100">Save</button>
              <button onClick={() => setEditingTitle(false)} className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-400 text-sm hover:bg-zinc-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <h1
              className="text-xl font-bold text-zinc-900 dark:text-white cursor-pointer hover:text-purple-400 transition-colors"
              onClick={() => { setEditTitle(issue.title); setEditingTitle(true) }}
            >
              {issue.title}
            </h1>
          )}

          {/* Description — click to edit */}
          {editingDesc ? (
            <div className="space-y-2">
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={5}
                className="w-full text-sm text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/30 resize-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={saveDesc} className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100">Save</button>
                <button onClick={() => setEditingDesc(false)} className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 text-xs hover:bg-zinc-700">Cancel</button>
              </div>
            </div>
          ) : (
            <div
              className="rounded-2xl bg-white dark:bg-zinc-900 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 p-4 cursor-pointer hover:border-zinc-600 transition-colors min-h-[60px]"
              onClick={() => { setEditDesc(issue.description || ''); setEditingDesc(true) }}
            >
              {issue.description ? (
                <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {issue.description}
                </p>
              ) : (
                <p className="text-sm text-zinc-500 italic">Add description...</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <WorkflowTextCard
              title="Next Action"
              empty="Naechsten konkreten Schritt festlegen..."
              value={issue.next_action}
              editing={editingNextAction}
              editValue={editNextAction}
              onStartEdit={() => { setEditNextAction(issue.next_action || ''); setEditingNextAction(true) }}
              onChange={setEditNextAction}
              onSave={saveNextAction}
              onCancel={() => setEditingNextAction(false)}
            />
            <WorkflowTextCard
              title="Akzeptanzkriterien"
              empty="Woran erkennen wir, dass diese Task fertig ist?"
              value={issue.acceptance_criteria}
              editing={editingAcceptance}
              editValue={editAcceptance}
              onStartEdit={() => { setEditAcceptance(issue.acceptance_criteria || ''); setEditingAcceptance(true) }}
              onChange={setEditAcceptance}
              onSave={saveAcceptance}
              onCancel={() => setEditingAcceptance(false)}
            />
          </div>

          {(issue.status === 'blocked' || issue.blocked_reason || editingBlocked) && (
            <WorkflowTextCard
              title="Blocker"
              empty="Was blockiert diese Task und welche Entscheidung wird gebraucht?"
              value={issue.blocked_reason}
              editing={editingBlocked}
              editValue={editBlocked}
              onStartEdit={() => { setEditBlocked(issue.blocked_reason || ''); setEditingBlocked(true) }}
              onChange={setEditBlocked}
              onSave={saveBlockedReason}
              onCancel={() => setEditingBlocked(false)}
              tone="blocked"
            />
          )}

          {/* Result */}
          {issue.result && (
            <div className={cn(
              'rounded-2xl shadow-sm p-4',
              issue.status === 'done'
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50'
                : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800'
            )}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className={cn('w-4 h-4', issue.status === 'done' ? 'text-emerald-500' : 'text-zinc-400')} />
                <span className={cn('text-xs font-semibold uppercase tracking-wider', issue.status === 'done' ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500')}>
                  Ergebnis
                </span>
              </div>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {issue.result}
              </p>
            </div>
          )}

          {issue.status === 'in_review' && (
            <div className="rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Eye className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">Needs Review</p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                    Prüfe Outcome und gib Feedback. Dein Feedback wird in der Task dokumentiert und in den Agent-Chat gepusht.
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                    {reviewAutoAcceptText(issue)}
                  </p>
                </div>
              </div>

              <textarea
                value={reviewFeedback}
                onChange={(e) => setReviewFeedback(e.target.value)}
                rows={3}
                placeholder="Feedback an den Agenten, Lob, Korrektur oder Blocker..."
                className="w-full text-sm text-zinc-900 dark:text-zinc-200 bg-white/80 dark:bg-zinc-900/80 border border-amber-200 dark:border-amber-800/50 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none"
              />

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => submitReview('accept')}
                  disabled={sendingReview}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-60 transition-colors"
                >
                  {sendingReview ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Akzeptieren
                </button>
                <button
                  onClick={() => submitReview('revise')}
                  disabled={sendingReview}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-60 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Nacharbeit
                </button>
                <button
                  onClick={() => submitReview('block')}
                  disabled={sendingReview}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-500 disabled:opacity-60 transition-colors"
                >
                  <Pause className="w-3.5 h-3.5" />
                  Blockieren
                </button>
              </div>
            </div>
          )}

          {/* Live Runs */}
          {liveRuns.length > 0 && (
            <div className="rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-semibold text-emerald-400">
                  Live Runs ({liveRuns.length})
                </span>
              </div>
              {liveRuns.map(run => (
                <div key={run.id} className="flex items-center gap-3 text-sm">
                  {AGENT_MAP[run.agent_name] && <AgentAvatar agent={AGENT_MAP[run.agent_name]} size="xs" />}
                  <span className="text-zinc-300 font-medium">{run.agent_name?.toUpperCase()}</span>
                  <span className="text-xs font-mono text-zinc-500">{run.run_id}</span>
                  <span className="text-xs text-zinc-500 ml-auto">{relativeTime(run.started_at)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div className="border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-1">
              {([
                { key: 'chat', label: 'Chat', icon: MessageSquare, count: comments.length },
                { key: 'activity', label: 'Activity', icon: Activity, count: activityItems.length },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors',
                    activeTab === tab.key
                      ? 'border-purple-500 text-purple-400'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {tab.count > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400">{tab.count}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <div className="space-y-3">
              {comments.length === 0 && (
                <p className="text-sm text-zinc-500 text-center py-8">Noch keine Kommentare</p>
              )}
              {comments.map(c => {
                const isAgent = !!AGENT_MAP[c.author]
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3"
                  >
                    <div className="flex-shrink-0 mt-1">
                      {isAgent && AGENT_MAP[c.author] ? (
                        <AgentAvatar agent={AGENT_MAP[c.author]} size="sm" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs text-zinc-300">
                          {c.author.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-zinc-200">
                          {AGENT_MAP[c.author]?.label || c.author}
                        </span>
                        <span className="text-[11px] text-zinc-600">{relativeTime(c.created_at)}</span>
                      </div>
                      <div className="rounded-xl bg-zinc-800/50 border border-zinc-700/50 px-4 py-3">
                        <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{c.content}</p>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
              <div ref={commentsEndRef} />

              <form onSubmit={sendComment} className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
                <button
                  type="submit"
                  disabled={!commentText.trim() || sendingComment}
                  className={cn(
                    'px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2',
                    commentText.trim()
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  )}
                >
                  {sendingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div className="space-y-1">
              {activityItems.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-8">Keine Aktivität</p>
              ) : (
                activityItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.02] transition-colors">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-600 flex-shrink-0" />
                    {item.type === 'run' ? (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          {AGENT_MAP[(item.data as Run).agent_name] && <AgentAvatar agent={AGENT_MAP[(item.data as Run).agent_name]} size="xs" />}
                          <span className="text-zinc-300 font-medium">{(item.data as Run).agent_name?.toUpperCase()}</span>
                          <span className={cn('text-xs font-medium', {
                            'text-emerald-400': (item.data as Run).status === 'succeeded',
                            'text-red-400': (item.data as Run).status === 'failed',
                            'text-blue-400': (item.data as Run).status === 'running',
                            'text-yellow-400': (item.data as Run).status === 'stopped',
                          })}>{(item.data as Run).status}</span>
                          {(item.data as Run).duration_seconds && (
                            <span className="text-xs text-zinc-500">{(item.data as Run).duration_seconds}s</span>
                          )}
                        </div>
                        {(item.data as Run).output && (
                          <pre className="mt-1 text-[11px] text-zinc-500 truncate max-w-lg">{(item.data as Run).output}</pre>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-zinc-400">{(item.data as Comment).author}</span>
                          <span className="text-zinc-600">commented</span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5 truncate">{(item.data as Comment).content}</p>
                      </div>
                    )}
                    <span className="text-[11px] text-zinc-600 flex-shrink-0 mt-0.5">{relativeTime(item.time)}</span>
                  </div>
                ))
              )}
            </div>
          )}

        </div>

        {/* Properties Sidebar */}
        <div className="space-y-3">
          {/* Properties Card */}
          <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Properties</span>
            </div>

            <div className="p-3 space-y-2">
              {/* Status */}
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500 w-16">Status</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setStatusDropdown(!statusDropdown); setPriorityDropdown(false); setAgentDropdown(false); setReviewerDropdown(false) }}
                    className={cn('flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium hover:bg-zinc-800 transition-colors', statusConfig?.color)}
                  >
                    <span className={cn('w-1.5 h-1.5 rounded-full', statusConfig?.dot)} />
                    {statusConfig?.label}
                    <ChevronDown className="w-3 h-3 text-zinc-500" />
                  </button>
                </div>
                {statusDropdown && (
                  <div className="absolute right-0 top-full mt-1 z-20 w-40 rounded-lg border border-zinc-700 bg-zinc-900 shadow-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                    {STATUS_OPTIONS.map(s => (
                      <button
                        key={s.value}
                        onClick={() => { updateIssue('status', s.value); setStatusDropdown(false) }}
                        className={cn('w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-zinc-800 transition-colors', s.color)}
                      >
                        <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Priority */}
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500 w-16">Priority</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setPriorityDropdown(!priorityDropdown); setStatusDropdown(false); setAgentDropdown(false); setReviewerDropdown(false) }}
                    className={cn('flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium hover:bg-zinc-800 transition-colors', priorityConfig?.color)}
                  >
                    {priorityConfig?.label}
                    <ChevronDown className="w-3 h-3 text-zinc-500" />
                  </button>
                </div>
                {priorityDropdown && (
                  <div className="absolute right-0 top-full mt-1 z-20 w-40 rounded-lg border border-zinc-700 bg-zinc-900 shadow-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                    {PRIORITY_OPTIONS.map(p => (
                      <button
                        key={p.value}
                        onClick={() => { updateIssue('priority', p.value); setPriorityDropdown(false) }}
                        className={cn('w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-zinc-800 transition-colors', p.color)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Due date */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-500 w-16">Due</span>
                <input
                  type="datetime-local"
                  value={issue.due_at ? new Date(issue.due_at).toISOString().slice(0, 16) : ''}
                  onChange={(e) => updateIssue('due_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
                  className="max-w-[150px] px-2 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 focus:outline-none"
                />
              </div>

              {/* Workspace */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-500 w-16">Workspace</span>
                <span className="text-xs text-zinc-400 truncate max-w-[150px]">{issue.project || 'None'}</span>
              </div>

              {/* Assignee */}
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500 w-16">Assignee</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setAgentDropdown(!agentDropdown); setStatusDropdown(false); setPriorityDropdown(false); setReviewerDropdown(false) }}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
                  >
                    {issue.agent_name && AGENT_MAP[issue.agent_name] && <AgentAvatar agent={AGENT_MAP[issue.agent_name]} size="xs" />}
                    {issue.agent_name ? issue.agent_name.toUpperCase() : 'None'}
                    <ChevronDown className="w-3 h-3 text-zinc-500" />
                  </button>
                </div>
                {agentDropdown && (
                  <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-lg border border-zinc-700 bg-zinc-900 shadow-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => { updateIssue('agent_name', null); setAgentDropdown(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-800"
                    >
                      None
                    </button>
                    {Object.entries(AGENT_MAP).map(([name, meta]) => (
                      <button
                        key={name}
                        onClick={() => { updateIssue('agent_name', name); setAgentDropdown(false) }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
                      >
                        <AgentAvatar agent={meta} size="xs" /> {meta.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Reviewer */}
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500 w-16">Reviewer</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setReviewerDropdown(!reviewerDropdown); setStatusDropdown(false); setPriorityDropdown(false); setAgentDropdown(false) }}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
                  >
                    {issue.reviewer_agent && AGENT_MAP[issue.reviewer_agent] && <AgentAvatar agent={AGENT_MAP[issue.reviewer_agent]} size="xs" />}
                    {issue.reviewer_agent ? issue.reviewer_agent.toUpperCase() : 'None'}
                    <ChevronDown className="w-3 h-3 text-zinc-500" />
                  </button>
                </div>
                {reviewerDropdown && (
                  <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-lg border border-zinc-700 bg-zinc-900 shadow-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => { updateIssue('reviewer_agent', null); setReviewerDropdown(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-800"
                    >
                      None
                    </button>
                    {Object.entries(AGENT_MAP).map(([name, meta]) => (
                      <button
                        key={name}
                        onClick={() => { updateIssue('reviewer_agent', name); setReviewerDropdown(false) }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
                      >
                        <AgentAvatar agent={meta} size="xs" /> {meta.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Labels */}
              {issue.labels.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500 w-16">Labels</span>
                  <div className="flex flex-wrap gap-1">
                    {issue.labels.map(l => (
                      <span key={l} className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400">
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(issue.source_type || issue.source_id) && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500 w-16">Source</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono truncate max-w-[150px]">
                    {issue.source_type || 'manual'}{issue.source_id ? `:${issue.source_id}` : ''}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Timestamps */}
          <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 p-3 space-y-1.5">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-zinc-500">Erstellt von</span>
              <div className="flex items-center gap-1.5">
                {AGENT_MAP[issue.created_by] ? (
                  <>
                    <AgentAvatar agent={AGENT_MAP[issue.created_by]} size="xs" />
                    <span className="text-zinc-400 font-medium">{AGENT_MAP[issue.created_by].label}</span>
                  </>
                ) : (
                  <span className="text-zinc-400 font-medium">{issue.created_by}</span>
                )}
              </div>
            </div>
            <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />
            <div className="flex justify-between text-[11px]">
              <span className="text-zinc-500">Created</span>
              <span className="text-zinc-400">{formatDate(issue.created_at)}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-zinc-500">Updated</span>
              <span className="text-zinc-400">{formatDate(issue.updated_at)}</span>
            </div>
            {issue.started_at && (
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-500">Started</span>
                <span className="text-zinc-400">{formatDate(issue.started_at)}</span>
              </div>
            )}
            {issue.completed_at && (
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-500">Completed</span>
                <span className="text-zinc-400">{formatDate(issue.completed_at)}</span>
              </div>
            )}
          </div>

          {/* Runs Summary */}
          {completedRuns.length > 0 && (
            <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 overflow-hidden">
              <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Runs ({runs.length})</span>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
                {completedRuns.slice(0, 5).map(run => (
                  <div key={run.id} className="px-3 py-2 flex items-center gap-2">
                    <span className={cn('w-1.5 h-1.5 rounded-full', {
                      'bg-emerald-500': run.status === 'succeeded',
                      'bg-red-500': run.status === 'failed',
                      'bg-yellow-500': run.status === 'stopped',
                    })} />
                    <span className="text-[11px] font-mono text-zinc-500 truncate flex-1">{run.run_id}</span>
                    {run.duration_seconds && (
                      <span className="text-[10px] text-zinc-500">{run.duration_seconds}s</span>
                    )}
                  </div>
                ))}
              </div>
              {totalRunCost > 0 && (
                <div className="px-3 py-2 border-t border-zinc-800 flex justify-between text-[11px]">
                  <span className="text-zinc-500">Total Tokens</span>
                  <span className="text-zinc-400 font-mono">{totalRunCost.toLocaleString()}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
