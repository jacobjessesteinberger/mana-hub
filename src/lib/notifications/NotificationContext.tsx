'use client'

import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase/client'
import { authFetch } from '@/lib/auth-fetch'
import { usePageVisible } from '@/hooks/usePageVisible'
import { AGENTS } from '@/lib/agents-meta'

export interface Heartbeat {
  agent_name?: string
  status: 'online' | 'idle' | 'busy' | 'offline' | 'error'
  session_uptime_minutes: number | null
  context_usage_percent: number | null
  tokens_used_today: number | null
  last_compaction_at: string | null
  current_task: string | null
  created_at: string
}

interface NotificationState {
  counts: Record<string, number>
  increment: (agentName: string) => void
  clear: (agentName: string) => void
  totalCount: number
  openIssueCount: number
  pendingApprovalCount: number
  routineErrorCount: number
  heartbeats: Record<string, Heartbeat | null>
  refreshHeartbeats: () => void
}

const NotificationContext = createContext<NotificationState | undefined>(undefined)

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be inside NotificationProvider')
  return ctx
}

export interface AgentEvent {
  type: 'message' | 'issue_update' | 'run_update'
  agentName: string
  data: Record<string, unknown>
}

type EventListener = (event: AgentEvent) => void

let globalListeners: EventListener[] = []

export function onAgentEvent(fn: EventListener) {
  globalListeners.push(fn)
  return () => { globalListeners = globalListeners.filter(l => l !== fn) }
}

function emit(event: AgentEvent) {
  globalListeners.forEach(fn => fn(event))
}

const ISSUE_POLL_INTERVAL = 30_000
const HEARTBEAT_INTERVAL = 30_000
const APPROVAL_INTERVAL = 30_000
const ROUTINE_INTERVAL = 60_000
const AGENTS_TO_POLL = AGENTS.map(agent => agent.name)
const OPEN_ISSUE_STATUSES = new Set(['todo', 'in_progress', 'in_review', 'blocked'])
const isDemoMode = process.env.NEXT_PUBLIC_MANA_HUB_DEMO_MODE === 'true'

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [openIssueCount, setOpenIssueCount] = useState(0)
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0)
  const [routineErrorCount, setRoutineErrorCount] = useState(0)
  const [heartbeats, setHeartbeats] = useState<Record<string, Heartbeat | null>>({})
  const lastMessageTs = useRef<Record<string, string>>({})
  const lastIssueSnapshot = useRef<string>('')
  const initialized = useRef(false)
  const visible = usePageVisible()

  const increment = useCallback((agentName: string) => {
    setCounts(prev => ({ ...prev, [agentName]: (prev[agentName] || 0) + 1 }))
  }, [])

  const clear = useCallback((agentName: string) => {
    setCounts(prev => {
      const next = { ...prev }
      delete next[agentName]
      return next
    })
  }, [])

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0)

  const pollIssues = useCallback(async () => {
    try {
      const res = await authFetch(`/api/agents/issues?limit=50&_t=${Date.now()}`)
      const data = await res.json()
      const issues: Array<{ id?: string; status?: string; agent_name?: string; archived?: boolean }> = data.issues || []

      const openCount = issues.filter(i => i.archived !== true && i.status && OPEN_ISSUE_STATUSES.has(i.status)).length
      setOpenIssueCount(openCount)

      const snapshot = issues.map(i => `${i.id}:${i.status}`).join(',')
      if (lastIssueSnapshot.current && lastIssueSnapshot.current !== snapshot) {
        const latest = issues[0]
        if (latest) {
          emit({ type: 'issue_update', agentName: latest.agent_name || '', data: latest })
        }
      }
      lastIssueSnapshot.current = snapshot
    } catch { /* ignore */ }
  }, [])

  const pollApprovals = useCallback(async () => {
    try {
      const res = await authFetch(`/api/agents/approvals?status=pending&_t=${Date.now()}`)
      const data = await res.json()
      const approvals: Record<string, unknown>[] = data.approvals || []
      setPendingApprovalCount(approvals.length)
    } catch { /* ignore */ }
  }, [])

  const pollRoutines = useCallback(async () => {
    try {
      const res = await authFetch(`/api/agents/monitoring?_t=${Date.now()}`)
      const data = await res.json()
      const jobs = data.cron_jobs || []
      const errored = jobs.filter((j: Record<string, unknown>) => j.enabled && j.last_status === 'error').length
      setRoutineErrorCount(errored)
    } catch { /* ignore */ }
  }, [])

  const refreshHeartbeats = useCallback(async () => {
    try {
      const res = await authFetch(`/api/agents/heartbeats?_t=${Date.now()}`)
      const data = await res.json()
      const list: Heartbeat[] = data.heartbeats || []
      const map: Record<string, Heartbeat | null> = {}
      for (const hb of list) {
        if (hb.agent_name) map[hb.agent_name] = hb
      }
      setHeartbeats(map)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void Promise.all([
        pollIssues(),
        pollApprovals(),
        pollRoutines(),
        refreshHeartbeats(),
      ])
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [pollIssues, pollApprovals, pollRoutines, refreshHeartbeats])

  useEffect(() => {
    if (!visible) return
    const issueInterval = setInterval(pollIssues, ISSUE_POLL_INTERVAL)
    const approvalInterval = setInterval(pollApprovals, APPROVAL_INTERVAL)
    const routineInterval = setInterval(pollRoutines, ROUTINE_INTERVAL)
    const heartbeatInterval = setInterval(refreshHeartbeats, HEARTBEAT_INTERVAL)
    return () => {
      clearInterval(issueInterval)
      clearInterval(approvalInterval)
      clearInterval(routineInterval)
      clearInterval(heartbeatInterval)
    }
  }, [visible, pollIssues, pollApprovals, pollRoutines, refreshHeartbeats])

  useEffect(() => {
    if (isDemoMode) {
      initialized.current = true
      return
    }

    const channel = supabase
      .channel('notification-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues' }, () => {
        pollIssues()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'approvals' }, () => {
        pollApprovals()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issue_runs' }, () => {
        emit({ type: 'run_update', agentName: '', data: {} })
        pollIssues()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_messages' }, (payload) => {
        const msg = payload.new as { agent_name?: string; role?: string; created_at?: string }
        if (!msg.agent_name || msg.role !== 'assistant') return
        if (!AGENTS_TO_POLL.includes(msg.agent_name)) return

        const prevTs = lastMessageTs.current[msg.agent_name]
        if (prevTs === msg.created_at) return
        lastMessageTs.current[msg.agent_name] = msg.created_at || ''

        if (initialized.current) {
          increment(msg.agent_name)
          emit({ type: 'message', agentName: msg.agent_name, data: msg as Record<string, unknown> })
        }
      })
      .subscribe()

    initialized.current = true

    return () => { supabase.removeChannel(channel) }
  }, [pollIssues, pollApprovals, increment])

  return (
    <NotificationContext.Provider value={{
      counts, increment, clear, totalCount,
      openIssueCount, pendingApprovalCount, routineErrorCount,
      heartbeats, refreshHeartbeats,
    }}>
      {children}
    </NotificationContext.Provider>
  )
}
