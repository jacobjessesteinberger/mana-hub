'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { authFetch } from '@/lib/auth-fetch'
import { supabase } from '@/lib/supabase/client'
import { AGENT_MAP } from '@/lib/agents-meta'
import { cn } from '@/lib/utils'
import { onAgentEvent } from '@/lib/notifications/NotificationContext'
import { useNotifications } from '@/lib/notifications/NotificationContext'
import AgentAvatar from '@/components/ui/AgentAvatar'
import { CheckCircle2, Loader2, Plus, ShieldAlert, ChevronUp, X, Folder, FileText as FileTextIcon, Database } from 'lucide-react'
import { useKeyboardOpen } from '@/hooks/useKeyboardOpen'
import { usePageVisible } from '@/hooks/usePageVisible'
import { UserMessageBubble, AssistantMessageBubble } from '@/components/chat/MessageBubbles'
import ChatInput, { type ChatInputHandle } from '@/components/chat/ChatInput'
import type { Message } from '@/components/chat/types'

// Wiederverwendbare Chat-Bausteine (MarkdownContent, Bubbles, ChatInput) liegen jetzt in
// src/components/chat/* und werden auch vom globalen QuickChatWidget benutzt.

function unansweredUserStart(messages: Message[]): string | null {
  const activeMessages = messages.filter(m => {
    const status = m.metadata?.lifecycle_status
    return status !== 'retracted' && status !== 'superseded'
  })
  const lastUser = [...activeMessages].reverse().find(m => m.role === 'user')
  if (!lastUser) return null
  const lastAssistant = [...activeMessages].reverse().find(m => m.role === 'assistant')
  if (!lastAssistant || new Date(lastUser.created_at) > new Date(lastAssistant.created_at)) {
    return lastUser.created_at
  }
  return null
}

interface TaskProposalDraft {
  sourceMessageId: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'draft' | 'creating' | 'created'
}

function hasTaskProposalSignal(message: Message): boolean {
  if (message.metadata?.kind === 'task_proposal') return true

  const firstBlock = message.content.trim().slice(0, 500).toLowerCase()
  return [
    'task proposal:',
    'task-proposal:',
    'task_vorschlag:',
    'task-vorschlag:',
    '[task proposal]',
    '[task-proposal]',
  ].some(signal => firstBlock.includes(signal))
}

