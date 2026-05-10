'use client'

import { memo, useCallback, useRef, useState } from 'react'
import { Check, Copy, Edit3, RotateCcw, Reply } from 'lucide-react'
import { cn, relativeTime } from '@/lib/utils'
import AgentAvatar from '@/components/ui/AgentAvatar'
import MarkdownContent from './MarkdownContent'
import type { Message, ChatAgentMeta } from './types'

function useLongPress(onLongPress: () => void, ms = 400) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const onTouchStart = useCallback(() => {
    timerRef.current = setTimeout(() => {
      onLongPress()
      try { navigator.vibrate?.(10) } catch { /* ignore */ }
    }, ms)
  }, [onLongPress, ms])
  const onTouchEnd = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])
  return { onTouchStart, onTouchEnd, onTouchCancel: onTouchEnd }
}

function useCopyMessage(content: string) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async () => {
    if (!content.trim()) return
    try {
      await navigator.clipboard.writeText(content.trim())
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      setCopied(false)
    }
  }, [content])

  return { copied, copy }
}

export const UserMessageBubble = memo(function UserMessageBubble({
  msg, repliedMsg, onReply, onEdit, onRetract,
}: {
  msg: Message
  repliedMsg: Message | null
  onReply: (msg: Message) => void
  onEdit?: (msg: Message) => void
  onRetract?: (msg: Message) => void
}) {
  const replyHandler = useCallback(() => onReply(msg), [onReply, msg])
  const longPress = useLongPress(replyHandler)
  const lifecycleStatus = msg.metadata?.lifecycle_status || 'active'
  const isRetracted = lifecycleStatus === 'retracted'
  const isSuperseded = lifecycleStatus === 'superseded'
  const canEdit = !msg.id.startsWith('temp-') && !isRetracted && !isSuperseded
  const { copied, copy } = useCopyMessage(msg.content)

  return (
    <div id={`msg-${msg.id}`} className={cn('group flex justify-end', (isRetracted || isSuperseded) && 'opacity-65')}>
      <div className="agent-user-bubble max-w-[80%] flex items-start gap-2">
        <div className="self-center flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isRetracted ? (
            <button onClick={copy} className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-400" title={copied ? 'Copied' : 'Copy'} type="button">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          ) : null}
          <button onClick={replyHandler} className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-400" title="Reply" type="button">
            <Reply className="w-3.5 h-3.5" />
          </button>
          {canEdit && onEdit ? (
            <button onClick={() => onEdit(msg)} className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-400" title="Edit and resend" type="button">
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          ) : null}
          {canEdit && onRetract ? (
            <button onClick={() => onRetract(msg)} className="p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10 text-zinc-400 hover:text-red-600 dark:hover:text-red-400" title="Retract and stop agent" type="button">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
        <div {...longPress}>
          {repliedMsg && (
            <button
              onClick={() => document.getElementById(`msg-${repliedMsg.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              className="flex items-center gap-1.5 px-3 py-1.5 mb-0.5 rounded-t-xl text-[11px] bg-zinc-200/60 dark:bg-zinc-700/50 text-zinc-500 dark:text-zinc-400 border-l-2 border-zinc-300 dark:border-zinc-500 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              <Reply className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{repliedMsg.content.substring(0, 80)}</span>
            </button>
          )}
          <div className={cn(
            'rounded-3xl rounded-br-lg px-4 py-2.5 bg-zinc-100 dark:bg-zinc-700/60 text-[14px] text-zinc-900 dark:text-zinc-100 leading-relaxed',
            repliedMsg && 'rounded-tr-lg',
            isRetracted && 'italic text-zinc-500 dark:text-zinc-400',
          )}>
            <p className="whitespace-pre-wrap">{isRetracted ? 'Message retracted.' : msg.content}</p>
          </div>
          {(msg.metadata?.edited_at || isSuperseded) ? (
            <div className="mt-1 text-right text-[10.5px] text-zinc-400 dark:text-zinc-600">
              {isSuperseded ? 'replaced by edited version' : 'edited'}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
})

export const AssistantMessageBubble = memo(function AssistantMessageBubble({
  msg, meta, repliedMsg, onReply,
}: {
  msg: Message
  meta: ChatAgentMeta
  repliedMsg: Message | null
  onReply: (msg: Message) => void
}) {
  const replyHandler = useCallback(() => onReply(msg), [onReply, msg])
  const longPress = useLongPress(replyHandler)
  const { copied, copy } = useCopyMessage(msg.content)

  return (
    <div id={`msg-${msg.id}`} className="group">
      <div className="agent-assistant-bubble flex items-start gap-3" {...longPress}>
        <div className="flex-shrink-0 mt-1">
          <AgentAvatar agent={meta} size="sm" />
        </div>
        <div className="flex-1 min-w-0">
          {repliedMsg && (
            <button
              onClick={() => document.getElementById(`msg-${repliedMsg.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              className="flex items-center gap-1.5 px-3 py-1.5 mb-2 rounded-lg text-[11px] bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 border-l-2 border-zinc-300 dark:border-zinc-600 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
            >
              <Reply className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{repliedMsg.content.substring(0, 80)}</span>
            </button>
          )}
          <div className="text-[14px] text-zinc-700 dark:text-zinc-300 leading-relaxed dark:prose-invert overflow-x-hidden max-w-full">
            <MarkdownContent content={msg.content} />
          </div>
          <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[11px] text-zinc-400 dark:text-zinc-600">{relativeTime(msg.created_at)}</span>
            <button
              onClick={copy}
              className="flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
              title={copied ? 'Copied' : 'Copy'}
              type="button"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={replyHandler}
              className="flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
            >
              <Reply className="w-3 h-3" /> Reply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})
