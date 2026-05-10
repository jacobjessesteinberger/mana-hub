'use client'

import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { onAgentEvent } from '@/lib/notifications/NotificationContext'
import { isValidAgentName } from '@/lib/agents-meta'
import QuickChatDock from './QuickChatDock'
import QuickChatWindow from './QuickChatWindow'

interface WindowState {
  agent: string
  minimized: boolean
}

interface WidgetState {
  pinned: boolean
  windows: WindowState[]
}

const LS_KEY = 'quickchat:state'
const MAX_WINDOWS = 5

const EMPTY_STATE: WidgetState = { pinned: false, windows: [] }

function readPersisted(): WidgetState {
  if (typeof window === 'undefined') return EMPTY_STATE
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return EMPTY_STATE
    const parsed = JSON.parse(raw) as Partial<WidgetState>
    const windowsRaw = Array.isArray(parsed.windows) ? parsed.windows : []
    const windows: WindowState[] = []
    const seen = new Set<string>()
    for (const w of windowsRaw) {
      if (!w || typeof w !== 'object') continue
      const agent = typeof w.agent === 'string' ? w.agent : null
      if (!agent || !isValidAgentName(agent) || seen.has(agent)) continue
      seen.add(agent)
      windows.push({ agent, minimized: !!w.minimized })
      if (windows.length >= MAX_WINDOWS) break
    }
    return {
      pinned: !!parsed.pinned,
      windows,
    }
  } catch {
    return EMPTY_STATE
  }
}

function persist(state: WidgetState) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)) } catch { /* ignore */ }
}

export default function QuickChatWidget() {
  const pathname = usePathname() || ''
  const { user, loading } = useAuth()

  const [state, setState] = useState<WidgetState>(() => readPersisted())

  useEffect(() => {
    persist(state)
  }, [state])

  const isOnManaHub = pathname.startsWith('/dashboard/agents')

  const pushWindow = useCallback((agentName: string) => {
    if (!isValidAgentName(agentName)) return
    setState(prev => {
      const idx = prev.windows.findIndex(w => w.agent === agentName)
      if (idx >= 0) {
        const next = [...prev.windows]
        next[idx] = { ...next[idx], minimized: false }
        return { ...prev, windows: next }
      }
      const next = [...prev.windows, { agent: agentName, minimized: false }].slice(-MAX_WINDOWS)
      return { ...prev, windows: next }
    })
  }, [])

  const closeWindow = useCallback((agentName: string) => {
    setState(prev => ({ ...prev, windows: prev.windows.filter(w => w.agent !== agentName) }))
  }, [])

  const toggleMinimize = useCallback((agentName: string) => {
    setState(prev => ({
      ...prev,
      windows: prev.windows.map(w => w.agent === agentName ? { ...w, minimized: !w.minimized } : w),
    }))
  }, [])

  const togglePinned = useCallback(() => {
    setState(prev => ({ ...prev, pinned: !prev.pinned }))
  }, [])

  const toggleWindow = useCallback((agentName: string) => {
    if (!isValidAgentName(agentName)) return
    setState(prev => {
      const exists = prev.windows.some(w => w.agent === agentName)
      if (exists) {
        return { ...prev, windows: prev.windows.filter(w => w.agent !== agentName) }
      }
      const next = [...prev.windows, { agent: agentName, minimized: false }].slice(-MAX_WINDOWS)
      return { ...prev, windows: next }
    })
  }, [])

  useEffect(() => {
    if (isOnManaHub) return
    return onAgentEvent((event) => {
      if (event.type !== 'message' || !event.agentName) return
      if (!isValidAgentName(event.agentName)) return
      pushWindow(event.agentName)
    })
  }, [isOnManaHub, pushWindow])

  if (loading || !user || isOnManaHub) return null

  return (
    <div className="hidden md:block fixed bottom-3 right-3 z-40 pointer-events-none">
      <div className="flex flex-row-reverse items-end gap-2 pointer-events-auto">
        <QuickChatDock
          pinned={state.pinned}
          onTogglePinned={togglePinned}
          onSelectAgent={toggleWindow}
          forceExpanded={state.windows.length > 0}
          openAgents={state.windows.map(w => w.agent)}
        />
        {state.windows.map(w => (
          <QuickChatWindow
            key={w.agent}
            agentName={w.agent}
            minimized={w.minimized}
            compact={state.windows.length > 3}
            onToggleMinimize={() => toggleMinimize(w.agent)}
            onClose={() => closeWindow(w.agent)}
          />
        ))}
      </div>
    </div>
  )
}
