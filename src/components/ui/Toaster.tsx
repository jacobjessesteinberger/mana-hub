'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, CheckCircle, AlertCircle, Info, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'

const ALLOWED_HREF_PREFIXES = ['/dashboard/', '/login']

function isSafeHref(href: string): boolean {
  return ALLOWED_HREF_PREFIXES.some(prefix => href.startsWith(prefix))
}

type ToastType = 'success' | 'error' | 'info' | 'agent'

interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
  action?: { label: string; href: string }
  duration?: number
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

const ICON: Record<ToastType, ReactNode> = {
  success: <CheckCircle className="w-4 h-4 text-emerald-400" />,
  error: <AlertCircle className="w-4 h-4 text-red-400" />,
  info: <Info className="w-4 h-4 text-blue-400" />,
  agent: <Bot className="w-4 h-4 text-purple-400" />,
}

const BORDER_COLOR: Record<ToastType, string> = {
  success: 'border-l-emerald-500',
  error: 'border-l-red-500',
  info: 'border-l-blue-500',
  agent: 'border-l-purple-500',
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -80, scale: 0.95 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={cn(
        'relative flex items-start gap-3 px-4 py-3 rounded-xl border-l-[3px] min-w-[280px] max-w-[380px]',
        'bg-zinc-900/95 backdrop-blur-xl border border-white/[0.06] shadow-2xl shadow-black/40',
        BORDER_COLOR[toast.type]
      )}
    >
      <div className="mt-0.5 flex-shrink-0">{ICON[toast.type]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white leading-snug">{toast.title}</p>
        {toast.description && (
          <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{toast.description}</p>
        )}
        {toast.action && isSafeHref(toast.action.href) && (
          <a
            href={toast.action.href}
            className="inline-block text-xs text-blue-400 hover:text-blue-300 mt-1.5 font-medium transition-colors"
          >
            {toast.action.label}
          </a>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 p-0.5 rounded hover:bg-white/[0.08] transition-colors"
      >
        <X className="w-3.5 h-3.5 text-zinc-500" />
      </button>
    </motion.div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const newToast = { ...toast, id }
    setToasts(prev => [...prev.slice(-4), newToast])

    const duration = toast.duration ?? 5000
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 left-4 z-[9999] flex flex-col-reverse gap-2 pointer-events-auto">
        <AnimatePresence mode="popLayout">
          {toasts.map(toast => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