function buildTaskProposal(message: Message, agentName: string): TaskProposalDraft {
  const lines = message.content
    .split('\n')
    .map(line => line.replace(/^[-*#\d.)\s]+/, '').trim())
    .filter(Boolean)

  const title = (message.metadata?.title || lines.find(line => line.length >= 12 && line.length <= 120) || `${agentName.toUpperCase()} Follow-up`).slice(0, 120)
  const lower = message.content.toLowerCase()
  const priority: TaskProposalDraft['priority'] = message.metadata?.priority || (lower.includes('kritisch') || lower.includes('critical')
    ? 'critical'
    : lower.includes('dringend') || lower.includes('high')
      ? 'high'
      : 'medium')

  return {
    sourceMessageId: message.id,
    title,
    description: message.content,
    priority,
    status: 'draft',
  }
}

export default function AgentChatPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const agentName = (params.name as string).toLowerCase()
  const briefingId = searchParams.get('briefing')
  const meta = AGENT_MAP[agentName] || { emoji: '🤖', fullName: agentName.toUpperCase(), label: agentName.toUpperCase(), color: '#6B7280', avatar: '', name: agentName, role: 'Agent' }
  const { clear } = useNotifications()

  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const visible = usePageVisible()
  const [waitingForReply, setWaitingForReply] = useState(false)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [, setActivitySteps] = useState<string[]>([])
  const [, setActivityElapsed] = useState<string | null>(null)
  const [workTimer, setWorkTimer] = useState(0)
  const [workStartedAt, setWorkStartedAt] = useState<string | null>(null)
  const [permissionPending, setPermissionPending] = useState(false)
  const [permissionPrompt, setPermissionPrompt] = useState<string | null>(null)
  const [approvingAction, setApprovingAction] = useState<string | null>(null)
  const [showScrollDown, setShowScrollDown] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [controlStatus, setControlStatus] = useState<string | null>(null)
  const [taskProposal, setTaskProposal] = useState<TaskProposalDraft | null>(null)
  const [dismissedProposalIds, setDismissedProposalIds] = useState<Set<string>>(new Set())
  const keyboardOpen = useKeyboardOpen()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<ChatInputHandle>(null)
  const lastMsgId = useRef<string>('')
  const isInitialLoad = useRef(true)
  const userSentMessage = useRef(false)
  const firstUnreadId = useRef<string | null>(null)
  const pollBlockedUntil = useRef(0)
  const appliedBriefingIdRef = useRef<string | null>(null)
  const proposalEligibleAfterRef = useRef(new Date().toISOString())

  const lsKey = `chat-seen-${agentName}`

  const isNearBottom = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 150
  }, [])

  const scrollToBottom = useCallback((instant = false) => {
    const el = scrollContainerRef.current
    if (!el) return
    if (instant) {
      el.scrollTop = el.scrollHeight
    } else {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [])

  const markAsSeen = useCallback((msgs: Message[]) => {
    const lastReal = [...msgs].reverse().find(m => !m.id.startsWith('temp-'))
    if (lastReal) {
      try { localStorage.setItem(lsKey, lastReal.id) } catch { /* ignore */ }
    }
  }, [lsKey])

  const latestMsgTsRef = useRef<string>('')

  const mergeIncomingMessages = useCallback((incoming: Message[]) => {
    if (incoming.length === 0) return

    const latestNew = incoming[incoming.length - 1]
    lastMsgId.current = latestNew.id
    latestMsgTsRef.current = latestNew.created_at

    setMessages(current => {
      const existingIds = new Set(current.filter(m => !m.id.startsWith('temp-')).map(m => m.id))
      const trulyNew = incoming.filter(m => !existingIds.has(m.id))
      if (trulyNew.length === 0) return current

      const pendingMsgs = current.filter(m => m.id.startsWith('temp-'))
      const stillPending = pendingMsgs.filter(temp => {
        const tempTime = new Date(temp.created_at).getTime()
        return !trulyNew.some(s =>
          s.role === temp.role &&
          Math.abs(new Date(s.created_at).getTime() - tempTime) < 10000
        )
      })
      const realCurrent = current.filter(m => !m.id.startsWith('temp-'))
      return [...realCurrent, ...trulyNew, ...stillPending]
    })

    if (latestNew.role === 'assistant') {
      setWaitingForReply(false)
      setWorkStartedAt(null)
    } else if (latestNew.role === 'user') {
      setWaitingForReply(true)
      setWorkStartedAt(latestNew.created_at)
    }
  }, [])

  const fetchMessages = useCallback(async (force = false) => {
    if (!force && Date.now() < pollBlockedUntil.current) return

    try {
      const url = latestMsgTsRef.current
        ? `/api/agents/messages?agent=${agentName}&after=${encodeURIComponent(latestMsgTsRef.current)}&_t=${Date.now()}`
        : `/api/agents/messages?agent=${agentName}&limit=100&_t=${Date.now()}`
      const res = await authFetch(url)
      const data = await res.json()
      const newMsgs: Message[] = data.messages || []
      if (newMsgs.length === 0) return

      mergeIncomingMessages(newMsgs)
    } catch { /* ignore */ }
  }, [agentName, mergeIncomingMessages])

  const loadOlderMessages = useCallback(async () => {
    if (loadingOlder || !hasMore) return
    setLoadingOlder(true)

    try {
      const el = scrollContainerRef.current
      const prevScrollHeight = el?.scrollHeight || 0

      const realMsgs = messages.filter(m => !m.id.startsWith('temp-'))
      const oldestMsg = realMsgs.length > 0 ? realMsgs[0] : null
      if (!oldestMsg) { setLoadingOlder(false); return }

      const beforeParam = encodeURIComponent(oldestMsg.created_at)
      const res = await authFetch(`/api/agents/messages?agent=${agentName}&before=${beforeParam}&limit=100&_t=${Date.now()}`)
      const data = await res.json()
      const olderMsgs: Message[] = data.messages || []
      setHasMore(data.has_more ?? false)

      if (olderMsgs.length > 0) {
        const existingIds = new Set(realMsgs.map(m => m.id))
        const trulyOlder = olderMsgs.filter(m => !existingIds.has(m.id))
        if (trulyOlder.length > 0) {
          setMessages(prev => [...trulyOlder, ...prev])
          requestAnimationFrame(() => {
            if (el) {
              el.scrollTop = el.scrollHeight - prevScrollHeight
            }
          })
        }
      }
    } catch { /* ignore */ }
    setLoadingOlder(false)
  }, [agentName, hasMore, loadingOlder, messages])

  useEffect(() => {
    async function load() {
      try {
        const msgRes = await authFetch(`/api/agents/messages?agent=${agentName}&limit=100`)
        const msgData = await msgRes.json()
        const msgs: Message[] = msgData.messages || []
        setHasMore(msgData.has_more ?? false)

        let lastSeenId: string | null = null
        try { lastSeenId = localStorage.getItem(lsKey) } catch { /* ignore */ }

        if (lastSeenId) {
          const seenIdx = msgs.findIndex(m => m.id === lastSeenId)
          if (seenIdx >= 0 && seenIdx < msgs.length - 1) {
            firstUnreadId.current = msgs[seenIdx + 1].id
          }
        }

        setMessages(msgs)
        lastMsgId.current = msgs.length > 0 ? msgs[msgs.length - 1].id : ''
        latestMsgTsRef.current = msgs.length > 0 ? msgs[msgs.length - 1].created_at : ''

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
        setLoading(false)
        requestAnimationFrame(() => {
          scrollToBottom(true)
          setTimeout(() => scrollToBottom(true), 100)
          setTimeout(() => { scrollToBottom(true); isInitialLoad.current = false }, 300)
        })
      }
    }
    load()
  }, [agentName, scrollToBottom, lsKey])

  useEffect(() => {
    if (isInitialLoad.current) return
    if (userSentMessage.current) {
      userSentMessage.current = false
      scrollToBottom()
      return
    }
    if (isNearBottom()) {
      scrollToBottom()
    }
  }, [messages, waitingForReply, scrollToBottom, isNearBottom])

  useEffect(() => {
    if (!visible) return
    const interval = setInterval(fetchMessages, 15000)
    return () => clearInterval(interval)
  }, [fetchMessages, visible])

  useEffect(() => {
    if (!agentName) return

    const channel = supabase
      .channel(`chat-${agentName}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_messages', filter: `agent_name=eq.${agentName}` },
        (payload) => {
          mergeIncomingMessages([payload.new as Message])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [agentName, mergeIncomingMessages])

  useEffect(() => {
    if (!waitingForReply || !workStartedAt) {
      setWorkTimer(0)
      return
    }

    const startedAt = new Date(workStartedAt).getTime()
    const update = () => {
      setWorkTimer(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)))
    }
    update()
    const iv = setInterval(update, 1000)
    return () => clearInterval(iv)
  }, [waitingForReply, workStartedAt])

  useEffect(() => {
    if (isInitialLoad.current || messages.length === 0) return
    if (isNearBottom()) {
      markAsSeen(messages)
    }
  }, [messages, isNearBottom, markAsSeen])

  useEffect(() => {
    return () => { markAsSeen(messages) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentName])

  useEffect(() => {
    clear(agentName)
    return onAgentEvent((event) => {
      if (event.type === 'message' && event.agentName === agentName) {
        const msg = event.data as Partial<Message>
        if (msg.id && msg.created_at && msg.role && msg.content) {
          mergeIncomingMessages([msg as Message])
        } else {
          fetchMessages(true)
        }
      }
    })
  }, [agentName, fetchMessages, mergeIncomingMessages, clear])

  useEffect(() => {
    if (!waitingForReply) {
      setActivitySteps([])
      setActivityElapsed(null)
      setPermissionPending(false)
      setPermissionPrompt(null)
      return
    }
    let cancelled = false
    async function poll() {
      try {
        const res = await authFetch(`/api/agents/activity?agent=${agentName}&_t=${Date.now()}`)
        const data = await res.json()
        if (cancelled) return
        setActivitySteps(data.steps?.length > 0 ? data.steps : [])
        if (data.elapsed) setActivityElapsed(data.elapsed)
        setPermissionPending(data.permission_pending ?? false)
        setPermissionPrompt(data.permission_prompt ?? null)
      } catch { /* ignore */ }
    }
    poll()
    if (!visible) return () => { cancelled = true }
    const interval = setInterval(poll, 3000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [waitingForReply, agentName, visible])

  async function handleApprove(action: 'allow_once' | 'allow_always' | 'deny') {
    setApprovingAction(action)
    try {
      await authFetch('/api/agents/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_name: agentName, action }),
      })
      setPermissionPending(false)
      setPermissionPrompt(null)
    } catch { /* ignore */ }
    setApprovingAction(null)
  }

  useEffect(() => {
    if (waitingForReply) return
    let cancelled = false
    async function pollPermissions() {
      try {
        const res = await authFetch(`/api/agents/activity?agent=${agentName}&_t=${Date.now()}`)
        const data = await res.json()
        if (cancelled) return
        setPermissionPending(data.permission_pending ?? false)
        setPermissionPrompt(data.permission_prompt ?? null)
      } catch { /* ignore */ }
    }
    pollPermissions()
    if (!visible) return () => { cancelled = true }
    const iv = setInterval(pollPermissions, 10000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [waitingForReply, agentName, visible])

  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    let touchStartY = 0
    function onScroll() {
      setShowScrollDown(!isNearBottom())
      if (el && el.scrollTop < 200) {
        loadOlderMessages()
      }
    }
    function onTouchStart(e: TouchEvent) {
      touchStartY = e.touches[0].clientY
    }
    function onTouchMove(e: TouchEvent) {
      const deltaY = Math.abs(e.touches[0].clientY - touchStartY)
      if (deltaY > 30 && document.activeElement instanceof HTMLElement) {
        const active = document.activeElement
        if (active.tagName !== 'TEXTAREA' && active.tagName !== 'INPUT') return
        if (el?.contains(e.target as Node)) {
          active.blur()
        }
      }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
    }
  }, [isNearBottom, loadOlderMessages])

  const handleReply = useCallback((msg: Message) => {
    setReplyTo(msg)
  }, [])

  const handleClearReply = useCallback(() => {
    setReplyTo(null)
  }, [])

  const handleEditMessage = useCallback((msg: Message) => {
    setEditingMessage(msg)
    setReplyTo(null)
    chatInputRef.current?.setValue(msg.content)
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null)
  }, [])

  const handleEditSuccess = useCallback((originalId: string, editedMessage: Message) => {
    setMessages(prev => [
      ...prev.map(message => message.id === originalId
        ? {
            ...message,
            metadata: {
              ...(message.metadata || {}),
              lifecycle_status: 'superseded' as const,
              superseded_by: editedMessage.id,
              edited_at: new Date().toISOString(),
            },
          }
        : message),
      editedMessage,
    ])
    setEditingMessage(null)
    setWaitingForReply(true)
    setWorkStartedAt(editedMessage.created_at)
    setControlStatus('Nachricht aktualisiert. Laufende Agent-Arbeit wurde gestoppt und die neue Version wurde gesendet.')
    pollBlockedUntil.current = Date.now() + 4000
  }, [])

  const handleRetractMessage = useCallback(async (msg: Message) => {
    if (msg.id.startsWith('temp-')) return
    try {
      const res = await authFetch(`/api/agents/messages/${msg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retract', stop_agent: true }),
      })
      if (!res.ok) throw new Error('Retract failed')
      setMessages(prev => prev.map(message => message.id === msg.id
        ? {
            ...message,
            metadata: {
              ...(message.metadata || {}),
              lifecycle_status: 'retracted' as const,
              retracted_at: new Date().toISOString(),
            },
          }
        : message))
      setWaitingForReply(false)
      setWorkStartedAt(null)
      setControlStatus('Nachricht zurückgezogen. Laufende Agent-Arbeit wurde gestoppt.')
    } catch {
      setControlStatus('Nachricht konnte nicht zurückgezogen werden.')
    }
  }, [])

  const handleCommand = useCallback(async (command: string) => {
    if (command.trim() !== '/stop') return false
    try {
      const res = await authFetch(`/api/agents/${agentName}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'User typed /stop in chat' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Stop failed')
      setWaitingForReply(false)
      setWorkStartedAt(null)
      setControlStatus(data.message || 'Agent-Arbeit wurde gestoppt.')
    } catch {
      setControlStatus('Stop konnte nicht ausgeführt werden.')
    }
    return true
  }, [agentName])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`chat-task-proposals-dismissed-${agentName}`)
      if (raw) setDismissedProposalIds(new Set(JSON.parse(raw) as string[]))
    } catch { /* ignore */ }
  }, [agentName])

  useEffect(() => {
    if (messages.length === 0) return
    const assistantMessages = messages.filter(message =>
      message.role === 'assistant' &&
      !message.id.startsWith('temp-') &&
      new Date(message.created_at) > new Date(proposalEligibleAfterRef.current) &&
      !dismissedProposalIds.has(message.id) &&
      hasTaskProposalSignal(message)
    )
    const latest = assistantMessages[assistantMessages.length - 1]
    if (!latest) return

    setTaskProposal(current => {
      if (current?.status === 'creating') return current
      if (current?.sourceMessageId === latest.id) return current
      return buildTaskProposal(latest, agentName)
    })
  }, [agentName, dismissedProposalIds, messages])

  const dismissTaskProposal = useCallback(() => {
    if (!taskProposal) return
    setDismissedProposalIds(prev => {
      const next = new Set(prev)
      next.add(taskProposal.sourceMessageId)
      try { localStorage.setItem(`chat-task-proposals-dismissed-${agentName}`, JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
    setTaskProposal(null)
  }, [agentName, taskProposal])

  const createTaskFromProposal = useCallback(async () => {
    if (!taskProposal) return
    setTaskProposal(current => current ? { ...current, status: 'creating' } : current)

    try {
      const contextMessages = messages
        .filter(message => !message.id.startsWith('temp-'))
        .slice(-12)
        .map(message => ({ role: message.role === 'assistant' ? 'assistant' as const : 'user' as const, content: message.content.slice(0, 5000) }))

      const res = await authFetch('/api/agents/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskProposal.title,
          description: taskProposal.description,
          priority: taskProposal.priority,
          agent_name: agentName,
          labels: ['chat-proposal'],
          planning_context: {
            messages: contextMessages,
            model: 'sonnet',
            finalized_at: new Date().toISOString(),
          },
        }),
      })

      if (!res.ok) throw new Error('Task create failed')

      setTaskProposal(current => current ? { ...current, status: 'created' } : current)
      setDismissedProposalIds(prev => {
        const next = new Set(prev)
        next.add(taskProposal.sourceMessageId)
        try { localStorage.setItem(`chat-task-proposals-dismissed-${agentName}`, JSON.stringify([...next])) } catch { /* ignore */ }
        return next
      })
      setTimeout(() => setTaskProposal(null), 1800)
    } catch {
      setTaskProposal(current => current ? { ...current, status: 'draft' } : current)
    }
  }, [agentName, messages, taskProposal])

  useEffect(() => {
    if (!briefingId) return
    if (appliedBriefingIdRef.current === briefingId) return

    const loadedMessage = messages.find(message => message.id === briefingId)
    if (loadedMessage) {
      setReplyTo(loadedMessage)
      appliedBriefingIdRef.current = briefingId
      requestAnimationFrame(() => chatInputRef.current?.focus())
      return
    }

    let cancelled = false
    async function loadBriefingContext() {
      try {
        const res = await authFetch(`/api/agents/briefings/${briefingId}`)
        if (!res.ok) return
        const data = await res.json()
        const briefing = data.briefing as Message | undefined
        if (!cancelled && briefing?.agent_name === agentName) {
          setReplyTo(briefing)
          appliedBriefingIdRef.current = briefingId
          requestAnimationFrame(() => chatInputRef.current?.focus())
        }
      } catch { /* ignore */ }
    }

    loadBriefingContext()
    return () => { cancelled = true }
  }, [agentName, briefingId, messages])

  const handleBeforeSend = useCallback((optimistic: Message) => {
    setMessages(prev => [...prev, optimistic])
    setWorkStartedAt(optimistic.created_at)
    userSentMessage.current = true
    pollBlockedUntil.current = Date.now() + 4000
  }, [])

  const handleSendSuccess = useCallback((tempId: string, realMsg: Message) => {
    if (realMsg) {
      setMessages(prev => prev.map(m => m.id === tempId ? realMsg : m))
      setWorkStartedAt(realMsg.created_at)
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

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom()
  }, [scrollToBottom])

  return (
    <div
      className={cn('agent-chat-page h-full min-h-0 overflow-hidden', dragOver && 'ring-2 ring-inset ring-blue-500/50')}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) chatInputRef.current?.addFiles(e.dataTransfer.files) }}
    >
      <div className="agent-chat-shell grid h-full min-h-0 grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
      <div className="agent-chat-card card relative flex min-h-0 flex-col overflow-hidden">
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-[var(--bg-elev)] via-[var(--bg-elev)]/80 to-transparent z-[5]" />

      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative w-full">
        <div className="agent-chat-messages w-full max-w-4xl mx-auto px-4 sm:px-6 pt-10 pb-5 overflow-hidden break-words">
          {loading ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
              <AgentAvatar agent={meta} size="lg" />
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mt-4">{meta.label}</h2>
              <p className="text-sm text-zinc-500 mt-1">{meta.role}</p>
              <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-4 max-w-sm">
                Schreib eine Nachricht um die Konversation zu starten.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {hasMore && (
                <div className="flex justify-center py-3">
                  {loadingOlder ? (
                    <div className="flex items-center gap-2 text-zinc-400 text-xs">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Lade aeltere Nachrichten...</span>
                    </div>
                  ) : (
                    <button
                      onClick={loadOlderMessages}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 bg-zinc-100 dark:bg-zinc-800/60 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                      Aeltere Nachrichten laden
                    </button>
                  )}
                </div>
              )}
              {messages.map((msg) => {
                const repliedMsg = msg.reply_to_id
                  ? messages.find(m => m.id === msg.reply_to_id)
                  : null

                if (msg.role === 'user') {
                  return (
                    <UserMessageBubble
                      key={msg.id}
                      msg={msg}
                      repliedMsg={repliedMsg ?? null}
                      onReply={handleReply}
                      onEdit={handleEditMessage}
                      onRetract={handleRetractMessage}
                    />
                  )
                }

                return <AssistantMessageBubble key={msg.id} msg={msg} meta={meta} repliedMsg={repliedMsg ?? null} onReply={handleReply} />
              })}

              {permissionPending && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    <AgentAvatar agent={meta} size="sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="rounded-xl border border-amber-300 dark:border-amber-600/50 bg-amber-50 dark:bg-amber-950/30 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <ShieldAlert className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
                        <span className="text-[13px] font-semibold text-amber-800 dark:text-amber-300">
                          {meta.label} braucht eine Genehmigung
                        </span>
                      </div>
                      {permissionPrompt && (
                        <pre className="text-[12px] font-mono text-amber-700 dark:text-amber-400/80 bg-amber-100/60 dark:bg-amber-900/30 rounded-lg p-3 mb-3 whitespace-pre-wrap leading-relaxed">
                          {permissionPrompt}
                        </pre>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleApprove('allow_always')}
                          disabled={!!approvingAction}
                          className="px-3 py-1.5 text-[12px] font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                        >
                          {approvingAction === 'allow_always' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Immer erlauben'}
                        </button>
                        <button
                          onClick={() => handleApprove('allow_once')}
                          disabled={!!approvingAction}
                          className="px-3 py-1.5 text-[12px] font-medium rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                        >
                          {approvingAction === 'allow_once' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Einmal erlauben'}
                        </button>
                        <button
                          onClick={() => handleApprove('deny')}
                          disabled={!!approvingAction}
                          className="px-3 py-1.5 text-[12px] font-medium rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 transition-colors"
                        >
                          {approvingAction === 'deny' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Ablehnen'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {controlStatus && (
                <div className="mx-auto max-w-xl rounded-full border border-[var(--border)] bg-[var(--bg-sunk)] px-4 py-2 text-center text-xs text-[var(--fg-muted)]">
                  {controlStatus}
                </div>
              )}

              {waitingForReply && !permissionPending && (() => {
                const isSlowish = workTimer > 60 && workTimer <= 120
                const isStuck = workTimer > 120
                const dotColor = isStuck ? 'bg-red-500' : isSlowish ? 'bg-amber-500' : 'bg-emerald-500'
                const statusText = isStuck
                  ? `${meta.label} scheint zu haengen`
                  : `${meta.label} arbeitet`
                const statusColor = isStuck ? 'text-red-500 dark:text-red-400' : isSlowish ? 'text-amber-500 dark:text-amber-400' : 'text-zinc-500'

                const mins = Math.floor(workTimer / 60)
                const secs = workTimer % 60
                const timerStr = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`

                return (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    <AgentAvatar agent={meta} size="sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="flex gap-1">
                        <span className={cn('w-1.5 h-1.5 rounded-full animate-bounce', dotColor)} style={{ animationDelay: '0ms' }} />
                        <span className={cn('w-1.5 h-1.5 rounded-full animate-bounce', dotColor)} style={{ animationDelay: '150ms' }} />
                        <span className={cn('w-1.5 h-1.5 rounded-full animate-bounce', dotColor)} style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className={cn('text-[13px]', statusColor)}>{statusText}</span>
                      <span className="text-[12px] text-zinc-400 dark:text-zinc-500 tabular-nums font-mono">{timerStr}</span>
                    </div>
                    {isStuck && (
                      <p className="text-[11px] text-red-500/70 mt-1">
                        Keine Antwort seit {mins} Min — Bot pruefen
                      </p>
                    )}
                  </div>
                </div>
                )
              })()}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[var(--bg-elev)] via-[var(--bg-elev)]/90 to-transparent z-[5]" />

      {taskProposal && (
        <div className="agent-chat-proposal relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 pb-3">
          <div className="rounded-2xl border border-purple-200 dark:border-purple-500/30 bg-purple-50/90 dark:bg-purple-950/30 shadow-lg shadow-purple-950/5 backdrop-blur">
            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-purple-200/70 dark:border-purple-500/20">
              <div className="flex items-start gap-2 min-w-0">
                <div className="mt-0.5 rounded-xl bg-purple-600 text-white p-1.5">
                  <Plus className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300">Task Proposal</p>
                  <p className="text-xs text-purple-700/70 dark:text-purple-300/70">
                    Agent-Vorschlag prüfen, anpassen und erst dann als Task erstellen.
                  </p>
                </div>
              </div>
              <button
                onClick={dismissTaskProposal}
                className="p-1 rounded-lg text-purple-500 hover:bg-purple-100 dark:hover:bg-purple-500/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto]">
              <div className="space-y-2 min-w-0">
                <input
                  value={taskProposal.title}
                  onChange={e => setTaskProposal(current => current ? { ...current, title: e.target.value } : current)}
                  className="w-full bg-white/80 dark:bg-zinc-950/60 border border-purple-200 dark:border-purple-500/20 rounded-xl px-3 py-2 text-sm font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
                <textarea
                  value={taskProposal.description}
                  onChange={e => setTaskProposal(current => current ? { ...current, description: e.target.value } : current)}
                  rows={3}
                  className="w-full bg-white/80 dark:bg-zinc-950/60 border border-purple-200 dark:border-purple-500/20 rounded-xl px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-purple-500/30 resize-none"
                />
              </div>

              <div className="flex sm:flex-col gap-2 sm:w-40">
                <select
                  value={taskProposal.priority}
                  onChange={e => setTaskProposal(current => current ? { ...current, priority: e.target.value as TaskProposalDraft['priority'] } : current)}
                  className="flex-1 sm:flex-none rounded-xl border border-purple-200 dark:border-purple-500/20 bg-white/80 dark:bg-zinc-950/60 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 focus:outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
                <button
                  onClick={createTaskFromProposal}
                  disabled={!taskProposal.title.trim() || taskProposal.status === 'creating' || taskProposal.status === 'created'}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
                >
                  {taskProposal.status === 'creating' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : taskProposal.status === 'created' ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  {taskProposal.status === 'created' ? 'Erstellt' : 'Task erstellen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ChatInput
        ref={chatInputRef}
        agentName={agentName}
        meta={meta}
        replyTo={replyTo}
        onClearReply={handleClearReply}
        onBeforeSend={handleBeforeSend}
        onSendSuccess={handleSendSuccess}
        onSendFail={handleSendFail}
        showScrollDown={showScrollDown}
        onScrollToBottom={handleScrollToBottom}
        keyboardOpen={keyboardOpen}
        hideDisclaimer
        variant="handoff"
        placeholder={`Schreib an ${meta.label}...`}
        editingMessage={editingMessage}
        onCancelEdit={handleCancelEdit}
        onEditSuccess={handleEditSuccess}
        onCommand={handleCommand}
      />
      </div>
      <aside className="hidden min-h-0 flex-col gap-3 overflow-y-auto md:flex">
        <div className="card" style={{ padding: 14 }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--fg-faint)',
              marginBottom: 8,
            }}
          >
            Quick-Befehle
          </div>
          {([
            ['/brief', 'Heutiges Briefing als TL;DR'],
            ['/draft', 'Task-Draft aus letztem Briefing'],
            ['/audit', 'Watchlist & Quellen pruefen'],
            ['/handoff', 'An anderen Agent uebergeben'],
          ] as const).map(([cmd, lbl]) => (
            <button
              key={cmd}
              type="button"
              onClick={() => {
                chatInputRef.current?.setValue(cmd + ' ')
              }}
              className="w-full text-left"
              style={{
                display: 'flex',
                gap: 8,
                padding: '7px 4px',
                fontSize: 12.5,
                cursor: 'pointer',
                background: 'transparent',
                border: 0,
                color: 'inherit',
                borderRadius: 8,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <span
                className="mono"
                style={{
                  color: 'var(--accent)',
                  fontWeight: 600,
                  flex: 'none',
                  minWidth: 60,
                }}
              >
                {cmd}
              </span>
              <span
                style={{
                  color: 'var(--fg-muted)',
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {lbl}
              </span>
            </button>
          ))}
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--fg-faint)',
              marginBottom: 8,
            }}
          >
            Aktiver Kontext
          </div>
          <div className="row gap-2" style={{ padding: '7px 0', fontSize: 12.5 }}>
            <Folder size={12} style={{ color: 'var(--fg-subtle)' }} />
            Workspace: <b>{meta.role}</b>
          </div>
          <div className="row gap-2" style={{ padding: '7px 0', fontSize: 12.5 }}>
            <FileTextIcon size={12} style={{ color: 'var(--fg-subtle)' }} />
            {briefingId ? (
              <>Briefing: <b>verbunden</b></>
            ) : (
              <>Letztes Briefing: <b>—</b></>
            )}
          </div>
          <div className="row gap-2" style={{ padding: '7px 0', fontSize: 12.5 }}>
            <Database size={12} style={{ color: 'var(--fg-subtle)' }} />
            {messages.length > 0 ? (
              <><b>{messages.length}</b> Nachrichten im Kontext</>
            ) : (
              <>Kein aktiver Kontext</>
            )}
          </div>
        </div>
      </aside>
      </div>
    </div>
  )
}
