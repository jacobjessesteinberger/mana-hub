'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { authFetch } from '@/lib/auth-fetch'
import { AGENTS } from '@/lib/agents-meta'
import { usePageVisible } from '@/hooks/usePageVisible'
import AgentAvatar from '@/components/ui/AgentAvatar'
import { useNotifications } from '@/lib/notifications/NotificationContext'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface LastMessage {
  agent_name: string
  content: string
  created_at: string
  role: string
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'gerade'
  const m = Math.floor(s / 60)
  if (m < 60) return `vor ${m} Min.`
  const h = Math.floor(m / 60)
  if (h < 24) return `vor ${h} Std.`
  const d = Math.floor(h / 24)
  return d === 1 ? 'gestern' : `vor ${d} Tagen`
}

export default function ChatListPage() {
  const [lastMessages, setLastMessages] = useState<Record<string, LastMessage>>({})
  const [loading, setLoading] = useState(true)
  const { counts, clear, heartbeats } = useNotifications()
  const visible = usePageVisible()

  const fetchData = useCallback(async () => {
    try {
      const msgResults = await Promise.all(
        AGENTS.map(a =>
          authFetch(`/api/agents/messages?agent=${a.name}&limit=1&sort=desc`)
            .then(r => r.json())
            .then(d => ({ agent: a.name, msg: (d.messages || [])[0] || null }))
            .catch(() => ({ agent: a.name, msg: null }))
        )
      )

      const msgMap: Record<string, LastMessage> = {}
      for (const r of msgResults) {
        if (r.msg) msgMap[r.agent] = r.msg
      }
      setLastMessages(msgMap)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!visible) return
    const interval = setInterval(fetchData, 60_000)
    return () => clearInterval(interval)
  }, [fetchData, visible])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold text-white">DMs</h1>
      </div>

      {/* Avatar Shortcuts Row (like Slack) */}
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <div className="flex gap-4 overflow-x-auto scrollbar-none">
          {AGENTS.map(agent => {
            const hb = heartbeats[agent.name]
            const isOnline = hb && ['online', 'busy', 'idle'].includes(hb.status)
            const unread = counts[agent.name] || 0
            return (
              <Link
                key={agent.name}
                href={`/dashboard/agents/${agent.name}/chat`}
                onClick={() => clear(agent.name)}
                className="flex flex-col items-center gap-1 shrink-0"
              >
                <div className="relative">
                  <AgentAvatar agent={agent} size="lg" />
                  {isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-zinc-950" />
                  )}
                  {unread > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full bg-red-500 text-[10px] font-bold text-white">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-zinc-400 font-medium truncate max-w-[56px] text-center">
                  {agent.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {AGENTS.map(agent => {
          const lastMsg = lastMessages[agent.name]
          const hb = heartbeats[agent.name]
          const isOnline = hb && ['online', 'busy', 'idle'].includes(hb.status)
          const unread = counts[agent.name] || 0
          const preview = lastMsg
            ? lastMsg.content.replace(/\n/g, ' ').substring(0, 80) + (lastMsg.content.length > 80 ? '…' : '')
            : 'Noch keine Nachrichten'

          return (
            <Link
              key={agent.name}
              href={`/dashboard/agents/${agent.name}/chat`}
              onClick={() => clear(agent.name)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-900/50 active:bg-zinc-800/60 transition-colors border-b border-white/[0.04]"
            >
              <div className="relative shrink-0">
                <AgentAvatar agent={agent} size="md" />
                {isOnline && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-[1.5px] ring-zinc-950" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      'text-[15px] font-semibold',
                      unread > 0 ? 'text-white' : 'text-zinc-300'
                    )}>
                      {agent.label}
                    </span>
                    {agent.role && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 font-medium uppercase tracking-wide hidden sm:inline">
                        BOT
                      </span>
                    )}
                  </div>
                  {lastMsg && (
                    <span className="text-[11px] text-zinc-600 shrink-0 ml-2">
                      {relativeTime(lastMsg.created_at)}
                    </span>
                  )}
                </div>
                <p className={cn(
                  'text-[13px] truncate mt-0.5',
                  unread > 0 ? 'text-zinc-300 font-medium' : 'text-zinc-500'
                )}>
                  {preview}
                </p>
              </div>

              {unread > 0 && (
                <span className="shrink-0 min-w-[20px] h-[20px] flex items-center justify-center px-1 rounded-full bg-red-500 text-[11px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
