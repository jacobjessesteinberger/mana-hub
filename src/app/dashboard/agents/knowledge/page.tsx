"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  ChevronRight,
  FileText,
  FolderOpen,
  Loader2,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/mana-hub'
import { authFetch } from '@/lib/auth-fetch'
import MarkdownContent from '@/components/chat/MarkdownContent'
import { cn } from '@/lib/utils'

interface KBEntry {
  id: string
  path: string
  category: string
  file_name: string
  file_size: number
  modified_at?: string | null
  updated_at?: string | null
}

interface KBData {
  entries: KBEntry[]
  categories: Record<string, KBEntry[]>
  total: number
  last_sync: string | null
}

const CATEGORY_LABELS: Record<string, string> = {
  root: 'Uebersicht',
  firma: 'Firma',
  projekte: 'Projekte',
  agenten: 'Agenten',
  ops: 'Ops',
  team: 'Team',
  finanzen: 'Finanzen',
  workflows: 'Workflows',
  templates: 'Templates',
  log: 'Log',
}

const CATEGORY_ORDER = ['root', 'firma', 'projekte', 'agenten', 'ops', 'team', 'finanzen', 'workflows', 'templates', 'log']

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function relativeSync(iso?: string | null) {
  if (typeof iso !== 'string') return 'indexiert'
  const diff = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(diff)) return 'indexiert'
  const min = Math.max(0, Math.floor(diff / 60000))
  if (min < 60) return `vor ${min} Min`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `vor ${hours} Std`
  return `vor ${Math.floor(hours / 24)} T`
}

