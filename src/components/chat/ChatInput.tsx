'use client'

import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Send, Loader2, Reply, X, ArrowDown, Paperclip, Image as ImageIcon, FileText, ArrowUpRight, Edit3 } from 'lucide-react'
import { authFetch } from '@/lib/auth-fetch'
import { cn } from '@/lib/utils'
import type { Attachment, Message, ChatAgentMeta } from './types'

export interface ChatInputHandle {
  addFiles: (files: FileList | File[]) => void
  focus: () => void
  setValue: (value: string) => void
}

export interface ChatInputProps {
  agentName: string
  meta: ChatAgentMeta
  replyTo: Message | null
  onClearReply: () => void
  onBeforeSend: (optimistic: Message) => void
  onSendSuccess: (tempId: string, realMsg: Message) => void
  onSendFail: (tempId: string) => void
  showScrollDown: boolean
  onScrollToBottom: () => void
  keyboardOpen: boolean
  /** Compact-Variante fuer Quick-Chat-Widget: kein Hinweistext, kein File-Upload, schmalere Paddings. */
  compact?: boolean
  /** Wenn gesetzt, wird der Disclaimer-Text NICHT angezeigt. */
  hideDisclaimer?: boolean
  /** Wenn true, wird der Datei-Upload-Button ausgeblendet. */
  disableUpload?: boolean
  /** Handoff-Composer wie in der Claude Design Vorlage. */
  variant?: 'default' | 'handoff'
  placeholder?: string
  className?: string
  editingMessage?: Message | null
  onCancelEdit?: () => void
  onEditSuccess?: (originalId: string, editedMessage: Message) => void
  onCommand?: (command: string) => Promise<boolean> | boolean
}

