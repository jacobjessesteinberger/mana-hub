'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface SidebarState {
  open: boolean
  collapsed: boolean
  setOpen: (v: boolean) => void
  setCollapsed: (v: boolean) => void
  toggle: () => void
  toggleCollapsed: () => void
}

const SidebarCtx = createContext<SidebarState | null>(null)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const toggle = useCallback(() => setOpen(v => !v), [])
  const toggleCollapsed = useCallback(() => setCollapsed(v => !v), [])
  return (
    <SidebarCtx.Provider value={{ open, collapsed, setOpen, setCollapsed, toggle, toggleCollapsed }}>
      {children}
    </SidebarCtx.Provider>
  )
}

export function useSidebar(): SidebarState {
  const ctx = useContext(SidebarCtx)
  if (!ctx) return { open: false, collapsed: false, setOpen: () => {}, setCollapsed: () => {}, toggle: () => {}, toggleCollapsed: () => {} }
  return ctx
}
