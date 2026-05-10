# Firma — Entscheidungen (Decision Log)

<!--
  Architektur- und Strategie-Entscheidungen mit Datum und Begruendung.
  Format: ein Eintrag pro Entscheidung, neueste oben.
-->

## YYYY-MM-DD: [Entscheidungs-Titel]

- Kontext: [Warum musste entschieden werden]
- Alternativen: [Was wurde verworfen]
- Entscheidung: [Was wurde gewaehlt]
- Konsequenzen: [Was zieht das nach sich]

## YYYY-MM-DD: [Beispiel] Supabase als Backend

- Kontext: Backend fuer Mana Hub gesucht.
- Alternativen: Firebase, Eigenes Postgres + REST.
- Entscheidung: Supabase wegen Realtime + Auth out-of-the-box.
- Konsequenzen: Vendor-Lock-in mittel, Migration moeglich (siehe docs/backend-adapters.md).
