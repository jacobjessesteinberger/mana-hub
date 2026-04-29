'use client'

import { useState, useEffect, useRef, useCallback, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { authFetch } from '@/lib/auth-fetch'
import { AGENTS } from '@/lib/agents-meta'
import { cn } from '@/lib/utils'
import {
  Search, LayoutDashboard, Bot, MessageCircle, ListTodo, Target,
  RefreshCw, BookOpen, X,
  SquarePen, Inbox, ArrowRight, FolderKanban, ShieldCheck, Newspaper, Puzzle, Rocket,
} from 'lucide-react'

interface CommandItem {
  id: string
  label: string
  description?: string
  href: string
  icon: typeof LayoutDashboard
  category: 'navigation' | 'agents' | 'issues' | 'actions'
}

const STATIC_ITEMS: CommandItem[] = [
  { id: 'dashboard', label: 'Dashboard', description: 'Hauptuebersicht', href: '/dashboard/agents', icon: LayoutDashboard, category: 'navigation' },
  { id: 'agents', label: 'AI Control Center', description: 'Agent-Dashboard', href: '/dashboard/agents', icon: Bot, category: 'navigation' },
  { id: 'issues', label: 'Tasks', description: 'Alle Tasks', href: '/dashboard/agents/issues', icon: ListTodo, category: 'navigation' },
  { id: 'workspaces', label: 'Workspaces', description: 'Agent-Arbeitsraeume', href: '/dashboard/agents/projects', icon: FolderKanban, category: 'navigation' },
  { id: 'outcomes', label: 'Outcomes', description: 'Ziele und OKRs', href: '/dashboard/agents/goals', icon: Target, category: 'navigation' },
  { id: 'briefings', label: 'Briefings', description: 'Reports und Agent-Drops', href: '/dashboard/agents/briefings', icon: Newspaper, category: 'navigation' },
  { id: 'review-queue', label: 'Risk Approval', description: 'Riskante Agent-Aktionen freigeben', href: '/dashboard/agents/approvals', icon: ShieldCheck, category: 'navigation' },
  { id: 'automations', label: 'Jobs & Skills', description: 'Geplante Agent-Jobs und genutzte Skills', href: '/dashboard/agents/routines', icon: RefreshCw, category: 'navigation' },
  { id: 'skill-hub', label: 'Skill Hub', description: 'Company-Skills pruefen, installieren und Agents zuweisen', href: '/dashboard/agents/skills', icon: Puzzle, category: 'navigation' },
  { id: 'setup', label: 'Setup', description: 'Installation, Supabase, Auth und eigene Agents einrichten', href: '/dashboard/agents/setup', icon: Rocket, category: 'navigation' },
  { id: 'inbox', label: 'Inbox', description: 'Benachrichtigungen', href: '/dashboard/agents/inbox', icon: Inbox, category: 'navigation' },
  { id: 'knowledge', label: 'Knowledge Base', description: 'Wissensdatenbank', href: '/dashboard/agents/knowledge', icon: BookOpen, category: 'navigation' },

  // Actions
  { id: 'new-issue', label: 'Neue Task', description: 'Task erstellen', href: '/dashboard/agents/issues?new=true', icon: SquarePen, category: 'actions' },
]

const AGENT_ITEMS: CommandItem[] = AGENTS.map(a => ({
  id: `agent-${a.name}`,
  label: a.label,
  description: a.role,
  href: `/dashboard/agents/${a.name}`,
  icon: Bot,
  category: 'agents' as const,
}))

const AGENT_CHAT_ITEMS: CommandItem[] = AGENTS.map(a => ({
  id: `chat-${a.name}`,
  label: `Chat mit ${a.label}`,
  description: a.fullName,
  href: `/dashboard/agents/${a.name}/chat`,
  icon: MessageCircle,
  category: 'agents' as const,
}))

const CATEGORY_LABELS: Record<string, string> = {
  actions: 'Aktionen',
  agents: 'Agents',
  navigation: 'Navigation',
  issues: 'Tasks',
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [issueItems, setIssueItems] = useState<CommandItem[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const fetchIssues = useCallback(async () => {
    try {
      const res = await authFetch(`/api/agents/issues?limit=20&_t=${Date.now()}`)
      const data = await res.json()
      const issues = (data.issues || []) as { id: string; issue_key: string; title: string; status: string; agent_name: string }[]
      setIssueItems(
        issues
          .filter(i => i.status !== 'done')
          .map(i => ({
            id: `issue-${i.id}`,
            label: `${i.issue_key}: ${i.title}`,
            description: `${i.status} — ${i.agent_name || 'unassigned'}`,
            href: `/dashboard/agents/issues/${i.id}`,
            icon: ListTodo,
            category: 'issues' as const,
          }))
      )
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    function onOpenEvent() {
      setOpen(true)
    }
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('ah:open-command-palette', onOpenEvent as EventListener)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('ah:open-command-palette', onOpenEvent as EventListener)
    }
  }, [])

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
      fetchIssues()
    }
  }, [fetchIssues, open])

  const allItems = [...STATIC_ITEMS, ...AGENT_ITEMS, ...AGENT_CHAT_ITEMS, ...issueItems]

  const filtered = query.trim()
    ? allItems.filter(item => {
        const q = query.toLowerCase()
        return (
          item.label.toLowerCase().includes(q) ||
          (item.description?.toLowerCase().includes(q)) ||
          item.id.toLowerCase().includes(q)
        )
      })
    : allItems

  // Group by category
  const grouped = new Map<string, CommandItem[]>()
  for (const item of filtered) {
    const list = grouped.get(item.category) || []
    list.push(item)
    grouped.set(item.category, list)
  }
  const flatFiltered = filtered

  // Keyboard navigation
  useEffect(() => {
    setSelectedIdx(0)
  }, [query])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(prev => Math.min(prev + 1, flatFiltered.length - 1))
      scrollToSelected()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(prev => Math.max(prev - 1, 0))
      scrollToSelected()
    } else if (e.key === 'Enter' && flatFiltered[selectedIdx]) {
      e.preventDefault()
      navigate(flatFiltered[selectedIdx].href)
    }
  }

  function scrollToSelected() {
    requestAnimationFrame(() => {
      const el = listRef.current?.querySelector('[data-selected="true"]')
      el?.scrollIntoView({ block: 'nearest' })
    })
  }

  function navigate(href: string) {
    setOpen(false)
    router.push(href)
  }

  if (!open) return null

  let flatIndex = -1

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div className="relative w-full max-w-xl mx-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700/50 shadow-2xl shadow-black/20 dark:shadow-black/50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 border-b border-zinc-200 dark:border-zinc-800">
          <Search className="w-5 h-5 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Suche nach Seiten, Agents, Tasks..."
            className="flex-1 py-3.5 text-sm bg-transparent text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
          />
          <div className="flex items-center gap-1.5">
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-700">
              ESC
            </kbd>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition-colors sm:hidden"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2">
          {flatFiltered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
              Keine Ergebnisse fuer &ldquo;{query}&rdquo;
            </div>
          ) : (
            [...grouped.entries()].map(([category, items]) => (
              <Fragment key={category}>
                <div className="px-4 pt-3 pb-1.5">
                  <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                    {CATEGORY_LABELS[category] || category}
                  </span>
                </div>
                {items.map(item => {
                  flatIndex++
                  const idx = flatIndex
                  const isSelected = idx === selectedIdx
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      data-selected={isSelected}
                      onClick={() => navigate(item.href)}
                      onMouseEnter={() => setSelectedIdx(idx)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        isSelected
                          ? 'bg-purple-50 dark:bg-purple-500/10'
                          : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                      )}
                    >
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                        isSelected
                          ? 'bg-purple-100 dark:bg-purple-500/20'
                          : 'bg-zinc-100 dark:bg-zinc-800'
                      )}>
                        <Icon className={cn(
                          'w-4 h-4',
                          isSelected
                            ? 'text-purple-600 dark:text-purple-400'
                            : 'text-zinc-400 dark:text-zinc-500'
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-sm font-medium truncate',
                          isSelected
                            ? 'text-purple-700 dark:text-purple-300'
                            : 'text-zinc-900 dark:text-white'
                        )}>
                          {item.label}
                        </p>
                        {item.description && (
                          <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate">
                            {item.description}
                          </p>
                        )}
                      </div>
                      {isSelected && (
                        <ArrowRight className="w-4 h-4 text-purple-400 dark:text-purple-500 flex-shrink-0" />
                      )}
                    </button>
                  )
                })}
              </Fragment>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-4 text-[10px] text-zinc-400 dark:text-zinc-500">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">↑↓</kbd> navigieren
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">↵</kbd> oeffnen
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">esc</kbd> schliessen
          </span>
        </div>
      </div>
    </div>
  )
}
