'use client'

import { useState } from 'react'
import { BookOpen, Boxes, FileText, Search } from 'lucide-react'
import type { ModuleSpec } from './ModuleSection'

export interface DocFileEntry {
  slug: string
  title: string
  group: string
}

interface Props {
  modules: ModuleSpec[]
  docs: DocFileEntry[]
  activeKey: string
  onSelect: (key: string) => void
}

interface OverviewItem {
  key: string
  label: string
}

const OVERVIEW: OverviewItem[] = [
  { key: 'hero', label: 'Architektur' },
]

export default function DocsSidebar({ modules, docs, activeKey, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  const filteredOverview = q
    ? OVERVIEW.filter(o => o.label.toLowerCase().includes(q))
    : OVERVIEW

  const filteredModules = q
    ? modules.filter(m =>
        m.title.toLowerCase().includes(q) ||
        m.summary.toLowerCase().includes(q) ||
        m.eyebrow.toLowerCase().includes(q),
      )
    : modules

  const filteredDocs = q
    ? docs.filter(d => d.title.toLowerCase().includes(q) || d.slug.includes(q))
    : docs

  const docsByGroup = (() => {
    const map = new Map<string, DocFileEntry[]>()
    for (const doc of filteredDocs) {
      const list = map.get(doc.group) || []
      list.push(doc)
      map.set(doc.group, list)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  })()

  const isActive = (key: string) => key === activeKey

  return (
    <aside className="card docs-sidebar">
      <div className="row gap-2" style={{ alignItems: 'center', marginBottom: 8 }}>
        <BookOpen size={14} />
        <strong style={{ fontSize: 13 }}>Inhalt</strong>
      </div>

      <div style={{ position: 'relative', marginBottom: 4 }}>
        <Search
          size={12}
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--fg-faint)',
          }}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Suchen…"
          className="docs-sidebar-search"
          style={{ paddingLeft: 28 }}
        />
      </div>

      {filteredOverview.length > 0 ? (
        <div className="docs-sidebar-group">
          <div className="docs-sidebar-group-title">Überblick</div>
          {filteredOverview.map(item => (
            <button
              key={item.key}
              type="button"
              className={`docs-sidebar-item${isActive(item.key) ? ' is-active' : ''}`}
              onClick={() => onSelect(item.key)}
            >
              <Boxes size={13} className="docs-sidebar-item-icon" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}

      {filteredModules.length > 0 ? (
        <div className="docs-sidebar-group">
          <div className="docs-sidebar-group-title">Module</div>
          {filteredModules.map(m => (
            <button
              key={m.id}
              type="button"
              className={`docs-sidebar-item${isActive(m.id) ? ' is-active' : ''}`}
              onClick={() => onSelect(m.id)}
            >
              <Boxes size={13} className="docs-sidebar-item-icon" />
              <span>{m.title}</span>
            </button>
          ))}
        </div>
      ) : null}

      {docsByGroup.map(([group, items]) => (
        <div key={group} className="docs-sidebar-group">
          <div className="docs-sidebar-group-title">{group}</div>
          {items.map(d => (
            <button
              key={d.slug}
              type="button"
              className={`docs-sidebar-item${isActive(`doc/${d.slug}`) ? ' is-active' : ''}`}
              onClick={() => onSelect(`doc/${d.slug}`)}
            >
              <FileText size={13} className="docs-sidebar-item-icon" />
              <span>{d.title}</span>
            </button>
          ))}
        </div>
      ))}

      {filteredOverview.length === 0 && filteredModules.length === 0 && docsByGroup.length === 0 ? (
        <div className="docs-empty">Keine Treffer für &bdquo;{query}&ldquo;</div>
      ) : null}
    </aside>
  )
}
