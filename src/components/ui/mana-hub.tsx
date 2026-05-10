'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

export function AHCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn('card', className)}>{children}</div>
}

export function AHCardHeader({
  title,
  actions,
  className,
}: {
  title: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('card-hd', className)}>
      <h3>{title}</h3>
      {actions ? <div className="row gap-2">{actions}</div> : null}
    </div>
  )
}

export function AHCardBody({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn('card-bd', className)}>{children}</div>
}

export function AHPill({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'accent' | 'ok' | 'warn' | 'danger' | 'err' | 'info' | 'demo' | 'prod'
  className?: string
}) {
  const tones: Record<string, string> = {
    neutral: '',
    accent: 'badge-accent',
    ok: 'badge-ok',
    warn: 'badge-warn',
    danger: 'badge-err',
    err: 'badge-err',
    info: 'badge-info',
    demo: 'badge-demo',
    prod: 'badge-ok',
  }
  return <span className={cn('badge', tones[tone], className)}>{children}</span>
}

export function AHDot({ tone = 'neutral' }: { tone?: 'ok' | 'warn' | 'err' | 'danger' | 'info' | 'neutral' }) {
  const map: Record<string, string> = {
    ok: 'ok',
    warn: 'warn',
    err: 'err',
    danger: 'err',
    info: 'info',
    neutral: '',
  }
  return <span className={cn('dot', map[tone])} />
}

export function PageHeader({
  eyebrow,
  title,
  description,
  badges,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  badges?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="ph">
      <div
        className="row"
        style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          {eyebrow ? (
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--fg-subtle)',
                marginBottom: 6,
              }}
            >
              {eyebrow}
            </div>
          ) : null}
          <div className="row gap-3" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <h1>{title}</h1>
            {badges}
          </div>
          {description ? (
            <div className="ph-sub" style={{ marginTop: 4, maxWidth: 720 }}>
              {description}
            </div>
          ) : null}
        </div>
        {actions ? <div className="row gap-2 ph-actions">{actions}</div> : null}
      </div>
    </div>
  )
}

export function CodeBlock({
  code,
  label,
  lang,
}: {
  code: string
  label?: string
  lang?: string
}) {
  const [copied, setCopied] = useState(false)
  const onCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      navigator.clipboard?.writeText(code)
    } catch {
      /* ignore */
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div style={{ position: 'relative' }}>
      {label ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 12px',
            fontSize: 11.5,
            color: 'var(--fg-subtle)',
            borderTopLeftRadius: 'var(--r-md)',
            borderTopRightRadius: 'var(--r-md)',
            background: 'var(--bg-sunk)',
            border: '1px solid var(--border)',
            borderBottom: 0,
          }}
        >
          <span className="mono" style={{ fontSize: 11 }}>
            {label}
          </span>
          {lang ? (
            <span
              style={{
                fontSize: 10,
                color: 'var(--fg-faint)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {lang}
            </span>
          ) : null}
        </div>
      ) : null}
      <pre
        className="code"
        style={{
          margin: 0,
          borderTopLeftRadius: label ? 0 : undefined,
          borderTopRightRadius: label ? 0 : undefined,
          borderTop: label ? 0 : undefined,
        }}
      >
        {code}
      </pre>
      <button
        type="button"
        className="btn btn-xs"
        style={{ position: 'absolute', top: label ? 36 : 8, right: 8 }}
        onClick={onCopy}
      >
        {copied ? (
          <>
            <Check size={11} />
            Kopiert
          </>
        ) : (
          <>
            <Copy size={11} />
            Kopieren
          </>
        )}
      </button>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: { href: string; label: string }
}) {
  return (
    <div
      style={{
        padding: '48px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 10,
        color: 'var(--fg-muted)',
      }}
    >
      {icon ? (
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'var(--bg-sunk)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--fg-subtle)',
            marginBottom: 4,
          }}
        >
          {icon}
        </div>
      ) : null}
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>{title}</div>
      {description ? <div style={{ fontSize: 13, maxWidth: 360 }}>{description}</div> : null}
      {action ? (
        <div style={{ marginTop: 8 }}>
          <Link href={action.href} className="btn btn-sm">
            {action.label}
          </Link>
        </div>
      ) : null}
    </div>
  )
}
