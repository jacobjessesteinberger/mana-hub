'use client'

import Link from 'next/link'
import { BookOpen, Boxes, KeyRound, Lock, RefreshCw, Rocket, ShieldCheck, Workflow } from 'lucide-react'

const sections = [
  {
    id: 'zielbild',
    title: 'Zielbild',
    icon: Rocket,
    body: 'Mana Hub Core ist ein blankes, installierbares Starter-System. Nutzer verbinden ihr eigenes Supabase-Projekt, eigene Agents, eigene Knowledge Base und eigene Connectoren.',
    points: ['Keine privaten Daten im Core', 'Synthetische Demo-Daten', 'Kurs-Setup mit Fresh-Install-Pfad'],
  },
  {
    id: 'core-user-space',
    title: 'Core vs User Space',
    icon: Boxes,
    body: 'Updatebare Core-Dateien liefern Dashboard, APIs, Schema, Skills und Dokumentation. User Space bleibt fuer lokale Anpassungen, Secrets, Knowledge Base und eigene Connectoren reserviert.',
    points: ['Core: src/, supabase/migrations, docs, skills', 'User Space: .env.local, user.config/, workspace/, eigene Agent-Verzeichnisse', 'Updates duerfen User Space nicht ueberschreiben'],
  },
  {
    id: 'api-contracts',
    title: 'API-Vertraege',
    icon: Workflow,
    body: 'Der Core definiert stabile Endpunkte fuer Chat, Message Lifecycle, Stop-Control, Workspaces, Outcomes, Tasks, Approvals, Routines, Knowledge und Uploads.',
    points: ['PATCH /api/agents/messages/[id] fuer edit/retract', 'POST /api/agents/[id]/stop fuer /stop', 'POST /api/agents/projects/[id]/review fuer Workspace Reviews'],
  },
  {
    id: 'install-helper',
    title: 'Install Helper',
    icon: KeyRound,
    body: 'Der Skill fuehrt Nutzer Schritt fuer Schritt durch Supabase, lokale Environment-Dateien, Agents, Bridge/Connector und Doctor Checks.',
    points: ['Keine Secrets in Git-Dateien schreiben', 'Supabase URL und Keys nur lokal erfassen', 'Erwartete Outputs und Smoke Tests pruefen'],
  },
  {
    id: 'security',
    title: 'Security',
    icon: Lock,
    body: 'Service Role Keys bleiben serverseitig. Nutzer pruefen RLS, Storage Policies, Agent Permissions und Connector-Grenzen, bevor sie produktive Daten anbinden.',
    points: ['.env.local bleibt untracked', 'Uploads mit Limits und Metadaten', 'Risk Approval fuer gefaehrliche Aktionen'],
  },
  {
    id: 'updates',
    title: 'Update Safety',
    icon: RefreshCw,
    body: 'Core-Updates werden als Produktupdates behandelt: Migrations, neue Endpunkte und UI-Fixes koennen eingespielt werden, ohne individuelle Nutzer-Konfigurationen zu veraendern.',
    points: ['UPGRADE.md vor Updates lesen', 'Migrations versionieren', 'User Space nie automatisch ueberschreiben'],
  },
]

const endpoints = [
  ['GET/POST', '/api/agents/messages', 'Chat-Verlauf laden und neue User-Nachricht erstellen'],
  ['PATCH', '/api/agents/messages/[id]', 'Nachricht bearbeiten oder zurueckziehen'],
  ['POST', '/api/agents/[id]/stop', 'Agent-Arbeit stoppen, optional Host-Runner interrupten'],
  ['GET/POST', '/api/agents/projects', 'Workspaces listen und erstellen'],
  ['POST', '/api/agents/projects/[id]/review', 'Workspace-Kontext an verantwortlichen Agent senden'],
  ['GET/POST/PATCH', '/api/agents/goals', 'Outcomes verwalten und Fortschritt aktualisieren'],
  ['GET/POST/PATCH', '/api/agents/issues', 'Tasks verwalten und Review-Status pflegen'],
  ['POST', '/api/agents/upload', 'Dateien fuer Agent-Kontext hochladen'],
]

export default function ManaHubDocsPage() {
  return (
    <div className="page fade-in" style={{ padding: '28px', maxWidth: 1180, margin: '0 auto' }}>
      <div className="page-head" style={{ marginBottom: 18 }}>
        <div>
          <div className="eyebrow">Mana Hub Core</div>
          <h1>Documentation</h1>
          <p>Neutrale Produktdokumentation fuer Kurs, GitHub-Release und lokale Installationen.</p>
        </div>
        <Link href="/dashboard/agents/setup" className="btn btn-primary btn-sm">
          Setup oeffnen
        </Link>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '260px minmax(0,1fr)', gap: 16 }}>
        <aside className="card" style={{ padding: 14, position: 'sticky', top: 16, height: 'fit-content' }}>
          <div className="row gap-2" style={{ alignItems: 'center', marginBottom: 10 }}>
            <BookOpen size={16} />
            <strong style={{ fontSize: 13 }}>Inhalt</strong>
          </div>
          <nav className="col gap-1">
            {sections.map(section => (
              <a key={section.id} href={`#${section.id}`} className="nav-item" style={{ padding: '8px 10px' }}>
                <section.icon size={14} />
                <span>{section.title}</span>
              </a>
            ))}
          </nav>
        </aside>

        <main className="col gap-4">
          <div className="card" style={{ padding: 18 }}>
            <div className="row gap-2" style={{ alignItems: 'center', marginBottom: 8 }}>
              <ShieldCheck size={17} color="var(--accent)" />
              <strong>Blank Core Regel</strong>
            </div>
            <p style={{ color: 'var(--fg-muted)', margin: 0 }}>
              Dieses Starter-Projekt darf keine privaten Host-Verbindungen, privaten Pfade, echten Kunden, echten Reports,
              persoenlichen Prompts oder produktiven Daten enthalten. Alles, was wie reale Arbeit wirkt, gehoert in
              den User Space eines konkreten Host-Setups.
            </p>
          </div>

          {sections.map(section => (
            <section key={section.id} id={section.id} className="card" style={{ padding: 18, scrollMarginTop: 20 }}>
              <div className="row gap-2" style={{ alignItems: 'center', marginBottom: 8 }}>
                <section.icon size={17} color="var(--accent)" />
                <h2 style={{ margin: 0, fontSize: 18 }}>{section.title}</h2>
              </div>
              <p style={{ color: 'var(--fg-muted)' }}>{section.body}</p>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
                {section.points.map(point => (
                  <div key={point} className="mini-card">
                    {point}
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section className="card" style={{ padding: 18 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>API Reference</h2>
            <div className="col gap-2">
              {endpoints.map(([method, path, description]) => (
                <div key={path} className="mini-card row gap-3" style={{ alignItems: 'baseline' }}>
                  <span className="mono" style={{ minWidth: 90, color: 'var(--accent)', fontWeight: 700 }}>{method}</span>
                  <span className="mono" style={{ minWidth: 250 }}>{path}</span>
                  <span style={{ color: 'var(--fg-muted)' }}>{description}</span>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
