# Knowledge Base — Index

<!--
  This is the entry point for your agent's knowledge base.
  Pattern: Karpathy Wiki — flat Markdown, one topic per file, max 200 lines.
  Agents read INDEX.md first, then load 1-3 relevant files on demand.
-->

## Wie diese Knowledge Base genutzt wird

- Markdown only — keine PDFs, keine Word-Dokumente
- Eine Information, ein Ort — keine Duplikate
- Maximal 200 Zeilen pro Datei — sonst splitten
- Aktualitaet vor Vollstaendigkeit — veraltete Infos loeschen, nicht archivieren
- Quellen angeben (woher, wann gepruft) wenn relevant

## Inhaltsverzeichnis

### firma/
- `uebersicht.md` — Kerndaten der Firma
- `team.md` — Team und Rollen
- `okrs.md` — Aktuelle OKRs / Ziele
- `entscheidungen.md` — Architektur-Entscheidungen, Strategie-Calls

### projekte/
Pro Projekt eine Datei. Beispiel: `projekt-alpha.md`, `projekt-beta.md`.

### workflows/
Wiederkehrende Prozesse. Beispiel: `wochen-retro.md`, `release-checkliste.md`.

### templates/
Vorlagen fuer wiederkehrende Outputs. Beispiel: `briefing-template.md`, `angebot-template.md`.

### finanzen/
- `uebersicht.md` — Cashflow, Verbindlichkeiten in Kuerze
- `verbindlichkeiten.md` — Detail-Liste

## Lade-Regeln fuer Agents

Wenn der Agent eine Anfrage erhaelt, soll er:

1. INDEX.md lesen (diese Datei)
2. 1-3 relevante Topic-Files identifizieren
3. Nur diese Files laden — niemals die ganze Knowledge Base auf einmal
4. Wenn Information fehlt: "Ich finde dazu nichts in der Knowledge Base" sagen, statt zu raten
