# Knowledge Base Template

Generic Karpathy-Wiki-Pattern Knowledge-Base-Skelett. Wird in Modul 4.1 des Kurses nach `~/<your-name>-knowledge/` kopiert und ueber einen Symlink an Agents gehaengt.

## Was ist drin

```
templates/knowledge-base/
  INDEX.md                 # Inhaltsverzeichnis + Lade-Regeln
  firma/                   # Firmen-Eckdaten
    uebersicht.md
    team.md
    okrs.md
    entscheidungen.md
  projekte/                # Pro Projekt eine Datei
  workflows/               # Wiederkehrende Prozesse
  templates/               # Vorlagen (Briefings, Angebote)
  finanzen/                # Verbindlichkeiten, Cashflow
```

## Verwendung

Im Kurs Lesson 4.1 mit Cursor-Prompt #22:

```bash
cp -R templates/knowledge-base ~/<your-name>-knowledge
```

In Lesson 4.2 mit Cursor-Prompt #24 wird ein Symlink erstellt:

```bash
ln -s ~/<your-name>-knowledge ~/agents/<agent-name>/knowledge-base
```

Anschliessend wird die `CLAUDE.md` des Agents um die KB-Lade-Regel ergaenzt.

## Pattern-Regeln (siehe INDEX.md)

- Markdown only
- Max 200 Zeilen pro Datei
- Eine Information, ein Ort
- Aktualitaet vor Vollstaendigkeit

## Wichtig

Diese Templates enthalten nur **synthetische Platzhalter** ([Beispiel Firma GmbH], [Person A] etc.). Echte Firmen-, Team- oder OKR-Daten gehoeren ausschliesslich in deine lokale Kopie unter `~/<your-name>-knowledge/`, niemals in den Core.
