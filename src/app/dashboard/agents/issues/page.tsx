'use client'

import { Suspense, useState, useEffect, useCallback, useRef, memo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { authFetch } from '@/lib/auth-fetch'
import { AGENT_MAP } from '@/lib/agents-meta'
import AgentAvatar from '@/components/ui/AgentAvatar'
import { PageHeader } from '@/components/ui/mana-hub'
import { cn } from '@/lib/utils'
import { onAgentEvent } from '@/lib/notifications/NotificationContext'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Plus, Loader2, Circle,
  CheckCircle2, Clock, Pause, X,
  ChevronRight, Eye,
  Sparkles, Send, Wand2, ArrowRight,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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
  due_at: string | null
  acceptance_criteria: string | null
  next_action: string | null
  blocked_reason: string | null
  source_type: 'manual' | 'chat' | 'briefing' | 'automation' | null
  source_id: string | null
  created_by: string
  created_at: string
  updated_at: string
  completed_at: string | null
  archived?: boolean
}

interface Project {
  slug: string
  name: string
  status: string
}

const STATUS_CONFIG = {
  in_progress: { label: 'Active', icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', dot: 'bg-blue-500' },
  todo: { label: 'Todo', icon: Circle, color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20', dot: 'bg-zinc-500' },
  in_review: { label: 'Review', icon: Eye, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', dot: 'bg-amber-500' },
  blocked: { label: 'Blocked', icon: Pause, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', dot: 'bg-red-500' },
  done: { label: 'Done', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
}

const PRIORITY_CONFIG = {
  critical: { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/10' },
  high: { label: 'High', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  medium: { label: 'Med', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  low: { label: 'Low', color: 'text-zinc-400', bg: 'bg-zinc-500/10' },
}

const WORKFLOW_TABS = [
  { key: 'all', label: 'Alle' },
  { key: 'active', label: 'Active' },
  { key: 'review', label: 'Review' },
  { key: 'todo', label: 'Todo' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'done', label: 'Done' },
] as const

type WorkflowTab = typeof WORKFLOW_TABS[number]['key']

function taskMatchesWorkflow(issue: Issue, tab: WorkflowTab): boolean {
  if (tab === 'active') return issue.status === 'in_progress'
  if (tab === 'review') return issue.status === 'in_review'
  if (tab === 'todo') return issue.status === 'todo'
  if (tab === 'blocked') return issue.status === 'blocked'
  if (tab === 'done') return issue.status === 'done'
  if (tab === 'all') return true
  return true
}

const StreamingMarkdown = memo(function StreamingMarkdown({ text }: { text: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
})

function IssuesPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [issues, setIssues] = useState<Issue[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewIssue, setShowNewIssue] = useState(false)

  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setShowNewIssue(true)
      router.replace('/dashboard/agents/issues', { scroll: false })
    }
  }, [searchParams, router])
  const [workflowTab, setWorkflowTab] = useState<WorkflowTab>('all')

  // New issue form
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newStatus, setNewStatus] = useState<'todo' | 'in_progress'>('todo')
  const [newPriority, setNewPriority] = useState('medium')
  const [newAgent, setNewAgent] = useState('')
  const [newReviewer, setNewReviewer] = useState('')
  const [newProject, setNewProject] = useState('')
  const [newDueAt, setNewDueAt] = useState('')
  const [newAcceptance, setNewAcceptance] = useState('')
  const [newNextAction, setNewNextAction] = useState('')
  const [creating, setCreating] = useState(false)

  // AI Plan Mode
  const [planMode, setPlanMode] = useState(false)
  const [planMessages, setPlanMessages] = useState<{role: 'user' | 'assistant'; content: string}[]>([])
  const [planInput, setPlanInput] = useState('')
  const [planModel, setPlanModel] = useState<'sonnet' | 'opus'>('sonnet')
  const [isPlanning, setIsPlanning] = useState(false)
  const [planFinalized, setPlanFinalized] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const planChatRef = useRef<HTMLDivElement>(null)
  const planAbortRef = useRef<AbortController | null>(null)

  const MAX_PLAN_MESSAGES = 30
  const MAX_MESSAGE_LENGTH = 5000

  const scrollPlanToBottom = useCallback(() => {
    if (planChatRef.current) {
      planChatRef.current.scrollTop = planChatRef.current.scrollHeight
    }
  }, [])

  const sendPlanMessage = useCallback(async (userMessage: string, finalize = false) => {
    if (isPlanning) return
    setIsPlanning(true)
    setStreamingText('')

    const msgs = finalize
      ? [...planMessages, { role: 'user' as const, content: 'Finalisiere den Plan jetzt als strukturierte Task.' }]
      : [...planMessages, { role: 'user' as const, content: userMessage }]

    if (!finalize) {
      setPlanMessages(msgs)
      setPlanInput('')
    }

    setTimeout(scrollPlanToBottom, 50)

    try {
      planAbortRef.current = new AbortController()
      const res = await authFetch('/api/agents/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: msgs,
          model: planModel,
          finalize,
        }),
        signal: planAbortRef.current.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }))
        setPlanMessages(prev => [...prev, { role: 'assistant', content: `Fehler: ${err.error || 'AI nicht erreichbar'}` }])
        setIsPlanning(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) { setIsPlanning(false); return }

      const decoder = new TextDecoder()
      let accumulated = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const parsed = JSON.parse(line.slice(6))
            if (parsed.type === 'text') {
              accumulated += parsed.text
              setStreamingText(accumulated)
              scrollPlanToBottom()
            } else if (parsed.type === 'error') {
              accumulated += `\n\n_Fehler: ${parsed.error}_`
            }
          } catch { /* skip malformed SSE */ }
        }
      }

      if (finalize) {
        try {
          const jsonMatch = accumulated.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0])
            setNewTitle(result.title || '')
            const desc = result.description || ''
            const subtasks = result.subtasks?.length
              ? '\n\n## Sub-Tasks\n' + result.subtasks.map((s: string) => `- [ ] ${s}`).join('\n')
              : ''
            setNewDesc(desc + subtasks)
            setPlanFinalized(true)
            setPlanMessages(prev => [...prev, { role: 'assistant', content: 'Plan finalisiert. Titel und Beschreibung wurden ausgefuellt. Pruefe alles und klicke "Create Task".' }])
          } else {
            setPlanMessages(prev => [...prev, { role: 'assistant', content: accumulated }])
          }
        } catch {
          setPlanMessages(prev => [...prev, { role: 'assistant', content: accumulated }])
        }
      } else {
        setPlanMessages(prev => [...prev, { role: 'assistant', content: accumulated }])
      }

      setStreamingText('')
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setPlanMessages(prev => [...prev, { role: 'assistant', content: 'Verbindung zur AI unterbrochen. Versuche es nochmal.' }])
      }
    } finally {
      setIsPlanning(false)
      planAbortRef.current = null
      setTimeout(scrollPlanToBottom, 50)
    }
  }, [planMessages, planModel, isPlanning, scrollPlanToBottom])

  function resetPlanMode() {
    planAbortRef.current?.abort()
    setPlanMode(false)
    setPlanMessages([])
    setPlanInput('')
    setStreamingText('')
    setIsPlanning(false)
    setPlanFinalized(false)
  }

  const fetchIssues = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.set('archived', 'false')
      const qs = params.toString()
      const res = await authFetch(`/api/agents/issues${qs ? '?' + qs : ''}`)
      const data = await res.json()
      setIssues(data.issues || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchIssues() }, [fetchIssues])

  useEffect(() => {
    authFetch('/api/agents/projects?status=active')
      .then(res => res.json())
      .then(data => setProjects(data.projects || []))
      .catch(() => setProjects([]))
  }, [])

  useEffect(() => {
    return onAgentEvent((event) => {
      if (event.type === 'issue_update' || event.type === 'run_update') {
        fetchIssues()
      }
    })
  }, [fetchIssues])

  async function createIssue(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim() || creating) return
    setCreating(true)

    try {
      const issueBody: Record<string, unknown> = {
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        status: newStatus,
        priority: newPriority,
        agent_name: newAgent || null,
        reviewer_agent: newReviewer || null,
        project: newProject || null,
        due_at: newDueAt ? new Date(newDueAt).toISOString() : null,
        acceptance_criteria: newAcceptance.trim() || null,
        next_action: newNextAction.trim() || null,
        source_type: 'manual',
      }

      if (planMessages.length > 0) {
        issueBody.planning_context = {
          messages: planMessages,
          model: planModel,
          finalized_at: new Date().toISOString(),
        }
      }

      const res = await authFetch('/api/agents/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(issueBody),
      })
      if (res.ok) {
        setNewTitle('')
        setNewDesc('')
        setNewStatus('todo')
        setNewPriority('medium')
        setNewAgent('')
        setNewReviewer('')
        setNewProject('')
        setNewDueAt('')
        setNewAcceptance('')
        setNewNextAction('')
        setShowNewIssue(false)
        resetPlanMode()
        fetchIssues()
      }
    } catch { /* ignore */ }
    finally { setCreating(false) }
  }

  const openIssue = useCallback((id: string) => {
    router.push(`/dashboard/agents/issues/${id}`)
  }, [router])

  const filtered = issues.filter(i => taskMatchesWorkflow(i, workflowTab))

  const workflowCounts = WORKFLOW_TABS.reduce((acc, tab) => {
    acc[tab.key] = issues.filter(issue => taskMatchesWorkflow(issue, tab.key)).length
    return acc
  }, {} as Record<WorkflowTab, number>)

  const sortedTasks = filtered

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="ARBEIT"
        title="Tasks"
        description="Alles was deine Agents aktuell tun, draften oder zur Review zurückgeben."
        actions={
          <button onClick={() => setShowNewIssue(true)} className="btn btn-primary btn-sm" type="button">
            <Plus className="w-3.5 h-3.5" /> Neuer Task
          </button>
        }
      />

      <div style={{ padding: '4px 28px 0' }}>
        <div className="tabs">
          {WORKFLOW_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setWorkflowTab(tab.key)}
              className={cn('tab', workflowTab === tab.key && 'active')}
            >
              {tab.label}
              <span style={{ color: 'var(--fg-faint)', marginLeft: 4 }}>{workflowCounts[tab.key]}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '20px 28px 28px' }}>
        {sortedTasks.length === 0 ? (
          <div className="card card-pad text-center">
            <p className="text-sm font-medium text-[var(--fg)]">Keine Tasks in diesem Bereich</p>
            <p className="mt-1 text-xs text-[var(--fg-muted)]">
              {workflowTab === 'all'
                ? 'Noch keine Tasks vorhanden.'
                : 'Wechsle den Bereich oder erstelle eine neue Task.'}
            </p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>ID</th>
                  <th>Task</th>
                  <th style={{ width: 130 }}>Agent</th>
                  <th style={{ width: 110 }}>Workspace</th>
                  <th style={{ width: 90 }}>Priorität</th>
                  <th style={{ width: 100 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedTasks.map(issue => {
                  const agent = issue.agent_name ? AGENT_MAP[issue.agent_name] : null
                  const statusConfig = STATUS_CONFIG[issue.status]
                  const prioConfig = PRIORITY_CONFIG[issue.priority]
                  return (
                    <tr key={issue.id} className="cursor-pointer" onClick={() => openIssue(issue.id)}>
                      <td className="mono" style={{ color: 'var(--fg-faint)', fontSize: 11.5 }}>{issue.issue_key}</td>
                      <td style={{ fontWeight: 500 }}>{issue.title}</td>
                      <td>
                        {agent ? <span className="row gap-2"><AgentAvatar agent={agent} size="xs" /> {agent.label}</span> : <span className="faint">Unassigned</span>}
                      </td>
                      <td style={{ color: 'var(--fg-muted)' }}>{issue.project || <span className="faint">-</span>}</td>
                      <td><span className="badge" style={{ height: 18, fontSize: 10.5 }}>{prioConfig.label}</span></td>
                      <td><span className={cn('badge', issue.status === 'done' && 'badge-ok', issue.status === 'in_progress' && 'badge-info', issue.status === 'in_review' && 'badge-warn', issue.status === 'blocked' && 'badge-err')}>{statusConfig.label}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Issue Modal — Paperclip Style + AI Plan Mode */}
      <AnimatePresence>
        {showNewIssue && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => { setShowNewIssue(false); resetPlanMode() }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={cn(
                'w-full rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden flex flex-col',
                planMode ? 'max-w-2xl max-h-[85vh]' : 'max-w-xl'
              )}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 flex-shrink-0">
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[11px] font-bold text-zinc-300">JM</span>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-white font-medium">New Task</span>
                  {planMode && (
                    <>
                      <ChevronRight className="w-3 h-3" />
                      <span className="flex items-center gap-1 text-purple-400 font-medium">
                        <Sparkles className="w-3 h-3" />
                        AI Plan
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {planMode && (
                    <button
                      type="button"
                      onClick={() => setPlanModel(planModel === 'sonnet' ? 'opus' : 'sonnet')}
                      className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors mr-1',
                        planModel === 'opus'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
                      )}
                      title={planModel === 'opus' ? 'Opus 4.6 — Deep Planning' : 'Sonnet 4 — Fast Planning'}
                    >
                      {planModel === 'opus' ? 'OPUS' : 'SONNET'}
                    </button>
                  )}
                  <button onClick={() => { setShowNewIssue(false); resetPlanMode() }} className="p-1 rounded hover:bg-zinc-800 text-zinc-500 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <form onSubmit={createIssue} className="flex flex-col flex-1 min-h-0">
                {/* Title */}
                <div className="px-5 pt-4 flex-shrink-0">
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder={planFinalized ? 'Task title (AI-generated)' : 'Task title'}
                    className={cn(
                      'w-full text-lg font-medium placeholder-zinc-600 bg-transparent focus:outline-none',
                      planFinalized ? 'text-purple-300' : 'text-white'
                    )}
                    autoFocus={!planMode}
                  />
                </div>

                {/* For [Assignee] in [Workspace] */}
                <div className="px-5 py-2 flex items-center gap-2 text-sm flex-shrink-0">
                  <span className="text-zinc-500">For</span>
                  <select
                    value={newAgent}
                    onChange={(e) => setNewAgent(e.target.value)}
                    className="px-2 py-1 rounded-md border border-zinc-700 bg-zinc-800 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-purple-500/40"
                  >
                    <option value="">Assignee</option>
                    {Object.entries(AGENT_MAP).map(([name, meta]) => (
                      <option key={name} value={name}>{meta.label}</option>
                    ))}
                  </select>
                  <span className="text-zinc-500">in</span>
                  <select
                    value={newProject}
                    onChange={(e) => setNewProject(e.target.value)}
                    className="px-2 py-1 rounded-md border border-zinc-700 bg-zinc-800 text-sm text-zinc-400 focus:outline-none focus:ring-1 focus:ring-purple-500/40"
                  >
                    <option value="">Workspace</option>
                    {projects.map(project => (
                      <option key={project.slug} value={project.slug}>{project.name}</option>
                    ))}
                  </select>
                </div>

                {/* Reviewer (optional) */}
                <div className="px-5 flex items-center gap-2 text-sm pb-1 flex-shrink-0">
                  <span className="text-zinc-600">Review by</span>
                  <select
                    value={newReviewer}
                    onChange={(e) => setNewReviewer(e.target.value)}
                    className="px-2 py-1 rounded-md border border-zinc-700 bg-zinc-800 text-sm text-zinc-400 focus:outline-none focus:ring-1 focus:ring-purple-500/40"
                  >
                    <option value="">None</option>
                    {Object.entries(AGENT_MAP).map(([name, meta]) => (
                      <option key={name} value={name}>{meta.label}</option>
                    ))}
                  </select>
                </div>

                <div className="px-5 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2 flex-shrink-0">
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Deadline</span>
                    <input
                      type="datetime-local"
                      value={newDueAt}
                      onChange={(e) => setNewDueAt(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-md border border-zinc-700 bg-zinc-800 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-purple-500/40"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Next Action</span>
                    <input
                      value={newNextAction}
                      onChange={(e) => setNewNextAction(e.target.value)}
                      placeholder="Naechster konkreter Schritt"
                      className="w-full px-2 py-1.5 rounded-md border border-zinc-700 bg-zinc-800 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500/40"
                    />
                  </label>
                </div>

                {/* Description / AI Plan Area */}
                <div className="border-t border-zinc-800/50 flex-1 min-h-0 flex flex-col">
                  {/* Mode Toggle */}
                  <div className="px-5 pt-2 pb-1 flex items-center justify-between flex-shrink-0">
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                      {planMode ? `AI Planning ${planMessages.filter(m => m.role === 'user').length}/${MAX_PLAN_MESSAGES / 2}` : 'Description'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (planMode) { resetPlanMode() } else { setPlanMode(true) }
                      }}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all',
                        planMode
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 border border-zinc-700/50'
                      )}
                    >
                      <Sparkles className="w-3 h-3" />
                      {planMode ? 'Exit Drafting' : 'Draft with AI'}
                    </button>
                  </div>

                  {!planMode ? (
                    /* Manual Description */
                    <div className="px-5 flex-1 space-y-3">
                      <textarea
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        placeholder="Add description..."
                        rows={6}
                        className="w-full py-2 text-sm text-zinc-300 placeholder-zinc-600 bg-transparent focus:outline-none resize-none"
                      />
                      <textarea
                        value={newAcceptance}
                        onChange={(e) => setNewAcceptance(e.target.value)}
                        placeholder="Akzeptanzkriterien: Woran erkennen wir, dass diese Task fertig ist?"
                        rows={4}
                        className="w-full px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 bg-zinc-800/50 rounded-xl border border-zinc-700/50 focus:outline-none resize-none"
                      />
                    </div>
                  ) : (
                    /* AI Plan Chat */
                    <div className="flex flex-col flex-1 min-h-0">
                      {/* Chat Messages */}
                      <div ref={planChatRef} className="flex-1 min-h-0 overflow-y-auto px-5 py-3 space-y-3">
                        {planMessages.length === 0 && !isPlanning && (
                          <div className="text-center py-8">
                            <Wand2 className="w-8 h-8 text-purple-500/40 mx-auto mb-3" />
                            <p className="text-sm text-zinc-500 mb-1">Beschreibe deine Idee</p>
                            <p className="text-xs text-zinc-600">Die AI hilft dir, eine perfekte Task daraus zu formen.</p>
                          </div>
                        )}

                        {planMessages.map((msg, i) => (
                          <div key={i} className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                            {msg.role === 'assistant' && (
                              <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Sparkles className="w-3 h-3 text-purple-400" />
                              </div>
                            )}
                            <div className={cn(
                              'max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm',
                              msg.role === 'user'
                                ? 'bg-zinc-700/60 text-zinc-200'
                                : 'bg-zinc-800/60 text-zinc-300'
                            )}>
                              {msg.role === 'assistant' ? (
                                <div className="prose prose-invert prose-sm max-w-none [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_ul]:mb-1.5 [&_li]:mb-0.5">
                                  <StreamingMarkdown text={msg.content} />
                                </div>
                              ) : (
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                              )}
                            </div>
                          </div>
                        ))}

                        {/* Streaming indicator */}
                        {isPlanning && (
                          <div className="flex gap-2 justify-start">
                            <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Sparkles className="w-3 h-3 text-purple-400 animate-pulse" />
                            </div>
                            <div className="max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm bg-zinc-800/60 text-zinc-300">
                              {streamingText ? (
                                <div className="prose prose-invert prose-sm max-w-none [&_p]:mb-1.5 [&_p:last-child]:mb-0">
                                  <StreamingMarkdown text={streamingText} />
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <div className="flex gap-0.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce [animation-delay:0ms]" />
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce [animation-delay:150ms]" />
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce [animation-delay:300ms]" />
                                  </div>
                                  <span className="text-zinc-500 text-xs ml-1">denkt nach...</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Plan Input */}
                      <div className="px-4 pb-3 pt-2 border-t border-zinc-800/50 flex-shrink-0">
                        <div className="flex items-end gap-2">
                          <textarea
                            value={planInput}
                            onChange={(e) => {
                              if (e.target.value.length <= MAX_MESSAGE_LENGTH) setPlanInput(e.target.value)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                if (planInput.trim() && !isPlanning && planMessages.length < MAX_PLAN_MESSAGES) {
                                  sendPlanMessage(planInput.trim())
                                }
                              }
                            }}
                            placeholder={planMessages.length === 0 ? 'Beschreibe deine Idee...' : 'Antwort schreiben...'}
                            rows={1}
                            disabled={isPlanning || planFinalized}
                            className="flex-1 py-2 px-3 text-sm text-zinc-300 placeholder-zinc-600 bg-zinc-800/60 rounded-xl border border-zinc-700/50 focus:outline-none focus:border-zinc-600 resize-none disabled:opacity-50"
                            style={{ outline: 'none' }}
                          />
                          <button
                            type="button"
                            disabled={!planInput.trim() || isPlanning || planFinalized || planMessages.length >= MAX_PLAN_MESSAGES}
                            onClick={() => {
                              if (planInput.trim()) sendPlanMessage(planInput.trim())
                            }}
                            className="p-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-30 disabled:hover:bg-purple-600 transition-colors flex-shrink-0"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                        {/* Finalize Button */}
                        {planMessages.filter(m => m.role === 'assistant').length >= 1 && !planFinalized && !isPlanning && (
                          <button
                            type="button"
                            onClick={() => sendPlanMessage('', true)}
                            className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-400 text-sm font-medium hover:bg-purple-500/20 transition-colors"
                          >
                            <Wand2 className="w-3.5 h-3.5" />
                            Finalize Task Draft
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Bar */}
                <div className="px-5 py-3 border-t border-zinc-800 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as 'todo' | 'in_progress')}
                      className="px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-xs font-medium text-zinc-300 focus:outline-none"
                    >
                      <option value="todo">Todo</option>
                      <option value="in_progress">In Progress</option>
                    </select>

                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-xs font-medium text-zinc-300 focus:outline-none"
                    >
                      <option value="low">Low</option>
                      <option value="medium">-- Priority</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => { setNewTitle(''); setNewDesc(''); setShowNewIssue(false); resetPlanMode() }}
                      className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                      Discard Draft
                    </button>
                    <button
                      type="submit"
                      disabled={!newTitle.trim() || creating}
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors flex items-center gap-2',
                        planFinalized
                          ? 'bg-purple-600 text-white hover:bg-purple-700'
                          : 'bg-white text-zinc-900 hover:bg-zinc-200'
                      )}
                    >
                      {creating ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating...</>
                      ) : planFinalized ? (
                        <><ArrowRight className="w-3.5 h-3.5" /> Create Task</>
                      ) : (
                        'Create Task'
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function IssuesPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    }>
      <IssuesPageContent />
    </Suspense>
  )
}
