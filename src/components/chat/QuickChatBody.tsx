'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import AgentAvatar from '@/components/ui/AgentAvatar'
import { cn } from '@/lib/utils'
import { UserMessageBubble, AssistantMessageBubble } from './MessageBubbles'
import ChatInput, { type ChatInputHandle } from './ChatInput'
import type { Message, ChatAgentMeta } from './types'

interface QuickChatBodyProps {
  agentName: string
  meta: ChatAgentMeta
  messages: Message[]
  loading: boolean
  waitingForReply: boolean
  workStartedAt?: string | null
  onBeforeSend: (optimistic: Message) => void
  onSendSuccess: (tempId: string, real: Message) => void
  onSendFail: (tempId: string) => void
}

export default function QuickChatBody({
  agentName, meta, messages, loading, waitingForReply,
  workStartedAt, onBeforeSend, onSendSuccess, onSendFail,
}: QuickChatBodyProps) {
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [showScrollDown, setShowScrollDown] = useState(false)
  const [workTimer, setWorkTimer] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<ChatInputHandle>(null)
  const userSentRef = useRef(false)
  const lastMsgIdRef = useRef<string>('')

  useEffect(() => {
    if (!waitingForReply || !workStartedAt) {
      return
    }
    const startedAt = new Date(workStartedAt).getTime()
    const update = () => {
      setWorkTimer(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)))
    }
    const iv = setInterval(update, 1000)
    return () => clearInterval(iv)
  }, [waitingForReply, workStartedAt])

  useEffect(() => {
    if (waitingForReply) {
      requestAnimationFrame(() => {
        const el = scrollRef.current
        if (el) el.scrollTop = el.scrollHeight
      })
    }
  }, [waitingForReply])

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }, [])

  const scrollToBottom = useCallback((instant = false) => {
    const el = scrollRef.current
    if (!el) return
    if (instant) el.scrollTop = el.scrollHeight
    else el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (loading) return
    requestAnimationFrame(() => {
      scrollToBottom(true)
      setTimeout(() => scrollToBottom(true), 80)
    })
  }, [loading, scrollToBottom])

  useEffect(() => {
    const last = messages[messages.length - 1]
    const isNew = last && last.id !== lastMsgIdRef.current
    lastMsgIdRef.current = last?.id || ''

    if (!isNew) return
    if (userSentRef.current) {
      userSentRef.current = false
      scrollToBottom()
      return
    }
    if (isNearBottom()) scrollToBottom()
  }, [messages, scrollToBottom, isNearBottom])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    function onScroll() { setShowScrollDown(!isNearBottom()) }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => { el.removeEventListener('scroll', onScroll) }
  }, [isNearBottom])

  const handleReply = useCallback((m: Message) => setReplyTo(m), [])
  const handleClearReply = useCallback(() => setReplyTo(null), [])

  const handleBeforeSendInner = useCallback((opt: Message) => {
    userSentRef.current = true
    onBeforeSend(opt)
  }, [onBeforeSend])

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="px-3 py-3 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-10">
              <AgentAvatar agent={meta} size="md" />
              <p className="text-[13px] font-semibold text-zinc-900 dark:text-white mt-3">{meta.label}</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-500 mt-1">{meta.role}</p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-600 mt-3 max-w-[220px]">
                Schreib eine Nachricht um die Konversation zu starten.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const replied = msg.reply_to_id ? messages.find(m => m.id === msg.reply_to_id) ?? null : null
              if (msg.role === 'user') {
                return <UserMessageBubble key={msg.id} msg={msg} repliedMsg={replied} onReply={handleReply} />
              }
              return <AssistantMessageBubble key={msg.id} msg={msg} meta={meta} repliedMsg={replied} onReply={handleReply} />
            })
          )}

          {waitingForReply && (() => {
            const isSlowish = workTimer > 60 && workTimer <= 120
            const isStuck = workTimer > 120
            const dotColor = isStuck ? 'bg-red-500' : isSlowish ? 'bg-amber-500' : 'bg-emerald-500'
            const statusColor = isStuck ? 'text-red-500 dark:text-red-400' : isSlowish ? 'text-amber-500 dark:text-amber-400' : 'text-zinc-500 dark:text-zinc-400'
            const statusText = isStuck ? `${meta.label} scheint zu haengen` : `${meta.label} arbeitet`
            const mins = Math.floor(workTimer / 60)
            const secs = workTimer % 60
            const timerStr = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`
            return (
              <div className="flex items-start gap-2 pl-1">
                <div className="flex-shrink-0 mt-0.5">
                  <AgentAvatar agent={meta} size="sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className={cn('w-1.5 h-1.5 rounded-full animate-bounce', dotColor)} style={{ animationDelay: '0ms' }} />
                      <span className={cn('w-1.5 h-1.5 rounded-full animate-bounce', dotColor)} style={{ animationDelay: '150ms' }} />
                      <span className={cn('w-1.5 h-1.5 rounded-full animate-bounce', dotColor)} style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className={cn('text-[11px]', statusColor)}>{statusText}</span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 tabular-nums font-mono">{timerStr}</span>
                  </div>
                  {isStuck && (
                    <p className="text-[10px] text-red-500/70 mt-0.5">
                      Keine Antwort seit {mins} Min - Bot pruefen
                    </p>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      <ChatInput
        ref={inputRef}
        agentName={agentName}
        meta={meta}
        replyTo={replyTo}
        onClearReply={handleClearReply}
        onBeforeSend={handleBeforeSendInner}
        onSendSuccess={onSendSuccess}
        onSendFail={onSendFail}
        showScrollDown={showScrollDown}
        onScrollToBottom={() => scrollToBottom()}
        keyboardOpen={false}
        compact
        hideDisclaimer
        disableUpload
        className="!bg-transparent border-t border-zinc-200/60 dark:border-white/[0.06]"
      />
    </div>
  )
}
