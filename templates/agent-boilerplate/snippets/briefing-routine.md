<!--
  Drop-in CLAUDE.md snippet for an agent that should run cron-driven briefings
  (e.g. a daily morning briefing) and have those briefings appear in the
  Mana Hub Briefings tab instead of the regular chat.

  HOW TO USE
  ----------
  1. Copy the three blocks below into your agent's CLAUDE.md:
       - Block A → as the new "§5.8 Cron-Briefings" section (right after §5.7)
       - Block B → as a one-paragraph addition at the end of "§5.2 Inbox"
       - Block C → as a "Briefing-Variante" subsection inside "§5.3 Outbox"
  2. Replace every <AGENT_NAME> with your agent's lowercase name (e.g. "mana", "taro").
  3. Adjust the body format in Block A to fit your agent's actual job
     (the example uses Wetter / Heute anstehend / Mein Vorschlag — that's MANA's
     morning-briefing template; rename or restructure as needed).
  4. Make sure §0 (Boot-Sequenz) is set up — the briefing relies on the agent
     reading MEMORY.md, CURRENT.md, and any relevant knowledge-base files first.

  Reference: docs/cron-and-briefings.md
-->

---

## Block A — §5.8 Cron-Briefings (Morgenbriefing & andere Routinen)

Wenn die Inbox eine Datei mit `kind: cron` UND `output_kind: briefing` (oder `source: cron`) enthaelt, ist das ein **Briefing-Cron**. Format und Frontmatter sind verbindlich, weil das Mana-Hub-Dashboard die Reply nur dann im **Briefings-Tab** anzeigt — sonst landet sie im allgemeinen Agenten-Chat.

### Outbox-Frontmatter (Pflicht — siehe §5.3 Briefing-Variante)

Du kopierst aus der Inbox `output_kind`, `source`, `job_id`, `job_name`, `briefing_title` **unveraendert** in die Outbox-Reply, ergaenzt `type: reply`, `agent: <AGENT_NAME>`, `category`, `urgency`. Ohne diese Felder = kein Briefing.

### Body-Format

```markdown
# {briefing_title} — DD.MM.YYYY

## Wetter
<2-3 knappe Saetze: Standort, Temperatur, Niederschlag, Wind. Quelle nennen (z.B. "Perplexity, Stand HH:MM").>

## Heute anstehend
<Bulletliste — alles was fuer heute relevant ist, gezogen aus CURRENT.md (Sprint), aktiven Projekten in projekte/*.md, Deadlines, Terminen. Pro Punkt: was, fuer welchen Kontext, geschaetzte Zeit.>

## Mein Vorschlag
<Genau **eine** konkrete Sache, mit der ich <USER_NAME>s Tag oder das Business heute messbar verbessern kann. Max. 60 Min Aufwand. Mit warum + naechstem Schritt.>
```

Keine zusaetzlichen Sektionen ausser diesen drei. Kurz, knapp, ehrlich. Wenn etwas leer waere ("heute nichts anstehend"), sag das ehrlich.

### Datenquellen

- **Wetter:** Perplexity MCP — `perplexity_search` mit Query "Wetter in <Standort> heute". Standort liest du aus `knowledge-base/firma/uebersicht.md` Feld **`Sitz`**. Falls der Wert dort `STUB` oder leer ist: einmalig nach Standort fragen, in der Zwischenzeit Default `Berlin` verwenden, damit das Briefing nicht leer bleibt.
- **Heute anstehend:** `CURRENT.md` (Sprint, offene Tasks, Termine), `knowledge-base/projekte/*.md` (laufende Projekte). Keine wahllose KB-Lese-Aktion — nur Files die fuers Heute relevant sind, max. 3 (Karpathy-Wiki-Regel).
- **Mein Vorschlag:** kommt aus deinem Kopf, gestuetzt auf MEMORY.md (langfristige Ziele), CURRENT.md (Sprint-Drift), beobachtete Friction der letzten Tage. Keine Schwurbel, keine Banalitaeten.

### `urgency`

- `normal` (Standard): nichts brennt.
- `high`: ein Sprint-Ziel kippt heute, eine Deadline wackelt, ein Risiko ist messbar.
- `critical`: echter Notfall — Geld, Sicherheit, Vertraege.
- `low`: ruhiger Tag, nur informativ.

### Beispiel — vollstaendiges Briefing-Reply

```markdown
---
reply_to_id: 9d8a8c0e-1234-4567-89ab-cdef01234567
created_at: 2026-05-09T05:30:14.000Z
type: reply
output_kind: briefing
source: cron
job_id: <AGENT_NAME>-morning-briefing
job_name: Morning Briefing
briefing_title: "Morning Briefing"
agent: <AGENT_NAME>
category: Morning
urgency: normal
---

# Morning Briefing — 09.05.2026

## Wetter
Berlin, 14 Grad, bewoelkt, kein Regen, leichter Wind aus West (Quelle: Perplexity, Stand 07:30).

## Heute anstehend
- Sprint-Ziel "Modul 4 fertig" — heute Lesson 4.3, ca. 2 h.
- Deadline X faellig morgen — Vorbereitung 1 h.
- Q2-OKRs in `firma/okrs.md` immer noch STUB. Eskalation Tag 3.

## Mein Vorschlag
30 Min Block fuer Y heute. Begruendung: spart morgen 1-2 h und reduziert Risiko Z. Naechster Schritt: Tool A oeffnen, Template B befuellen.
```

### Verbote

- Keine Reply ohne die Briefing-Frontmatter — sonst falsches Tab.
- Keine Romane. Bullet-Points statt Absaetzen.
- Keine erfundenen Wetterdaten — wenn Perplexity nicht antwortet: "Wetter heute nicht abrufbar (Perplexity-Fehler)" und weiter.
- Kein Briefing senden, ohne `MEMORY.md` + `CURRENT.md` vorher gelesen zu haben (siehe §0). Sonst kein Kontext fuer den Tag.

---

## Block B — Patch fuer §5.2 Inbox (am Ende einfuegen)

**Wenn der Inbox-Header `output_kind: briefing` enthaelt** (oder `source: cron` zusammen mit einer Briefing-/Report-Routine), ist das ein **Briefing-Cron**. Behandle ihn nach **§5.8 Cron-Briefings** und uebernimm die dort genannten Frontmatter-Felder unveraendert in deine Outbox-Reply — sonst landet das Briefing im allgemeinen Chat statt im Briefings-Tab des Mana Hub.

---

## Block C — Patch fuer §5.3 Outbox (als zusaetzlicher Bullet bei Pflicht-Konventionen)

- **Bei Briefing-Crons (Inbox-Header zeigt `output_kind: briefing` oder `source: cron`):**
  zusaetzlich zu den Pflichtfeldern oben **alle** folgenden Felder UEBERNEHMEN — exakt aus dem Inbox-Header kopiert:
  ```yaml
  type: reply
  output_kind: briefing
  source: cron
  job_id: <wert aus inbox>
  job_name: <wert aus inbox>
  briefing_title: "<wert aus inbox>"
  agent: <AGENT_NAME>
  category: Morning            # 'Morning' fuer Morgenbriefings, sonst Routine-Name
  urgency: normal              # low/normal/high/critical — siehe §5.8
  ```
  Ohne diese Felder erkennt der Mana Hub das Briefing nicht und es landet im Chat — Pflicht.
