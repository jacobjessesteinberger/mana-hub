'use client'

import { memo, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ExternalLink, FileText, Loader2 } from 'lucide-react'
import { authFetch } from '@/lib/auth-fetch'

interface DocResponse {
  slug: string
  title: string
  content: string
}

interface Props {
  slug: string
  githubBase?: string
}

const DEFAULT_GITHUB_BASE = 'https://github.com/jesse-media/mana-hub-starter/blob/main/docs'

function slugifyHeading(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

function extractHeadingText(children: React.ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(extractHeadingText).join('')
  if (children && typeof children === 'object' && 'props' in (children as object)) {
    const props = (children as { props?: { children?: React.ReactNode } }).props
    if (props?.children) return extractHeadingText(props.children)
  }
  return ''
}

const Renderer = memo(function Renderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => {
          const id = slugifyHeading(extractHeadingText(children))
          return <h1 id={id} className="docs-h1">{children}</h1>
        },
        h2: ({ children }) => {
          const id = slugifyHeading(extractHeadingText(children))
          return <h2 id={id} className="docs-h2">{children}</h2>
        },
        h3: ({ children }) => {
          const id = slugifyHeading(extractHeadingText(children))
          return <h3 id={id} className="docs-h3">{children}</h3>
        },
        h4: ({ children }) => <h4 className="docs-h4">{children}</h4>,
        p: ({ children }) => <p className="docs-p">{children}</p>,
        ul: ({ children }) => <ul className="docs-ul">{children}</ul>,
        ol: ({ children }) => <ol className="docs-ol">{children}</ol>,
        li: ({ children }) => <li className="docs-li">{children}</li>,
        strong: ({ children }) => <strong className="docs-strong">{children}</strong>,
        em: ({ children }) => <em className="docs-em">{children}</em>,
        code: ({ children, className }) => {
          const isInline = !className
          if (isInline) {
            return <code className="docs-code-inline">{children}</code>
          }
          return <code className={className}>{children}</code>
        },
        pre: ({ children }) => <pre className="docs-pre">{children}</pre>,
        blockquote: ({ children }) => <blockquote className="docs-blockquote">{children}</blockquote>,
        hr: () => <hr className="docs-hr" />,
        a: ({ href, children }) => {
          const isExternal = href && /^https?:\/\//.test(href)
          return (
            <a
              href={href}
              target={isExternal ? '_blank' : undefined}
              rel={isExternal ? 'noopener noreferrer' : undefined}
              className="docs-link"
            >
              {children}
            </a>
          )
        },
        table: ({ children }) => (
          <div className="docs-table-wrap">
            <table className="docs-table">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="docs-th">{children}</th>,
        td: ({ children }) => <td className="docs-td">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
})

export default function MarkdownDoc({ slug, githubBase = DEFAULT_GITHUB_BASE }: Props) {
  const [doc, setDoc] = useState<DocResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setLoading(true)
      setError(null)
    })
    authFetch(`/api/docs/${slug}`)
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(`HTTP ${res.status}${text ? `: ${text.slice(0, 120)}` : ''}`)
        }
        return res.json() as Promise<DocResponse>
      })
      .then((data) => {
        if (cancelled) return
        setDoc(data)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Konnte Doku nicht laden')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [slug])

  if (loading) {
    return (
      <div className="card" style={{ padding: 32, display: 'flex', justifyContent: 'center' }}>
        <Loader2 size={18} className="animate-spin" style={{ color: 'var(--fg-subtle)' }} />
      </div>
    )
  }

  if (error || !doc) {
    return (
      <div className="card" style={{ padding: 22 }}>
        <div className="row gap-2" style={{ alignItems: 'center', marginBottom: 6 }}>
          <FileText size={15} style={{ color: 'var(--err)' }} />
          <strong>Doku konnte nicht geladen werden</strong>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--fg-muted)' }}>{error || 'Unbekannter Fehler'}</div>
      </div>
    )
  }

  const githubUrl = `${githubBase}/${doc.slug}.md`

  return (
    <div className="card docs-doc" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        className="row"
        style={{
          padding: '14px 22px',
          borderBottom: '1px solid var(--border)',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          background: 'var(--bg-elev)',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-faint)' }}>
            docs/{doc.slug}.md
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{doc.title}</div>
        </div>
        <a
          href={githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-sm"
          style={{ flex: 'none' }}
        >
          <ExternalLink size={12} /> Auf GitHub
        </a>
      </div>
      <div style={{ padding: '22px 26px' }}>
        <Renderer content={doc.content} />
      </div>
    </div>
  )
}
