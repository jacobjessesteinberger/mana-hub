'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Rocket } from 'lucide-react'
import { authFetch } from '@/lib/auth-fetch'
import ArchitectureHero from '@/components/docs/ArchitectureHero'
import DocsSidebar, { type DocFileEntry } from '@/components/docs/DocsSidebar'
import MarkdownDoc from '@/components/docs/MarkdownDoc'
import ModuleSection from '@/components/docs/ModuleSection'
import { MODULE_SPECS } from '@/components/docs/module-specs'

const GITHUB_REPO_BASE = 'https://github.com/jacobjessesteinberger/mana-hub'
const GITHUB_DOCS_BASE = `${GITHUB_REPO_BASE}/blob/main/docs`

type ActiveKey = string

function parseHash(): ActiveKey {
  if (typeof window === 'undefined') return 'hero'
  const raw = window.location.hash.replace(/^#/, '').trim()
  return raw || 'hero'
}

export default function DocsPage() {
  const [docs, setDocs] = useState<DocFileEntry[]>([])
  const [activeKey, setActiveKey] = useState<ActiveKey>('hero')
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    authFetch('/api/docs')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<{ files: DocFileEntry[] }>
      })
      .then((data) => {
        if (cancelled) return
        setDocs(data.files || [])
      })
      .catch((err) => {
        console.error('[docs page] failed to load index:', err)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    queueMicrotask(() => setActiveKey(parseHash()))
    const onHash = () => setActiveKey(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const isDocView = activeKey.startsWith('doc/')
  const docSlug = isDocView ? activeKey.slice(4) : null

  const handleSelect = useCallback((key: string) => {
    if (typeof window === 'undefined') return
    if (window.location.hash.replace(/^#/, '') === key) {
      setActiveKey(key)
    } else {
      window.location.hash = key
    }
  }, [])

  // Inline-Module/Hero-View: nach Hash-Wechsel zur passenden Section scrollen.
  useEffect(() => {
    if (isDocView) return
    if (typeof window === 'undefined') return
    if (activeKey === 'hero') {
      heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    const el = document.getElementById(activeKey)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activeKey, isDocView])

  // Während scroll im Inline-View: aktiven Sidebar-Eintrag updaten.
  useEffect(() => {
    if (isDocView) return
    const handler = () => {
      const sections = MODULE_SPECS.map(m => m.id)
      let bestId: string | null = null
      let bestTop = -Infinity
      for (const id of sections) {
        const el = document.getElementById(id)
        if (!el) continue
        const top = el.getBoundingClientRect().top - 80
        if (top <= 0 && top > bestTop) {
          bestTop = top
          bestId = id
        }
      }
      const next = bestId || 'hero'
      setActiveKey(prev => (prev === next ? prev : next))
    }
    handler()
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [isDocView])

  const headerSubtitle = useMemo(() => {
    if (isDocView && docSlug) {
      const found = docs.find(d => d.slug === docSlug)
      return found ? `Detail-Doku: ${found.title}` : 'Detail-Dokumentation'
    }
    return 'Lastenheft, Architektur, Modul-Erklärungen und Detail-Dokumentation an einem Ort.'
  }, [isDocView, docSlug, docs])

  return (
    <div className="page fade-in docs-page" style={{ maxWidth: 1280, margin: '0 auto' }}>
      <div className="page-head" style={{ marginBottom: 18 }}>
        <div>
          <div className="eyebrow">Mana Hub Core</div>
          <h1>Documentation</h1>
          <p>{headerSubtitle}</p>
        </div>
        <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
          <Link href="/dashboard/agents/setup" className="btn btn-primary btn-sm">
            <Rocket size={13} /> Setup öffnen
          </Link>
          <a
            href={GITHUB_REPO_BASE}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm"
          >
            <ExternalLink size={12} /> Auf GitHub ansehen
          </a>
        </div>
      </div>

      <div className="docs-shell">
        <DocsSidebar
          modules={MODULE_SPECS}
          docs={docs}
          activeKey={activeKey}
          onSelect={handleSelect}
        />

        <main className="col gap-4" style={{ minWidth: 0 }}>
          {isDocView && docSlug ? (
            <MarkdownDoc slug={docSlug} githubBase={GITHUB_DOCS_BASE} />
          ) : (
            <>
              <div ref={heroRef} id="hero">
                <ArchitectureHero />
              </div>
              {MODULE_SPECS.map(spec => (
                <ModuleSection
                  key={spec.id}
                  spec={spec}
                  onOpenDoc={(slug) => handleSelect(`doc/${slug}`)}
                />
              ))}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
