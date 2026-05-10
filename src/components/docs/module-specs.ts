import type { ModuleSpec } from './ModuleSection'

/**
 * Lastenheft des Mana-Hub-Cores. Jeder Eintrag ist ein eigenständiges Modul,
 * mit kuratierter Erklärung („was, warum, was hat der User davon"), den
 * wichtigsten API-Endpoints und Verlinkung zur Detail-Doku unter `docs/*.md`.
 *
 * Reihenfolge entspricht der Flow-Logik einer Mana-Hub-Installation:
 * Architektur → Bridge → Agents → Knowledge Base → Daten-Workflows
 * (Cron, Approvals, Notifications) → Produktivitäts-Workflows
 * (Workspaces, Tasks, Briefings) → Operations (Heartbeat, Backend, Updates,
 * Setup).
 */
export const MODULE_SPECS: ModuleSpec[] = [
  {
    id: 'bridge',
    eyebrow: 'Connector',
    title: 'Bridge',
    summary:
      'Long-running Node-Prozess, der das Dashboard mit den Agent-Prozessen verbindet. Liest neue User-Nachrichten aus Supabase, schreibt Agent-Antworten zurück, dispatched Approvals, Cron-Requests und Plan-Updates und schickt die Heartbeats jedes Agents.',
    keyConcepts: ['inline mode', 'file_drop mode', 'Polling + Realtime', 'tmux notify', 'LaunchAgent persistence'],
    userValue:
      'Genau ein Prozess hält die Verbindung zwischen Webdashboard und Agents. Du musst keinen Cloud-Worker, keinen Webhook-Tunnel und keinen Inhouse-Service betreiben — die Bridge läuft auf deinem Mac/VPS und ist über LaunchAgent oder tmux persistent.',
    endpoints: [
      { method: 'POST', path: '/api/agents/messages', note: 'Bridge schreibt Assistant-Replies hierhin (oder direkt in Supabase im file_drop-Mode).' },
    ],
    relatedDocs: [
      { slug: 'bridge-modes', label: 'Bridge Modes (inline / file_drop)' },
      { slug: 'bridge-persistence', label: 'Bridge Persistence (LaunchAgent)' },
    ],
  },
  {
    id: 'agents',
    eyebrow: 'Agents',
    title: 'Agents (Claude Code)',
    summary:
      'Jeder Mana-Hub-Agent ist ein eigener Claude-Code-Prozess in einer eigenen tmux-Session, mit eigener CLAUDE.md (Identität), MEMORY.md (Wissen), CURRENT.md (laufender Sprint), eigenen MCP-Servern und eigenen Permissions. Der Core liefert nur das Boilerplate, die Persönlichkeit und Daten gehören dem User.',
    keyConcepts: ['CLAUDE.md', 'MEMORY.md', 'CURRENT.md', 'MCP-Server', '.claude/settings.json', 'inbox / outbox'],
    userValue:
      'Du baust dir ein Team aus spezialisierten Agents (Researcher, Operator, Builder…), die du jederzeit ohne Code-Änderung erweitern, austauschen oder pausieren kannst. Jeder Agent ist ein Markdown-Verzeichnis im User Space — kein Vendor-Lock-in.',
    endpoints: [
      { method: 'GET', path: '/api/agents', note: 'Aktive Agents + Heartbeat-Status.' },
      { method: 'POST', path: '/api/agents/[id]/stop', note: 'Stop-Signal an Bridge / Runner.' },
    ],
    relatedDocs: [
      { slug: 'agent-setup', label: 'Agent Setup (Module 3)' },
      { slug: 'core-user-space', label: 'Core vs. User Space' },
    ],
  },
  {
    id: 'knowledge-base',
    eyebrow: 'Knowledge',
    title: 'Knowledge Base',
    summary:
      'Eine flache Markdown-Hierarchie nach dem Karpathy-Wiki-Pattern (firma, projekte, workflows, finanzen…). Im Repo liegt nur ein leeres Template; die echte Knowledge Base lebt im User Space und wird in den Agent über einen Symlink gemountet.',
    keyConcepts: ['Markdown-Tree', 'INDEX.md', 'Symlink', 'FS-Index im Dashboard', 'MANA_HUB_KNOWLEDGE_ROOT'],
    userValue:
      'Dein Wissen bleibt in versionierbaren Markdown-Dateien — kein proprietäres Format, kein Cloud-Vendor. Das Dashboard indiziert deine KB live, Agents lesen via Symlink direkt mit. Updates am Core lassen die KB unangetastet.',
    endpoints: [
      { method: 'GET', path: '/api/knowledge', note: 'Liefert kategorisierte Datei-Liste aus MANA_HUB_KNOWLEDGE_ROOT (Demo-Fallback wenn nicht gesetzt).' },
      { method: 'GET', path: '/api/knowledge/file', note: 'Inhalt einer einzelnen .md-Datei.' },
    ],
  },
  {
    id: 'cron-system',
    eyebrow: 'Automation',
    title: 'Cron-System',
    summary:
      'Geplante Agent-Jobs (Morning Briefing, AI-News-Scan, Weekly-Review …) liegen in `agent_cron_jobs` und werden von der Bridge im 5-Minuten-Tick getriggert. Output landet je nach `output_kind` als Briefing, Inbox-Message oder Free-Form-Reply.',
    keyConcepts: ['agent_cron_jobs', 'Bridge-Tick', 'output_kind', 'runbook', 'cron:create CLI'],
    userValue:
      'Wiederkehrende Routinen werden zuverlässig ausgeführt — ohne dass du eine Cloud-Cron oder pg_cron einrichten musst. Die Bridge ist gleichzeitig dein Scheduler.',
    endpoints: [
      { method: 'GET', path: '/api/agents/routines', note: 'Liste aller aktiven Cron-Jobs.' },
    ],
    relatedDocs: [
      { slug: 'cron-and-briefings', label: 'Cron-Jobs & Briefings' },
      { slug: 'cron-system', label: 'Cron-System Überblick' },
    ],
  },
  {
    id: 'cron-requests',
    eyebrow: 'Automation',
    title: 'Cron-Vorschläge',
    summary:
      'Wenn ein Agent merkt „das hier sollte ich täglich machen", schreibt er einen `type: cron_request` in seine Outbox. Die Bridge erkennt das, legt einen `pending`-Eintrag in `cron_requests` an und du entscheidest im Dashboard: ablehnen oder genehmigen. Bei Genehmigung wird der echte Cron-Job angelegt / aktualisiert / gelöscht.',
    keyConcepts: ['Agent-driven Proposal', 'Approval-Pfad bei high/critical Risk', 'Cron-Vorschläge-Tab', 'cron_requests Tabelle'],
    userValue:
      'Agents werden nicht heimlich kreativ. Jede neue Routine ist eine bewusste Entscheidung von dir. Trotzdem reduziert sich Setup-Aufwand drastisch — du bestätigst, statt selbst zu konfigurieren.',
    endpoints: [
      { method: 'GET', path: '/api/agents/cron-requests', note: 'Pending Vorschläge.' },
      { method: 'POST', path: '/api/agents/cron-requests', note: 'Vorschlag manuell anlegen (selten — meist Bridge).' },
      { method: 'PATCH', path: '/api/agents/cron-requests/[id]', note: 'Genehmigen oder ablehnen.' },
    ],
    relatedDocs: [
      { slug: 'cron-system', label: 'Cron-System Überblick' },
    ],
  },
  {
    id: 'risk-approval',
    eyebrow: 'Sicherheit',
    title: 'Risk Approval',
    summary:
      'Sobald ein Agent etwas Sensibles tun will (Geld bewegen, externe Systeme verbinden, löschen, posten…), schreibt er statt der Aktion einen `type: approval_request`. Im Dashboard erscheint die Anfrage mit drei Buttons: Ablehnen, Einmalig freigeben, Immer erlauben. „Immer erlauben" speichert eine Always-Policy, die den Pfad auto-genehmigt.',
    keyConcepts: ['approval_request', 'Always-Policies', 'auto_approved_by_policy_id', 'Bridge-Marker', 'Risk-Approval-Tab'],
    userValue:
      'Du bekommst Gas und Bremse: standardgemäße Aktionen laufen sofort, kritische Aktionen warten auf deine bewusste Entscheidung. Das System lernt dabei mit — was du einmal als „immer ok" markierst, läuft beim nächsten Mal still.',
    endpoints: [
      { method: 'GET', path: '/api/agents/approvals', note: 'Liste mit Filter status / agent.' },
      { method: 'POST', path: '/api/agents/approvals', note: 'Bridge oder Dashboard erzeugt Anfrage.' },
      { method: 'PATCH', path: '/api/agents/approvals/[id]', note: 'Entscheidung speichern (policy=once|always).' },
    ],
    relatedDocs: [
      { slug: 'risk-approval', label: 'Risk Approval & Policy Learning' },
    ],
  },
  {
    id: 'web-push',
    eyebrow: 'Notifications',
    title: 'Web-Push Notifications',
    summary:
      'Browser- bzw. OS-Notifications für neue Risk-Approvals und Cron-Vorschläge — auch wenn der Mana-Hub-Tab geschlossen ist. VAPID-Keys einmal generieren, Subscription pro Browser anlegen, fertig. Die Bridge benachrichtigt das Dashboard intern über einen Service-Token.',
    keyConcepts: ['VAPID', 'Service Worker (sw.js)', 'push_subscriptions', '/api/push/notify-internal'],
    userValue:
      'Du musst das Dashboard nicht aktiv beobachten. Wichtige Anfragen poppen direkt am System auf, du klickst rein, entscheidest, fertig.',
    endpoints: [
      { method: 'POST', path: '/api/push/subscribe', note: 'Browser meldet sich an.' },
      { method: 'POST', path: '/api/push/test', note: 'Eine Test-Notification an alle deine Subscriptions.' },
      { method: 'POST', path: '/api/push/notify-internal', note: 'Bridge → Dashboard, Token-geschützt.' },
    ],
    relatedDocs: [
      { slug: 'web-push', label: 'Web-Push Notifications' },
    ],
  },
  {
    id: 'workspaces',
    eyebrow: 'Produktivität',
    title: 'Workspaces & Outcomes',
    summary:
      'Workspaces gruppieren zusammenhängende Arbeit (Projekt, Kunde, Initiative) und liefern dem zuständigen Agent automatisch Kontext beim Reviewstart. Outcomes sind die übergeordneten Ziele dazu — mit Tracking-Source, Confidence und Deadline.',
    keyConcepts: ['projects', 'goals', 'tracking_source', 'workspace context', 'project review'],
    userValue:
      'Statt jedem Agent in jedem Chat alles neu zu erklären, definierst du Kontext einmal als Workspace. Beim Review-Trigger bekommt der Agent automatisch die relevante Lage zugespielt.',
    endpoints: [
      { method: 'GET', path: '/api/agents/projects', note: 'Workspaces listen.' },
      { method: 'POST', path: '/api/agents/projects/[id]/review', note: 'Kontext-Pakage an verantwortlichen Agent senden.' },
      { method: 'GET', path: '/api/agents/goals', note: 'Outcomes mit Fortschritt.' },
    ],
  },
  {
    id: 'tasks',
    eyebrow: 'Produktivität',
    title: 'Tasks (Issues)',
    summary:
      'Issues als kleines Workflow-OS: Status (todo / in_progress / in_review / blocked / done), Comments, Issue-Runs (Agent-Ausführungen mit Timing und Output). Agents können selbst Tasks anlegen, kommentieren und Status setzen.',
    keyConcepts: ['issues table', 'issue_runs', 'workflow os', 'review queue'],
    userValue:
      'Tasks und ihre Historie liegen in deiner Datenbank, nicht in irgendeinem SaaS. Volle Transparenz über jede Agent-Aktion, jeden Run, jedes Resultat.',
    endpoints: [
      { method: 'GET', path: '/api/agents/issues', note: 'Filter by status, agent, project.' },
      { method: 'PATCH', path: '/api/agents/issues/[id]', note: 'Status / Review-Status setzen.' },
      { method: 'GET', path: '/api/agents/issues/[id]/runs', note: 'Run-Historie pro Issue.' },
    ],
  },
  {
    id: 'briefings',
    eyebrow: 'Output',
    title: 'Briefings',
    summary:
      'Cron-Triggered Outputs (Morning Briefing, AI-News, Weekly-Review) landen nicht im normalen Chat, sondern in einem dedizierten Briefings-Tab. Voraussetzung: der Cron-Job hat `output_kind=briefing`, der Agent hält sich an das §5.8-Reply-Format, die Bridge routet automatisch.',
    keyConcepts: ['output_kind=briefing', '§5.8-Reply-Format', 'briefing_user_state', 'Briefings-Tab'],
    userValue:
      'Du bekommst täglich oder wöchentlich kompakte, vergleichbare Reports — nicht in einem überfluteten Chat, sondern in einem Tab, der wie eine kleine Inbox für strukturierte Updates funktioniert.',
    relatedDocs: [
      { slug: 'cron-and-briefings', label: 'Cron-Jobs & Briefings' },
    ],
  },
  {
    id: 'realtime',
    eyebrow: 'Status',
    title: 'Heartbeat & Realtime',
    summary:
      'Jeder Agent schreibt alle 30 Sekunden einen Heartbeat in `agent_heartbeats` (Status, Context-Usage, aktuelle Task). Das Dashboard subscribed via Supabase-Realtime auf alle relevanten Tabellen und aktualisiert Badges, Inbox-Counts und den Online-Status live.',
    keyConcepts: ['agent_heartbeats', 'context_usage_percent', 'Supabase Realtime', 'NotificationContext'],
    userValue:
      'Du siehst sofort, ob ein Agent online ist, wie voll sein Kontext ist und ob neue Anfragen reinkommen — ohne F5 zu drücken.',
    endpoints: [
      { method: 'GET', path: '/api/agents/heartbeats', note: 'Aktueller Status pro Agent.' },
    ],
  },
  {
    id: 'backend-adapters',
    eyebrow: 'Architektur',
    title: 'Backend-Adapter',
    summary:
      'Der Core ist auf Supabase abgestimmt, aber die Boundary ist sauber gezogen. Alle Schreib-/Lesepfade gehen über `createServerSupabase()` und `requireAuth()` — Adapter für andere Backends können dort angedockt werden, ohne UI/Logik anzufassen.',
    keyConcepts: ['createServerSupabase', 'requireAuth', 'MANA_HUB_BACKEND env', 'Connector Boundary'],
    userValue:
      'Wenn du irgendwann Postgres nicht mehr in Supabase laufen lassen willst, ist das ein abgrenzbarer Refactor — nicht ein Komplett-Rewrite.',
    relatedDocs: [
      { slug: 'backend-adapters', label: 'Backend Adapters' },
    ],
  },
  {
    id: 'update-safety',
    eyebrow: 'Operations',
    title: 'Update-Sicherheit',
    summary:
      'Updates am Core (`src/`, `supabase/migrations/`, `docs/`, `scripts/`, `.cursor/skills/`) lassen den User Space (`.env.local`, `user.config/`, `workspace/`, dein Agent-Verzeichnis) unangetastet. Migrationen sind idempotent, jede neue Version dokumentiert ihre Breaking Changes in `UPGRADE.md`.',
    keyConcepts: ['Core vs. User Space', 'idempotente Migrationen', 'UPGRADE.md', 'Doctor-Check'],
    userValue:
      'Du kannst Mana Hub aktualisieren, ohne Angst, dass deine Anpassungen platt sind. Migrations-Dateien sind so geschrieben, dass sie auch beim zweiten Lauf grün durchlaufen.',
    relatedDocs: [
      { slug: 'core-user-space', label: 'Core und User Space' },
      { slug: 'update-safety', label: 'Update Safety' },
    ],
  },
  {
    id: 'setup',
    eyebrow: 'Onboarding',
    title: 'Setup-Pfad',
    summary:
      'Acht Schritte vom Demo-Mode zur echten Production: lokal starten, Demo verstehen, Supabase-Projekt anlegen, Keys eintragen, Migrationen ausführen, Demo Mode aus, eigene Agents anlegen, optional Web-Push und MCP-Keys ergänzen.',
    keyConcepts: ['Demo Mode', 'NEXT_PUBLIC_SUPABASE_URL', 'Supabase SQL-Editor', 'Doctor-Run', 'PRE-COURSE-SETUP.md'],
    userValue:
      'Klar abgegrenzte Schritte, die du parallel zum Kurs abhaken kannst. Das Setup geht in ~30 Minuten Speedrun, ~60-90 Minuten regulär.',
    relatedDocs: [
      { slug: 'fresh-install-checklist', label: 'Fresh Install Checklist' },
      { slug: 'course-lesson-boundaries', label: 'Course Lesson Boundaries' },
    ],
  },
]
