'use client'

import { Loader2 } from 'lucide-react'
import { AuthProvider, useAuth } from '@/lib/auth/AuthContext'
import { ToastProvider } from '@/components/ui/Toaster'
import { NotificationProvider } from '@/lib/notifications/NotificationContext'
import AgentRealtimeListener from '@/components/realtime/AgentRealtimeListener'
import QuickChatWidget from '@/components/chat/QuickChatWidget'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  )
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
      </div>
    )
  }

  return (
    <ToastProvider>
      <NotificationProvider>
        <AgentRealtimeListener />
        <main className="mana-hub-dashboard-frame">
          {children}
        </main>
        <QuickChatWidget />
      </NotificationProvider>
    </ToastProvider>
  )
}
