'use client'

import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { usePageVisible } from '@/hooks/usePageVisible'
import { AGENT_MAP } from '@/lib/agents-meta'
import AgentAvatar from '@/components/ui/AgentAvatar'
import { cn } from '@/lib/utils'
import {
  Loader2, RefreshCw, AlertTriangle, CheckCircle2,
  Clock, Cpu, Shield, Activity, ChevronDown, ChevronUp
} from 'lucide-react'

interface AgentHealth {
  id: string
  name: string
  emoji: string
  role: string
  department_color: string
  is_online: boolean
  last_seen: string | null
  uptime_minutes: number
  context_window_percent: number
  context_tokens: number
  context_max: number
  messages_session: number
  health_flags: string[]
  last_action_preview: string | null
  last_action_time: string | null
  heartbeat_age_ms: number | null
}

function formatUptime(minutes: number): string {
  if (minutes < 1) return '< 1m'
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h < 24) return `${h}h ${m}m`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function ContextBar({ percent }: { percent: number }) {
  const color = percent > 80 ? 'bg-red-500' : percent > 60 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <span className={cn(
        'text-xs font-mono font-medium tabular-nums',
        percent > 80 ? 'text-red-500 dark:text-red-400' : percent > 60 ? 'text-amber-500 dark:text-amber-400' : 'text-zinc-500 dark:text-zinc-400'
      )}>
        {percent}%
      </span>
    </div>
  )
}

function AgentCard({ agent }: { agent: AgentHealth }) {
  const [expanded, setExpanded] = useState(false)
  const meta = AGENT_MAP[agent.id]
  const hasWarnings = agent.health_flags.length > 0
  const statusColor = agent.is_online ? 'bg-emerald-500' : 'bg-zinc-400 dark:bg-zinc-600'
  const statusLabel = agent.is_online ? 'Online' : 'Offline'

  return (
    <div className={cn(
      'rounded-2xl border p-4 transition-colors',
      hasWarnings && agent.is_online ? 'border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/5' :
      !agent.is_online ? 'border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5' :
      'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm dark:shadow-none'
    )}>
      <div className="flex items-center gap-3 mb-3">
        {meta && <AgentAvatar agent={meta} size="sm" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-zinc-900 dark:text-white">{agent.name}</span>
            <div className="flex items-center gap-1.5">
              <span className={cn('w-2 h-2 rounded-full', statusColor)} />
              <span className={cn(
                'text-[10px] font-medium',
                agent.is_online ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500'
              )}>
                {statusLabel}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-zinc-500">{agent.role}</p>
        </div>

        {hasWarnings && (
          <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
        )}
        {!hasWarnings && agent.is_online && (
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Uptime</span>
          </div>
          <p className="text-sm font-mono font-medium text-zinc-700 dark:text-zinc-300">{formatUptime(agent.uptime_minutes)}</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Heartbeat</span>
          </div>
          <p className="text-sm font-mono font-medium text-zinc-700 dark:text-zinc-300">
            {agent.heartbeat_age_ms != null ? `${Math.floor(agent.heartbeat_age_ms / 1000)}s ago` : '—'}
          </p>
        </div>
      </div>

      <div className="space-y-1.5 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Kontext-Fenster</span>
          </div>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-600">
            {Math.round(agent.context_tokens / 1000)}k / {Math.round(agent.context_max / 1000)}k
          </span>
        </div>
        <ContextBar percent={agent.context_window_percent} />
      </div>

      {agent.last_action_preview && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Letzte Aktivität</span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-600">{relativeTime(agent.last_action_time)} ago</span>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate">{agent.last_action_preview}</p>
        </div>
      )}

      {hasWarnings && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-500/15 transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <Shield className="w-3 h-3" />
            <span>{agent.health_flags.length} Hinweis{agent.health_flags.length > 1 ? 'e' : ''}</span>
          </div>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      )}

      {expanded && hasWarnings && (
        <div className="mt-2 space-y-1.5">
          {agent.health_flags.map((flag, i) => (
            <div key={i} className="flex items-start gap-2 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
              <AlertTriangle className="w-3 h-3 text-amber-500 dark:text-amber-400 mt-0.5 shrink-0" />
              <span className="text-[11px] text-zinc-600 dark:text-zinc-400">{flag}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function HealthPage() {
  const [agents, setAgents] = useState<AgentHealth[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHealth = useCallback(async () => {
    try {
      const res = await authFetch(`/api/agents/monitoring?_t=${Date.now()}`)
      const data = await res.json()
      setAgents(data.agents || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  const visible = usePageVisible()

  useEffect(() => { fetchHealth() }, [fetchHealth])

  useEffect(() => {
    if (!visible) return
    const interval = setInterval(fetchHealth, 30_000)
    return () => clearInterval(interval)
  }, [fetchHealth, visible])

  const onlineCount = agents.filter(a => a.is_online).length
  const warningCount = agents.filter(a => a.health_flags.length > 0).length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-500" />
            Agent Health
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {onlineCount}/{agents.length} online
            {warningCount > 0 && <span className="text-amber-500 dark:text-amber-400 ml-2">{warningCount} mit Hinweisen</span>}
          </p>
        </div>
        <button
          onClick={fetchHealth}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 p-3 text-center">
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{onlineCount}</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Online</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 p-3 text-center">
          <p className="text-xl font-bold text-zinc-600 dark:text-zinc-400">{agents.length - onlineCount}</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Offline</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 p-3 text-center">
          <p className={cn('text-xl font-bold', warningCount > 0 ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>
            {warningCount}
          </p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Warnungen</p>
        </div>
      </div>

      <div className="space-y-3">
        {agents
          .sort((a, b) => {
            if (a.is_online !== b.is_online) return a.is_online ? -1 : 1
            if (a.health_flags.length !== b.health_flags.length) return b.health_flags.length - a.health_flags.length
            return 0
          })
          .map(agent => (
            <AgentCard key={agent.id} agent={agent} />
          ))
        }
      </div>
    </div>
  )
}
