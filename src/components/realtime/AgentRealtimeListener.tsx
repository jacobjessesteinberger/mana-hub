'use client'

import { useEffect, useRef } from 'react'
import { useToast } from '@/components/ui/Toaster'
import { usePathname } from 'next/navigation'
import { AGENT_MAP } from '@/lib/agents-meta'
import { onAgentEvent } from '@/lib/notifications/NotificationContext'

const STATUS_LABELS: Record<string, string> = {
  todo: 'erstellt',
  in_progress: 'gestartet',
  done: 'abgeschlossen',
  blocked: 'blockiert',
}

export default function AgentRealtimeListener() {
  const { addToast } = useToast()
  const pathname = usePathname()
  const pathnameRef = useRef(pathname)

  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  useEffect(() => {
    const unsub = onAgentEvent((event) => {
      if (event.type === 'message') {
        const msg = event.data as Record<string, string>
        const name = AGENT_MAP[event.agentName]?.label || event.agentName
        const content = (msg.content as string) || ''
        const preview = content.substring(0, 80) + (content.length > 80 ? '…' : '')

        const isOnChatPage = pathnameRef.current === `/dashboard/agents/${event.agentName}/chat`

        addToast({
          type: 'agent',
          title: `${name} hat geantwortet`,
          description: preview,
          action: isOnChatPage
            ? undefined
            : { label: 'Chat öffnen', href: `/dashboard/agents/${event.agentName}/chat` },
          duration: 6000,
        })
      }

      if (event.type === 'issue_update') {
        const issue = event.data as Record<string, string>
        if (!issue.status || !issue.id) return

        const label = STATUS_LABELS[issue.status] || issue.status
        const agent = issue.agent_name
          ? ` · ${AGENT_MAP[issue.agent_name]?.label || issue.agent_name}`
          : ''

        addToast({
          type: issue.status === 'done' ? 'success' : issue.status === 'blocked' ? 'error' : 'info',
          title: `${issue.issue_key || 'Task'} ${label}`,
          description: `${issue.title || ''}${agent}`,
          action: { label: 'Task ansehen', href: `/dashboard/agents/issues/${issue.id}` },
        })
      }
    })

    return unsub
  }, [addToast])

  return null
}
