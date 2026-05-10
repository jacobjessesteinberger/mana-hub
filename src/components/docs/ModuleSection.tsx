'use client'

import { ChevronRight } from 'lucide-react'

export interface ModuleEndpoint {
  method: string
  path: string
  note?: string
}

export interface ModuleRelatedDoc {
  slug: string
  label: string
}

export interface ModuleSpec {
  id: string
  title: string
  eyebrow: string
  summary: string
  keyConcepts: string[]
  userValue: string
  endpoints?: ModuleEndpoint[]
  relatedDocs?: ModuleRelatedDoc[]
}

interface Props {
  spec: ModuleSpec
  onOpenDoc?: (slug: string) => void
}

export default function ModuleSection({ spec, onOpenDoc }: Props) {
  return (
    <section id={spec.id} className="card docs-module">
      <div className="docs-module-eyebrow">{spec.eyebrow}</div>
      <h2 className="docs-module-title">{spec.title}</h2>
      <p className="docs-module-summary">{spec.summary}</p>

      {spec.keyConcepts.length > 0 ? (
        <>
          <div className="docs-module-section-h">Schlüssel-Konzepte</div>
          <div className="docs-module-pills">
            {spec.keyConcepts.map(c => (
              <span key={c} className="docs-module-pill">{c}</span>
            ))}
          </div>
        </>
      ) : null}

      <div className="docs-module-section-h">Was hat der User davon</div>
      <p className="docs-module-value">{spec.userValue}</p>

      {spec.endpoints && spec.endpoints.length > 0 ? (
        <>
          <div className="docs-module-section-h">Wichtige Endpoints</div>
          <div className="docs-module-endpoints">
            {spec.endpoints.map(ep => (
              <div key={`${ep.method}-${ep.path}`} className="docs-module-endpoint">
                <code>{ep.method}</code>
                <div>
                  <code style={{ marginRight: 8 }}>{ep.path}</code>
                  {ep.note ? <span style={{ color: 'var(--fg-muted)' }}>— {ep.note}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {spec.relatedDocs && spec.relatedDocs.length > 0 ? (
        <>
          <div className="docs-module-section-h">Detail-Dokumentation</div>
          <div className="docs-module-related">
            {spec.relatedDocs.map(doc => (
              <button
                key={doc.slug}
                type="button"
                className="docs-module-related-link"
                onClick={() => onOpenDoc?.(doc.slug)}
              >
                {doc.label}
                <ChevronRight size={11} />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </section>
  )
}
