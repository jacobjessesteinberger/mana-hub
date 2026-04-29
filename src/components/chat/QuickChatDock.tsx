'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Pin, PinOff } from 'lucide-react'
import { AGENTS } from '@/lib/agents-meta'
import { useNotifications } from '@/lib/notifications/NotificationContext'
import AgentAvatar from '@/components/ui/AgentAvatar'
import { cn } from '@/lib/utils'

interface QuickChatDockProps {
  pinned: boolean
  onTogglePinned: () => void
  onSelectAgent: (agentName: string) => void
  forceExpanded: boolean
  openAgents: string[]
}

const VISIBLE_AVATARS = 3

export default function QuickChatDock({ pinned, onTogglePinned, onSelectAgent, forceExpanded, openAgents }: QuickChatDockProps) {
  const openSet = new Set(openAgents)
  const [hovered, setHovered] = useState(false)
  const { counts, totalCount, heartbeats } = useNotifications()
  const expanded = forceExpanded || pinned || hovered

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="shrink-0"
    >
      {expanded ? (
        <div
          className={cn(
            'quickchat-panel-in',
            'flex items-center gap-1 p-1.5 rounded-full',
            'bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl backdrop-saturate-150',
            'border border-zinc-200/80 dark:border-white/[0.08]',
            'shadow-2xl shadow-black/20 dark:shadow-black/40'
          )}
        >
          <button
            type="button"
            onClick={onTogglePinned}
            aria-label={pinned ? 'Dock loesen' : 'Dock anpinnen'}
            title={pinned ? 'Dock loesen' : 'Dock anpinnen'}
            className={cn(
              'p-1.5 rounded-full transition-colors',
              pinned
                ? 'text-purple-600 dark:text-purple-400 bg-purple-100/60 dark:bg-purple-500/10'
                : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.06]'
            )}
          >
            {pinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
          </button>

          <div className="w-px h-6 bg-zinc-200 dark:bg-white/[0.08]" />

          {AGENTS.map(agent => {
            const hb = heartbeats[agent.name]
            const isOnline = !!hb && ['online', 'busy', 'idle'].includes(hb.status)
            const unread = counts[agent.name] || 0
            const isOpen = openSet.has(agent.name)
            return (
              <button
                key={agent.name}
                type="button"
                onClick={() => onSelectAgent(agent.name)}
                title={isOpen ? `${agent.label} schliessen` : `${agent.label} oeffnen`}
                className={cn(
                  'relative p-0.5 rounded-full hover:scale-110 active:scale-95 transition-transform',
                  isOpen && 'ring-2 ring-purple-500 dark:ring-purple-400 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900'
                )}
              >
                <AgentAvatar agent={agent} size="md" />
                {isOnline && (
                  <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900" />
                )}
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full bg-red-500 ring-2 ring-white dark:ring-zinc-900 text-[10px] font-bold text-white tabular-nums">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      ) : (
        <button
          type="button"
          aria-label="Quick Chat oeffnen"
          className={cn(
            'group relative flex items-center gap-2 pl-2 pr-3.5 py-2 rounded-full',
            'bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500',
            'shadow-xl shadow-purple-500/30 dark:shadow-purple-500/20',
            'hover:shadow-2xl hover:shadow-purple-500/40 hover:scale-[1.03]',
            'active:scale-[0.97]',
            'transition-all duration-200',
            'ring-1 ring-white/20',
            totalCount > 0 && 'quickchat-launcher-pulse'
          )}
        >
          <div className="flex items-center -space-x-2.5">
            {AGENTS.slice(0, VISIBLE_AVATARS).map(agent => (
              <div
                key={agent.name}
                className="relative w-7 h-7 rounded-full overflow-hidden ring-2 ring-white/90 dark:ring-zinc-900 bg-zinc-200"
              >
                <Image
                  src={agent.avatar}
                  alt={agent.label}
                  width={28}
                  height={28}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
          <span className="text-[13px] font-semibold text-white tracking-tight pr-0.5">Agents</span>
          {totalCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] flex items-center justify-center px-1.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-zinc-950 text-[11px] font-bold text-white tabular-nums">
              {totalCount > 9 ? '9+' : totalCount}
            </span>
          )}
        </button>
      )}
    </div>
  )
}
