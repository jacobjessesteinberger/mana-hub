'use client'

import { usePathname } from 'next/navigation'
import AgentSidebar from '@/components/layout/AgentSidebar'
import AgentTopbar from '@/components/layout/AgentTopbar'
import CommandPalette from '@/components/layout/CommandPalette'
import MobileTabBar from '@/components/layout/MobileTabBar'
import { SidebarProvider } from '@/components/layout/SidebarContext'
import { manaHubConfig } from '@/lib/mana-hub-config'

export default function AgentsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isAgentChat = /^\/dashboard\/agents\/[^/]+\/chat(?:\/)?$/.test(pathname || '')
  const isBriefings = pathname === '/dashboard/agents/briefings'
  const viewportLocked = isAgentChat || isBriefings

  return (
    <SidebarProvider>
      <div className="mana-hub-shell has-mobile-tabbar" style={{ display: 'flex', width: '100%' }}>
        <AgentSidebar />
        <main
          className="mana-hub-main"
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <AgentTopbar />
          <div
            className="mana-hub-content-scroll"
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflowX: 'hidden',
              overflowY: viewportLocked ? 'hidden' : 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {children}
          </div>
        </main>
      </div>
      {manaHubConfig.shell.showSearch ? <CommandPalette /> : null}
      <MobileTabBar />
    </SidebarProvider>
  )
}
