'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Minus, X, ExternalLink, ChevronUp } from 'lucide-react'
import { authFetch } from '@/lib/auth-fetch'
import { supabase } from '@/lib/supabase/client'
import { AGENT_MAP } from '@/lib/agents-meta'
import { useNotifications, onAgentEvent } from '@/lib/notifications/NotificationContext'
import AgentAvatar from '@/components/ui/AgentAvatar'
import { cn } from '@/lib/utils'
import QuickChatBody from './QuickChatBody'
import type { Message } from './types'

interface QuickChatWindowProps {
  agentName: string
  minimized: boolean
  compact?: boolean
  onToggleMinimize: () => void
  onClose: () => void
}

function unansweredUserStart(messages: Message[]): string | null {
  const lastUser = [...messages].reverse().find(m => m.role === 'user')
  if (!lastUser) return null
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
  if (!lastAssistant || new Date(lastUser.created_at) > new Date(lastAssistant.created_at)) {
    return lastUser.created_at
  }
  return null
}

export default function QuickChatWindow({ agentName, minimized, compact = false, onToggleMinimize, onClose }: QuickChatWindowProps) {
  const meta = AGENT_MAP[agentName] || {
    emoji: '🤖',
    fullName: agentName.toUpperCase(),
    label: agentName.toUpperCase(),
    color: '#6B7280',
    avatar: '',
    name: agentName,
    role: 'Agent',
  }

  const { clear, counts, heartbeats } = useNotifications()
  const hb = heartbeats[agentName]
  const isOnline = !!hb && ['online', 'busy', 'idle'].includes(hb.status)
  const unread = counts[agentName] || 0

  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [waitingForReply, setWaitingForReply] = useState(false)
  const [workStartedAt, setWorkStartedAt] = useState<string | null>(null)
  const lastTsRef = useRef<string>('')
  const pollBlockedUntil = useRef(0)

  const mergeIncomingMessages = useCallback((incoming: Message[]) => {
    if (incoming.length === 0) return

    const latest = incoming[incoming.length - 1]
    lastTsRef.current = latest.created_at

    setMessages(current => {
      const existingIds = new Set(current.filter(m => !m.id.startsWith('temp-')).map(m => m.id))
      const trulyNew = incoming.filter(m => !existingIds.has(m.id))
      if (trulyNew.length === 0) return current

      const pending = current.filter(m => m.id.startsWith('temp-'))
      const stillPending = pending.filter(temp => {
        const tempTime = new Date(temp.created_at).getTime()
        return !trulyNew.some(s =>
          s.role === temp.role &&
          Math.abs(new Date(s.created_at).getTime() - tempTime) < 10000
        )
      })
      const realCurrent = current.filter(m => !m.id.startsWith('temp-'))
      return [...realCurrent, ...trulyNew, ...stillPending]
    })

    if (latest.role === 'assistant') {
      setWaitingForReply(false)
      setWorkStartedAt(null)
    } else if (latest.role === 'user') {
      setWaitingForReply(true)
      setWorkStartedAt(latest.created_at)
    }
  }, [])

  const fetchIncremental = useCallback(async (force = false) => {
    if (!force && Date.now() < pollBlockedUntil.current) return
    try {
      const url = lastTsRef.current
        ? `/api/agents/messages?agent=${agentName}&after=${encodeURIComponent(lastTsRef.current)}&_t=${Date.now()}`
        : `/api/agents/messages?agent=${agentName}&limit=50&_t=${Date.now()}`
      const res = await authFetch(url)
      const data = await res.json()
      const incoming: Message[] = data.messages || []
      if (incoming.length === 0) return

      mergeIncomingMessages(incoming)
    } catch { /* ignore */ }
  }, [agentName, mergeIncomingMessages])

  useEffect(() => {
    let active = true
    setLoading(true)

    async function load() {
      try {
        const res = await authFetch(`/api/agents/messages?agent=${agentName}&limit=50`)
        const data = await res.json()
        const msgs: Message[] = data.messages || []
        if (!active) return
        setMessages(msgs)
        lastTsRef.current = msgs.length > 0 ? msgs[msgs.length - 1].created_at : ''
        const unansweredStart = unansweredUserStart(msgs)
        try {
          const actRes = await authFetch(`/api/agents/activity?agent=${agentName}&_t=${Date.now()}`)
          const actData = await actRes.json()
          const activityFresh = actData.updated_at &&
            (Date.now() - new Date(actData.updated_at).getTime()) < 60_000
          if ((actData.active && activityFresh) || unansweredStart) {
            setWaitingForReply(true)
            setWorkStartedAt(unansweredStart ?? actData.updated_at ?? null)
          } else {
            setWaitingForReply(false)
            setWorkStartedAt(null)
          }
        } catch {
          if (unansweredStart) {
            setWaitingForReply(true)
            setWorkStartedAt(unansweredStart)
          }
        }
      } catch { /* ignore */ }
      finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [agentName])

  useEffect(() => {
    const interval = setInterval(fetchIncremental, 15000)
    return () => clearInterval(interval)
  }, [fetchIncremental])

  useEffect(() => {
    return onAgentEvent((event) => {
      if (event.type === 'message' && event.agentName === agentName) {
        const msg = event.data as Partial<Message>
        if (msg.id && msg.created_at && msg.role && msg.content) {
          mergeIncomingMessages([msg as Message])
        } else {
          fetchIncremental(true)
        }
      }
    })
  }, [agentName, fetchIncremental, mergeIncomingMessages])

  useEffect(() => {
    const channel = supabase
      .channel(`quickchat-window-${agentName}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_messages', filter: `agent_name=eq.${agentName}` },
        (payload) => mergeIncomingMessages([payload.new as Message])
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [agentName, mergeIncomingMessages])

  useEffect(() => {
    if (!minimized) clear(agentName)
  }, [minimized, agentName, clear])

  const handleBeforeSend = useCallback((opt: Message) => {
    setMessages(prev => [...prev, opt])
    setWorkStartedAt(opt.created_at)
    pollBlockedUntil.current = Date.now() + 4000
  }, [])

  const handleSendSuccess = useCallback((tempId: string, real: Message) => {
    if (real) {
      setMessages(prev => prev.map(m => m.id === tempId ? real : m))
      setWorkStartedAt(real.created_at)
    }
    setWaitingForReply(true)
    pollBlockedUntil.current = Date.now() + 2000
  }, [])

  const handleSendFail = useCallback((tempId: string) => {
    const next = messages.filter(m => m.id !== tempId)
    setMessages(next)
    setWorkStartedAt(unansweredUserStart(next))
    pollBlockedUntil.current = 0
  }, [messages])

  const headerClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) return
    onToggleMinimize()
  }, [onToggleMinimize])

  return (
    <div
      className={cn(
        'quickchat-panel-in',
        'flex flex-col rounded-2xl overflow-hidden shrink-0 transition-[width] duration-200',
        compact ? 'w-[300px]' : 'w-[380px]',
        'bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl backdrop-saturate-150',
        'border border-zinc-200/80 dark:border-white/[0.08]',
        'shadow-2xl shadow-black/20 dark:shadow-black/40',
        minimized ? 'h-auto' : 'h-[480px] max-h-[calc(100vh-100px)]'
      )}
    >
      <div
        onClick={headerClick}
        className={cn(
          'flex items-center gap-2 px-2.5 py-2 cursor-pointer select-none shrink-0',
          'bg-white/60 dark:bg-zinc-900/60',
          !minimized && 'border-b border-zinc-200/60 dark:border-white/[0.06]',
          minimized && unread > 0 && 'bg-purple-50/80 dark:bg-purple-500/[0.08]'
        )}
      >
        <div className="relative shrink-0">
          <AgentAvatar agent={meta} size="sm" />
          {waitingForReply ? (
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-[1.5px] ring-white dark:ring-zinc-900 animate-pulse" />
          ) : isOnline && (
            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-[1.5px] ring-white dark:ring-zinc-900" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[13px] font-semibold text-zinc-900 dark:text-white truncate leading-tight">
              {meta.label}
            </p>
            {minimized && unread > 0 && (
              <span className="shrink-0 min-w-[16px] h-[16px] flex items-center justify-center px-1 rounded-full bg-red-500 text-[10px] font-bold text-white tabular-nums">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </div>
          {waitingForReply ? (
            <div className="flex items-center gap-1 leading-tight">
              <span className="flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 truncate">arbeitet...</span>
            </div>
          ) : (
            <p className="text-[10px] text-zinc-500 dark:text-zinc-500 truncate leading-tight">{meta.role}</p>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <Link
            href={`/dashboard/agents/${agentName}/chat`}
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors"
            title="Vollchat oeffnen"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleMinimize() }}
            aria-label={minimized ? 'Erweitern' : 'Minimieren'}
            className="p-1.5 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            {minimized ? <ChevronUp className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose() }}
            aria-label="Schliessen"
            className="p-1.5 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!minimized && (
        <div className="flex-1 min-h-0">
          <QuickChatBody
            agentName={agentName}
            meta={meta}
            messages={messages}
            loading={loading}
            waitingForReply={waitingForReply}
            workStartedAt={workStartedAt}
            onBeforeSend={handleBeforeSend}
            onSendSuccess={handleSendSuccess}
            onSendFail={handleSendFail}
          />
        </div>
      )}
    </div>
  )
}