const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput(
  { agentName, meta, replyTo, onClearReply, onBeforeSend, onSendSuccess, onSendFail, showScrollDown, onScrollToBottom, keyboardOpen, compact = false, hideDisclaimer = false, disableUpload = false, variant = 'default', placeholder, className, editingMessage = null, onCancelEdit, onEditSuccess, onCommand },
  ref,
) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => ({
    addFiles(files: FileList | File[]) {
      if (disableUpload) return
      const arr = Array.from(files).slice(0, 5)
      setPendingFiles(prev => [...prev, ...arr].slice(0, 5))
    },
    focus() {
      textareaRef.current?.focus()
    },
    setValue(value: string) {
      setInput(value)
      const el = textareaRef.current
      if (el) {
        el.value = value
        el.style.height = 'auto'
        el.style.height = Math.min(el.scrollHeight, compact ? 120 : 200) + 'px'
        el.focus()
        el.setSelectionRange(value.length, value.length)
      }
    },
  }))

  function removeFile(index: number) {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleTextareaInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, compact ? 120 : 200) + 'px'
  }, [compact])

  async function uploadFiles(files: File[]): Promise<Attachment[]> {
    const attachments: Attachment[] = []
    for (const file of files) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('agent_name', agentName)
      const res = await authFetch('/api/agents/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.attachment) attachments.push(data.attachment)
    }
    return attachments
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if ((!input.trim() && pendingFiles.length === 0) || sending) return

    const content = input.trim()
    if (content.startsWith('/') && onCommand) {
      const handled = await onCommand(content)
      if (handled) {
        setInput('')
        if (textareaRef.current) textareaRef.current.style.height = 'auto'
        return
      }
    }

    if (editingMessage && !editingMessage.id.startsWith('temp-')) {
      setSendError(null)
      setSending(true)
      try {
        const res = await authFetch(`/api/agents/messages/${editingMessage.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'edit', content, stop_agent: true }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to edit message')
        setInput('')
        setPendingFiles([])
        onCancelEdit?.()
        onEditSuccess?.(editingMessage.id, data.message)
        if (textareaRef.current) textareaRef.current.style.height = 'auto'
      } catch (err) {
        console.error('Failed to edit message:', err)
        setSendError('Nachricht konnte nicht bearbeitet werden.')
      } finally {
        setSending(false)
      }
      return
    }

    const filesToUpload = [...pendingFiles]
    const replyId = replyTo?.id.startsWith('temp-') ? undefined : replyTo?.id
    setInput('')
    setPendingFiles([])
    onClearReply()
    setSendError(null)
    setSending(true)
    setUploading(filesToUpload.length > 0)

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    const tempId = `temp-${Date.now()}`
    const optimistic: Message = {
      id: tempId,
      agent_name: agentName,
      role: 'user',
      content: content + (filesToUpload.length > 0 ? `\n\n📎 ${filesToUpload.map(f => f.name).join(', ')}` : ''),
      ticket_id: null,
      reply_to_id: replyId ?? null,
      created_at: new Date().toISOString(),
    }
    onBeforeSend(optimistic)

    try {
      let attachments: Attachment[] = []
      if (filesToUpload.length > 0) {
        attachments = await uploadFiles(filesToUpload)
        setUploading(false)
      }

      const msgContent = attachments.length > 0
        ? content + '\n\n' + attachments.map(a =>
            a.type.startsWith('image/') ? `![${a.name}](${a.url})` : `[📎 ${a.name}](${a.url})`
          ).join('\n')
        : content

      const postRes = await authFetch('/api/agents/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_name: agentName,
          content: msgContent || '📎 Dateien angehängt',
          ...(replyId ? { reply_to_id: replyId } : {}),
          ...(attachments.length > 0 ? { metadata: { attachments } } : {}),
        }),
      })
      const postData = await postRes.json()
      onSendSuccess(tempId, postData.message)
    } catch (err) {
      console.error('Failed to send message:', err)
      onSendFail(tempId)
      setInput(content)
      setPendingFiles(filesToUpload)
      setSendError('Nachricht konnte nicht gesendet werden.')
      setUploading(false)
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(e)
    }
    if (e.key === 'Escape' && replyTo) {
      onClearReply()
      e.preventDefault()
    }
  }

  const isHandoff = variant === 'handoff'

  return (
    <div className={cn('flex-shrink-0 relative z-10', isHandoff ? 'bg-[var(--bg-elev)]' : 'bg-white dark:bg-zinc-950', className)}>
      <div className={cn(
        'absolute -top-10 left-1/2 -translate-x-1/2 transition-all duration-200',
        showScrollDown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      )}>
        <button
          onClick={() => onScrollToBottom()}
          className="p-2 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all shadow-lg"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      </div>

      <div className={cn(
        isHandoff
          ? 'border-t border-[var(--border)] px-3 py-3'
          : compact
            ? 'px-3 pt-0'
            : 'max-w-4xl mx-auto px-4 sm:px-6 pt-0',
        !isHandoff && (keyboardOpen
          ? 'pb-1'
          : compact
            ? 'pb-3'
            : 'pb-[max(env(safe-area-inset-bottom,0px),12px)] md:pb-2')
      )}>
        {sendError && (
          <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-red-500/10 text-red-400 text-xs">
            <span className="flex-1">{sendError}</span>
            <button onClick={() => setSendError(null)} className="p-0.5 hover:text-red-300">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {replyTo && (
          <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border-l-2 border-blue-500">
            <Reply className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-blue-400">
                {replyTo.role === 'user' ? 'You' : meta.label}
              </p>
              <p className="text-xs text-zinc-500 truncate">
                {replyTo.content.substring(0, 120)}
              </p>
            </div>
            <button onClick={() => onClearReply()} className="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {editingMessage && (
          <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-emerald-500/10 border-l-2 border-emerald-500">
            <Edit3 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-emerald-500">Nachricht bearbeiten</p>
              <p className="text-xs text-zinc-500 truncate">{editingMessage.content.substring(0, 120)}</p>
            </div>
            <button onClick={() => { onCancelEdit?.(); setInput('') }} className="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 transition-colors" type="button">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {pendingFiles.length > 0 && (
          <div className="flex gap-2 mb-2 overflow-x-auto scrollbar-none pb-1">
            {pendingFiles.map((file, i) => (
              <div key={i} className="relative shrink-0 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-2 flex items-center gap-2 max-w-[200px]">
                {file.type.startsWith('image/') ? (
                  <ImageIcon className="w-4 h-4 text-blue-400 shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                )}
                <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{file.name}</span>
                <button onClick={() => removeFile(i)} className="shrink-0 p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={sendMessage}>
          {!disableUpload && (
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.csv,.md,.json,.doc,.docx,.xls,.xlsx"
              className="hidden"
              onChange={(e) => { if (e.target.files) { const arr = Array.from(e.target.files).slice(0, 5); setPendingFiles(prev => [...prev, ...arr].slice(0, 5)) } e.target.value = '' }}
            />
          )}
          <div className={cn(
            'relative flex items-end gap-2',
            isHandoff
              ? 'bg-transparent'
              : 'rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-transparent shadow-sm dark:shadow-xl dark:shadow-black/30',
            !isHandoff && (compact ? 'px-2.5 py-2' : 'px-3 py-2.5')
          )}>
            {!disableUpload && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-shrink-0 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              >
                <Paperclip className="w-4 h-4" />
              </button>
            )}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder={editingMessage ? 'Bearbeitete Nachricht senden...' : replyTo ? `Reply to ${replyTo.role === 'user' ? 'your' : meta.label + "'s"} message...` : (placeholder || `Antworten...`)}
              style={
                isHandoff
                  ? {
                      outline: 'none',
                      boxShadow: 'none',
                      WebkitAppearance: 'none',
                      flex: 1,
                      resize: 'none',
                      border: '1px solid var(--border)',
                      borderRadius: 18,
                      padding: '10px 14px',
                      font: '13.5px var(--font-sans)',
                      color: 'var(--fg)',
                      background: 'var(--bg-sunk)',
                      maxHeight: 120,
                      minHeight: 36,
                      lineHeight: 1.2,
                    }
                  : { outline: 'none', border: 'none', boxShadow: 'none', WebkitAppearance: 'none' }
              }
              className={cn(
                !isHandoff && 'flex-1 bg-transparent text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 resize-none border-none outline-none ring-0 focus:ring-0 focus:outline-none focus-visible:outline-none leading-relaxed',
                !isHandoff && (compact ? 'text-[14px] max-h-[120px]' : 'text-[14px] max-h-[200px]')
              )}
              rows={1}
              disabled={sending}
            />
            <button
              type="submit"
              disabled={(!input.trim() && pendingFiles.length === 0) || sending}
              className={cn(
                'flex-shrink-0 transition-all',
                isHandoff ? 'btn btn-icon btn-primary' : 'p-2 rounded-xl',
                isHandoff && 'h-9 w-9 rounded-full',
                !isHandoff && ((input.trim() || pendingFiles.length > 0)
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200'
                  : 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed')
              )}
              style={isHandoff ? { width: 36, height: 36, borderRadius: '50%' } : undefined}
            >
              {sending || uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isHandoff ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>

          {!hideDisclaimer && (
            <p className="text-center text-[11px] text-zinc-400 dark:text-zinc-600 mt-2">
              {meta.label} ist eine KI und kann Fehler machen. Bitte überprüfe die Antworten.
            </p>
          )}
        </form>
      </div>
    </div>
  )
})

export default ChatInput
