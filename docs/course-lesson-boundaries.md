# Kurs: Was wann — ohne Vorwegnehmen

Diese Datei trennt **technische Basis im Repo** (Core, Env, Doctor) davon, was **gemeinsam mit den Zuschauern in einer konkreten Lesson** passieren soll. So kannst du Lesson 3.1 live drehen, ohne dass Setup-Agents oder du selbst die Live-Schritte schon erledigt haben.

## Vor Lesson 3.1 (Maintainer / Aufnahme-Technik)

Erledigt sein sollte alles in `PRE-COURSE-SETUP.md` unter **Teil A — Minimum vor Lesson 3.1**: Supabase + Migrationen, `.env.local`, `bridge/.env`, `cd bridge && npm install`, Dashboard startet, `npm run doctor` ohne harte Fehler bei den **Pflicht**-Checks.

**Explizit noch nicht nötig** und **nicht vorwegnehmen**, wenn du Lesson 3.1 noch drehst:

- `mkdir ~/agents` und `cp -R templates/agent-boilerplate ...` — das ist **Lesson 3.1**
- `tmux`, erste echte Claude-Code-Session — ab **Lesson 3.4**
- `templates/launchagents/install-agent.sh` — **Lesson 3.5**
- `BRIDGE_MODE=file_drop` und Outbox/Inbox-Roundtrip — **Lesson 3.6** (bzw. wenn dein Skript den File-Drop dort einführt)
- Knowledge-Base-Symlink / Modul-4-Inhalte — **Modul 4**

## Lesson 3.1 (mit Zuschauern)

Typischer erster Schritt:

```bash
mkdir -p ~/agents
cp -R templates/agent-boilerplate ~/agents/<dein-agent-name>
```

Danach befüllst du in **3.2+** die Dateien im kopierten Ordner — nicht im Core-`templates/`-Original.

## Wo Details stehen

| Thema | Datei |
| --- | --- |
| Vollständige Checkliste mit Teil A/B/C | `PRE-COURSE-SETUP.md` |
| Agent-Konzept Modul 3 | `docs/agent-setup.md` |
| Bridge inline vs. file_drop | `docs/bridge-modes.md` |
| Bridge / LaunchAgent Dauerbetrieb | `docs/bridge-persistence.md` |
