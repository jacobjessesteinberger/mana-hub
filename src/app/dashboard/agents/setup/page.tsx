'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  BookOpen,
  CheckCircle2,
  Database,
  GitBranch,
  KeyRound,
  LockKeyhole,
  Plug,
  Rocket,
  ShieldCheck,
  Terminal,
  Users,
  AlertTriangle,
  Bell,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthContext'
import { AGENTS } from '@/lib/agents-meta'
import { AHPill, CodeBlock, PageHeader } from '@/components/ui/mana-hub'
import { cn } from '@/lib/utils'
import PushNotificationCard from '@/components/notifications/PushNotificationCard'

const steps = [
  {
    title: '1. Projekt herunterladen und lokal starten',
    id: 'local',
    plain: 'Der Nutzer holt sich den Code auf seinen Computer und startet die App lokal.',
    detail: 'Dafür braucht er Node.js und ein Terminal. Im Kurs kannst du diesen Schritt einmal vormachen; danach ist es nur Copy/Paste.',
    icon: Terminal,
    status: 'Start',
    command: 'cp .env.example .env.local\nnpm install\nnpm run dev',
  },
  {
    title: '2. Demo öffnen und verstehen',
    id: 'demo',
    plain: 'Im Demo Mode kann der Nutzer Mana Hub anschauen, ohne Supabase oder echte Daten zu verbinden.',
    detail: 'Das ist nur eine Vorschau. Demo-Daten kommen aus lokalen Fallbacks und werden nicht in seine echte Datenbank geschrieben.',
    icon: Rocket,
    status: 'Demo',
    command: 'http://localhost:3030/login',
  },
  {
    title: '3. Eigenes Supabase-Projekt erstellen',
    id: 'supabase',
    plain: 'Supabase ist die Datenbank und Login-Verwaltung für die echte Installation.',
    detail: 'Der Nutzer erstellt ein eigenes Supabase-Projekt. Deine Mana-Hub-Installation verbindet sich nicht mit einer zentralen Datenbank von dir.',
    icon: Database,
    status: 'Pflicht',
  },
  {
    title: '4. Keys in .env.local eintragen',
    id: 'env',
    plain: 'Die App braucht die Supabase URL, den anon key und den service role key.',
    detail: 'Diese Werte findet der Nutzer in Supabase unter Project Settings > API. Sie werden lokal in `.env.local` eingetragen und niemals committed.',
    icon: KeyRound,
    status: 'Pflicht',
    command: 'NEXT_PUBLIC_SUPABASE_URL="https://dein-projekt.supabase.co"\nNEXT_PUBLIC_SUPABASE_ANON_KEY="dein-anon-key"\nSUPABASE_SERVICE_ROLE_KEY="dein-service-role-key"',
  },
  {
    title: '5. Datenbank-Tabellen mit SQL anlegen',
    id: 'sql',
    plain: 'Die Datenbank entsteht nicht durch einen Button in Mana Hub, sondern durch SQL-Dateien.',
    detail: 'Der Nutzer öffnet in Supabase den SQL Editor und führt die Dateien aus `supabase/migrations/` nacheinander aus.',
    icon: GitBranch,
    status: 'Pflicht',
  },
  {
    title: '6. Demo Mode ausschalten',
    id: 'production',
    plain: 'Erst wenn Supabase-Keys und SQL fertig sind, wird aus der Vorschau ein echtes Setup.',
    detail: 'Dazu werden beide Demo-Mode-Werte in `.env.local` auf `false` gesetzt und der Server neu gestartet.',
    icon: LockKeyhole,
    status: 'Go live',
    command: 'NEXT_PUBLIC_MANA_HUB_DEMO_MODE="false"\nMANA_HUB_DEMO_MODE="false"',
  },
  {
    title: '7. Eigene Agents und Knowledge Base ersetzen',
    id: 'agents',
    plain: 'Die Demo-Agents sind nur Platzhalter.',
    detail: 'Eigene Agents, Branding und Integrationen gehören in `user.config/`. Eigene Knowledge Base und Prompts gehören in `workspace/`.',
    icon: Users,
    status: 'Personalisieren',
  },
  {
    title: '8. Optional: Web-Push Notifications einrichten',
    id: 'webpush',
    plain: 'Browser- und OS-Notifications, wenn ein Agent eine Risk Approval anfragt oder einen Cron-Vorschlag schickt.',
    detail: 'VAPID-Keys einmalig generieren (`npx web-push generate-vapid-keys`), in `.env.local` als `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, optional `VAPID_SUBJECT="mailto:du@example.com"` eintragen, Server neu starten und unten in der Karte „Web-Push Notifications" auf „Aktivieren" klicken.',
    icon: Bell,
    status: 'Optional',
    command: 'npx web-push generate-vapid-keys',
  },
  {
    title: '9. Optional: Agent Connector und AI Keys verbinden',
    id: 'optional',
    plain: 'Zusätzliche Dienste werden erst verbunden, wenn der Nutzer sie wirklich braucht.',
    detail: 'Beispiele: Anthropic API Key, lokaler Agent-Workspace, eigener REST-Backend-Adapter oder andere Auth-Systeme.',
    icon: Plug,
    status: 'Optional',
  },
]

