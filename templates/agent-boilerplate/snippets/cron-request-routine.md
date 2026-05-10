<!--
  Drop-in CLAUDE.md snippet for an agent that should be able to PROPOSE
  new cron jobs (or changes / deletions to existing ones) to the user.

  HOW TO USE
  ----------
  1. Add the section below to your agent's CLAUDE.md, ideally right next to
     §4.5 (Risk-Approval) so both routines live together.
  2. The Mana Hub Bridge picks up the outbox reply automatically; you do
     NOT call any API yourself. The user sees the proposal in the
     "Cron-Vorschlaege" tab and approves or rejects it there.
  3. After approval, the user-facing dashboard creates / updates / deletes
     the corresponding row in `agent_cron_jobs` and writes a system message
     into your inbox so you know it's live.

  Reference: docs/cron-system.md
-->

## §4.6 Cron-Vorschlaege (`type: cron_request`)

Wenn du dem User einen neuen Cron-Job vorschlagen willst (oder einen
bestehenden aendern / loeschen willst), beantragst du das nicht selbst,
sondern legst den Vorschlag in deine Outbox. Der Mana Hub fragt den User um
Genehmigung; bei Zusage wird der Cron-Job angelegt und du bekommst eine
Inbox-Nachricht zur Bestaetigung.

### Wann das ein Cron-Vorschlag ist

- Du erkennst eine wiederkehrende Aufgabe (taeglich, wochentlich, vor jedem
  Sprint-Ende, jede Stunde …) und willst sie automatisieren.
- Der User hat dich nach so einer Routine gefragt und du hast einen
  konkreten Plan.

Du beantragst **niemals** Cron-Jobs ungefragt fuer sensible Felder (Geld,
Zugriff, externe Posts) — das laeuft zusaetzlich durch den Risk-Approval-Pfad
(siehe §4.5).

### Outbox-Reply-Format

```markdown
---
reply_to_id: <UUID des Trigger-Inbox-Eintrags, falls vorhanden, sonst weglassen>
created_at: <ISO-Timestamp>
type: cron_request
action: create            # oder: update | delete
job_name: "Morning Briefing"
schedule_hour: 7          # 0-23
schedule_minute: 0        # 0-59
schedule_day: null        # null = taeglich; 0-6 = So-Sa fuer wochentlich
prompt: |
  Lies MEMORY.md, CURRENT.md und projekte/*.md, ziehe Wetter aus Perplexity,
  liefere ein Morning-Briefing in der §5.8-Struktur.
reason: "Taegliche Lage-Uebersicht reduziert Reibung beim Tagesstart."
risk_level: low           # optional: low | medium | high | critical
target_job_id: <id>       # nur bei update / delete
proposed_changes: |
  {"output_kind": "briefing"}     # optional, JSON, fuer create/update
---

Begruendung in 2-3 Saetzen, was du dir vorstellst und warum jetzt.
```

### Pflichtfelder

- `type: cron_request` — sonst behandelt die Bridge dich als normalen Reply.
- `action: create | update | delete`.
- `job_name` — kurzer, eindeutiger Name. Wird auch im UI gezeigt.
- `reason` ODER Body-Text — der User braucht 1-2 Saetze warum das sinnvoll ist.

Bei `action: update` und `action: delete` zusaetzlich `target_job_id`
(die ID des bestehenden Jobs aus deinem letzten `agent_cron_jobs`-Snapshot).

### Was passiert nach dem Vorschlag

1. Bridge schreibt eine Zeile in `cron_requests` (status `pending`).
2. Im Mana Hub erscheint der Vorschlag im Tab **Cron-Vorschlaege**.
3. Der User entscheidet:
   - **Genehmigen** — Cron-Job wird in `agent_cron_jobs` angelegt /
     geaendert / geloescht, du bekommst eine `cron-approved-…md` in deine
     Inbox.
   - **Ablehnen** — Du bekommst eine `cron-rejected-…md`. Schlage keine
     identische Variante sofort nochmal vor; warte auf Feedback.
4. Bei `risk_level: high` / `critical` laeuft der Vorschlag zusaetzlich
   durch den Risk-Approval-Tab — der User muss in beiden Toren OK sagen.

### Was du NICHT tust

- Du legst keine Cron-Jobs heimlich selbst in der Tabelle an.
- Du startest keinen Cron-Job, bevor die `cron-approved-…md` in deiner Inbox
  liegt.
- Du beantragst nicht 5 Cron-Vorschlaege auf einmal — pro Outbox-Reply genau
  ein Vorschlag.
- Du wiederholst einen abgelehnten Vorschlag nicht in derselben Form;
  ueberlege, warum er abgelehnt wurde, und schlage alternativ vor.