export default function KnowledgePage() {
  const [data, setData] = useState<KBData | null>(null)
  const [total, setTotal] = useState(0)
  const [categories, setCategories] = useState(0)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<KBEntry | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [loadingFile, setLoadingFile] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch('/api/knowledge')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Knowledge Base konnte nicht geladen werden')
      const nextData = data as KBData
      setData(nextData)
      setTotal(Number(nextData.total || nextData.entries?.length || 0))
      setCategories(Object.keys(nextData.categories || {}).length)
      setLastSync(typeof nextData.last_sync === 'string' ? nextData.last_sync : null)
      setActiveCategory(current => current && nextData.categories?.[current]?.length ? current : null)
    } catch (err) {
      setData(null)
      setTotal(0)
      setCategories(0)
      setLastSync(null)
      setError(err instanceof Error ? err.message : 'Knowledge Base konnte nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openFile = useCallback(async (entry: KBEntry) => {
    setSelectedFile(entry)
    setLoadingFile(true)
    setFileContent(null)
    setFileError(null)
    try {
      const res = await authFetch(`/api/knowledge/file?id=${entry.id}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Datei konnte nicht geladen werden')
      setFileContent(json.content || '')
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Datei konnte nicht geladen werden')
    } finally {
      setLoadingFile(false)
    }
  }, [])

  const activeEntries = useMemo(() => {
    if (!data) return []
    if (activeCategory) return data.categories?.[activeCategory] || []
    return data.entries || []
  }, [activeCategory, data])

  const categoryCards = useMemo(() => {
    const source = data?.categories || {}
    const ordered = CATEGORY_ORDER.filter(category => source[category]?.length)
    const rest = Object.keys(source).filter(category => !ordered.includes(category) && source[category]?.length)
    return [...ordered, ...rest]
  }, [data?.categories])

  const metrics = useMemo(() => [
    { value: total, label: 'Pages indexed' },
    { value: categories, label: 'Sources' },
    { value: lastSync ? relativeSync(lastSync) : '—', label: 'Last sync' },
  ], [categories, lastSync, total])

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="WISSEN"
        title="Knowledge Base"
        description="Quellen, die deine Agents lesen koennen. Indexiert, durchsuchbar, mit klarer Herkunft."
        badges={lastSync ? <span className="badge">Sync {relativeSync(lastSync)}</span> : undefined}
        actions={
          <>
            <button className="btn btn-sm" type="button" onClick={load}><RefreshCw size={13} />Sync alle</button>
            <button className="btn btn-sm btn-primary" type="button" disabled title="Quellen werden im Starter ueber workspace/knowledge.example und spaeter ueber einen sicheren Upload-Flow hinzugefuegt."><Plus size={13} />Quelle hinzufuegen</button>
          </>
        }
      />

      <div style={{ padding: '0 28px 28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          {metrics.map(metric => (
            <div key={metric.label} className="card" style={{ padding: 14 }}>
              <div className="tabular" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>{metric.value}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{metric.label}</div>
            </div>
          ))}
        </div>

        {error ? <div className="badge badge-err mb-3">{error}</div> : null}

        {loading ? (
          <div className="card" style={{ padding: 24, display: 'flex', justifyContent: 'center' }}><Loader2 size={18} className="animate-spin" /></div>
        ) : !data?.entries?.length ? (
          <div className="card" style={{ padding: 18, fontSize: 13, color: 'var(--fg-muted)' }}>Noch keine Knowledge-Eintraege indexiert.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '260px minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
            <div className="card" style={{ padding: 12 }}>
              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                className={cn('w-full text-left')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '9px 10px',
                  borderRadius: 12,
                  background: activeCategory === null ? 'var(--bg-active)' : 'transparent',
                  color: activeCategory === null ? 'var(--fg)' : 'var(--fg-muted)',
                  fontSize: 12.5,
                  fontWeight: 600,
                }}
              >
                <BookOpen size={14} />
                Alle Dateien
                <span className="spacer" />
                <span className="badge" style={{ height: 18, fontSize: 10 }}>{data.total}</span>
              </button>
              <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
              <div className="col gap-1">
                {categoryCards.map(category => {
                  const count = data.categories[category]?.length || 0
                  const active = activeCategory === category
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setActiveCategory(active ? null : category)}
                      className="w-full text-left"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                        padding: '8px 10px',
                        borderRadius: 12,
                        background: active ? 'var(--bg-active)' : 'transparent',
                        color: active ? 'var(--fg)' : 'var(--fg-muted)',
                        fontSize: 12.5,
                        fontWeight: active ? 600 : 500,
                      }}
                    >
                      <FolderOpen size={13} style={{ color: active ? 'var(--accent)' : 'var(--fg-subtle)' }} />
                      {CATEGORY_LABELS[category] || category}
                      <span className="spacer" />
                      <span style={{ color: 'var(--fg-faint)', fontSize: 11 }}>{count}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="card-hd">
                <h3>{activeCategory ? `${CATEGORY_LABELS[activeCategory] || activeCategory}/` : 'Alle Knowledge-Dateien'}</h3>
                <span className="badge">{activeEntries.length} Dateien</span>
              </div>
              <div>
                {activeEntries.map(entry => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => openFile(entry)}
                    className="w-full text-left"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '24px minmax(0,1fr) auto 18px',
                      gap: 10,
                      alignItems: 'center',
                      padding: '12px 16px',
                      borderTop: '1px solid var(--border)',
                      background: 'transparent',
                    }}
                  >
                    <FileText size={14} style={{ color: 'var(--fg-subtle)' }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {entry.file_name}
                      </div>
                      <div style={{ marginTop: 2, fontSize: 11.5, color: 'var(--fg-subtle)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {entry.path}
                      </div>
                    </div>
                    <div className="row gap-2" style={{ color: 'var(--fg-faint)', fontSize: 11.5 }}>
                      <span>{formatSize(entry.file_size)}</span>
                      <span>·</span>
                      <span>{relativeSync(entry.modified_at || entry.updated_at || null)}</span>
                    </div>
                    <ChevronRight size={14} style={{ color: 'var(--fg-faint)' }} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedFile && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          onClick={() => setSelectedFile(null)}
        >
          <div
            className="card card-overflow-visible"
            style={{ width: 'min(880px, 100%)', maxHeight: '82vh', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={event => event.stopPropagation()}
          >
            <div className="card-hd" style={{ flex: 'none' }}>
              <div className="row gap-2" style={{ minWidth: 0 }}>
                <FileText size={15} style={{ color: 'var(--accent)' }} />
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedFile.file_name}</h3>
                  <div style={{ marginTop: 2, fontSize: 11.5, color: 'var(--fg-subtle)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedFile.path} · {formatSize(selectedFile.file_size)}
                  </div>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" type="button" onClick={() => setSelectedFile(null)}>
                <X size={14} />
              </button>
            </div>
            <div style={{ overflowY: 'auto', padding: 22 }}>
              {loadingFile ? (
                <div style={{ padding: 42, display: 'flex', justifyContent: 'center' }}><Loader2 size={18} className="animate-spin" /></div>
              ) : fileError ? (
                <div className="badge badge-err">{fileError}</div>
              ) : fileContent ? (
                <div className="knowledge-preview">
                  <MarkdownContent content={fileContent} />
                </div>
              ) : (
                <div style={{ color: 'var(--fg-muted)', fontSize: 13 }}>Datei konnte nicht geladen werden.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