const envRows = [
  { key: 'NEXT_PUBLIC_SUPABASE_URL', meaning: 'Adresse des Supabase-Projekts.', where: 'Project Settings › API › Project URL' },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', meaning: 'Browser-Key für Supabase Auth.', where: 'Project Settings › API › anon public' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', meaning: 'Server-Key für geschützte Routes.', where: 'Project Settings › API › service_role' },
  { key: 'NEXT_PUBLIC_MANA_HUB_DEMO_MODE', meaning: 'Schaltet Demo im Browser an/aus.', where: '`.env.local` true/false' },
  { key: 'MANA_HUB_DEMO_MODE', meaning: 'Schaltet Server-Fallbacks an/aus.', where: '`.env.local` true/false' },
]

export default function SetupPage() {
  const { isDemoMode } = useAuth()
  const [done, setDone] = useState<Record<string, boolean>>({
    local: true, demo: true, supabase: false, env: false, sql: false, production: !isDemoMode, agents: false, webpush: false, optional: false,
  })
  const completed = steps.filter(step => done[step.id]).length
  const progress = Math.round((completed / steps.length) * 100)

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="STARTER SETUP"
        title="Von Demo zu Production"
        description="Schritt für Schritt vom lokalen Demo Mode zur echten Installation. Erst Demo, dann Supabase verbinden, SQL ausführen, Demo Mode aus, eigene Agents."
        badges={
          <AHPill tone={isDemoMode ? 'demo' : 'prod'}>
            <span className="badge-dot" />
            {isDemoMode ? 'Demo Mode aktiv' : 'Production Mode'}
          </AHPill>
        }
        actions={
          <button
            type="button"
            onClick={() => setDone(Object.fromEntries(steps.map(step => [step.id, true])))}
            className="btn btn-sm btn-primary"
          >
            Alles abhaken
          </button>
        }
      />

      <div className="setup-shell">
        <div className="col gap-4">
          {/* Progress hero */}
          <div className="card card-hero" style={{ padding: '20px 22px' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)' }}>
                  {isDemoMode ? 'Aktuell Demo' : 'Aktuell Production'}
                </div>
                <h2 style={{ margin: '6px 0 4px', fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>
                  {completed} von {steps.length} Schritten erledigt
                </h2>
                <div style={{ color: 'var(--fg-muted)', fontSize: 13, maxWidth: 560 }}>
                  Liste von oben nach unten abarbeiten. Demo Mode ist sicher, Production startet erst nach Supabase und SQL.
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="tabular" style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }}>
                  {progress}<span style={{ fontSize: 14, color: 'var(--fg-subtle)', fontWeight: 400 }}>%</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 1 }}>Fortschritt</div>
              </div>
            </div>
            <div className="bar" style={{ marginTop: 14 }}>
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* Steps */}
          <div className="card">
            <div className="card-hd">
              <h3>Installationsschritte</h3>
              <span className="badge">{completed}/{steps.length}</span>
            </div>
            {steps.map((step) => {
              const isDone = done[step.id]
              return (
                <div key={step.id} className={cn('step', isDone && 'done')}>
                  <button
                    type="button"
                    onClick={() => setDone(prev => ({ ...prev, [step.id]: !prev[step.id] }))}
                    className={cn('check-circle', isDone && 'done')}
                    title={isDone ? 'Als offen markieren' : 'Als erledigt markieren'}
                    style={{ marginTop: 6, cursor: 'pointer' }}
                    aria-label="Toggle"
                  >
                    {isDone ? <CheckCircle2 size={11} /> : null}
                  </button>
                  <div className="step-body">
                    <div className="row gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                      <h4>{step.title}</h4>
                      <span className="badge badge-accent" style={{ fontSize: 10 }}>{step.status}</span>
                    </div>
                    <p style={{ margin: '4px 0 6px', fontSize: 13, color: 'var(--fg)' }}>{step.plain}</p>
                    <p style={{ margin: 0, fontSize: 12.5, color: 'var(--fg-muted)', lineHeight: 1.5 }}>
                      {step.detail.split(/`([^`]+)`/g).map((part, i) =>
                        i % 2 === 1 ? <code key={i} className="code-inline">{part}</code> : <span key={i}>{part}</span>
                      )}
                    </p>
                    {step.command ? <div style={{ marginTop: 10 }}><CodeBlock code={step.command} /></div> : null}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Warn-card */}
          <div className="card" style={{ background: 'var(--warn-soft)', borderColor: 'transparent' }}>
            <div className="card-bd row gap-3" style={{ alignItems: 'flex-start' }}>
              <AlertTriangle size={16} style={{ color: 'var(--warn)', flex: 'none', marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warn)' }}>Erst Migrationen, dann Demo Mode aus</div>
                <div style={{ fontSize: 12.5, color: 'var(--fg-muted)', marginTop: 2 }}>
                  Wenn der Demo Mode ausgeschaltet wird, bevor SQL läuft, fehlen der App echte Tabellen.
                </div>
              </div>
            </div>
          </div>

          <PushNotificationCard />
        </div>

        {/* Right rail */}
        <div className="setup-rail col gap-4">
          <div className="card">
            <div className="card-hd"><h3>Summary</h3></div>
            <div className="card-bd col gap-3">
              <div className="row gap-2"><span className="dot ok" /><span style={{ flex: 1, fontSize: 12.5 }}>Lokaler Server läuft</span></div>
              <div className="row gap-2"><span className={cn('dot', isDemoMode ? 'warn' : 'ok')} /><span style={{ flex: 1, fontSize: 12.5 }}>{isDemoMode ? 'Demo Mode' : 'Production Mode'}</span></div>
              <div className="row gap-2"><span className="dot" /><span style={{ flex: 1, fontSize: 12.5, color: 'var(--fg-muted)' }}>Supabase verbunden</span></div>
            </div>
          </div>
          <div className="card">
            <div className="card-hd"><h3>Keys</h3><span className="badge">.env.local</span></div>
            <div className="card-bd col gap-3">
              {envRows.map(row => (
                <div key={row.key}>
                  <div className="mono" style={{ fontSize: 11.5, fontWeight: 600 }}>{row.key}</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>{row.meaning}</div>
                  <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2 }}>{row.where}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-hd row gap-2"><BookOpen size={14} style={{ color: 'var(--accent)' }} /><h3>Help</h3></div>
            <div className="card-bd">
              <div style={{ fontSize: 12.5, color: 'var(--fg-muted)' }}>
                Erste Hilfe? Lies die Migrations-Dokumentation und die Beispiele unter <code className="code-inline">docs/</code>.
              </div>
              <div className="row gap-2" style={{ marginTop: 10 }}>
                <Link href="/dashboard/agents/knowledge" className="btn btn-xs">Knowledge</Link>
                <Link href="/dashboard/agents/health" className="btn btn-xs"><ShieldCheck size={11} /> Health</Link>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-hd"><h3>Demo Agents</h3></div>
            <div className="card-bd col gap-2">
              {AGENTS.map(a => (
                <Link
                  key={a.name}
                  href={`/dashboard/agents/${a.name}/chat`}
                  className="row gap-2"
                  style={{ padding: '6px 8px', borderRadius: 10, textDecoration: 'none', color: 'var(--fg)' }}
                >
                  <span className="avatar avatar-sm" style={{ background: a.color }}>{a.label.slice(0, 2)}</span>
                  <span style={{ flex: 1, fontSize: 12.5 }}>{a.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>{a.role}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
