<!--
  Drop-in CLAUDE.md snippet for an agent that should request human approval
  before performing sensitive actions (money, external systems, destructive
  operations, contracts, ...).

  Approval requests appear in the Mana Hub at /dashboard/agents/approvals
  with three buttons: Reject, Allow once, Allow always. "Allow always" stores
  a policy that auto-approves identical action_types in the future (no UI
  prompt). The agent receives the decision via a normal inbox message with
  metadata.kind = 'risk_approval_decision'.

  HOW TO USE
  ----------
  1. Copy the two blocks below into your agent's CLAUDE.md:
       - Block A → as a new "§4.5 Risk-Approval-Protokoll" section inside §4 Grenzen
       - Block B → as a one-paragraph addition at the end of "§5.2 Inbox"
  2. Replace every <AGENT_NAME> with your agent's lowercase name (e.g. "orchestrator", "researcher").
  3. Tune the "Welche Aktionen sind sensibel" list (Block A) to your agent's domain.
     The defaults below cover money, external systems, destructive ops, contracts.
  4. Make sure the bridge is running with BRIDGE_MODE=file_drop and the
     migration `20260509_approval_policies_learning.sql` has been applied.

  Reference: docs/risk-approval.md
-->

---

## Block A — §4.5 Risk-Approval-Protokoll (Pflicht bei sensiblen Aktionen)

Bei sensiblen Aktionen schreibst du **keine normale Reply** und fuehrst die Aktion **nicht direkt aus**. Stattdessen schreibst du eine Approval-Request-Outbox-Datei und wartest auf eine Decision-Inbox-Message zurueck.

### Welche Aktionen sind "sensibel"

Anker (nicht abschliessend):

- **Finanzen**: Bankkonto verbinden/oeffnen/schliessen, Zahlung ausloesen, Rechnung versenden, Budget freigeben, Subscription buchen.
- **Externe Identitaeten**: OAuth-/API-Token erzeugen oder rotieren, neue Connector/Webhook anlegen, Zugang zu Dritt-Konten geben.
- **Externe Kommunikation**: E-Mail an Dritte senden, Social-Post veroeffentlichen, Kommentar antworten, DM versenden.
- **Destruktive Operationen**: Datenbank-Eintraege loeschen, Files unwiderruflich loeschen, Branch/Repo loeschen, User entfernen.
- **Strategische Tragweite**: Vertrag unterschreiben, Preis aendern, neue Marke registrieren, Domain kaufen.
- **Personal**: HR-Schritte, Vertrag oder Aufgabe an externen Freelancer.

Im Zweifel: **als sensibel behandeln und Approval anfordern**. Lieber einmal zu oft fragen als einmal zu wenig.

### Wie der Approval-Request aussieht

Du schreibst eine ganz normale Outbox-Datei `reply-<TS>-<short-id>.md`, aber im YAML-Header setzt du `type: approval_request` und alle Approval-Felder:

```yaml
---
reply_to_id: <id aus Inbox>
created_at: <ISO-Timestamp>
type: approval_request
action_type: <stable kebab-case kategorie, z.B. external.bank.connect, finance.invoice.send>
action_summary: "<1-Satz-Beschreibung was du genau tun willst, max 240 Zeichen>"
risk_level: critical          # low | medium | high | critical
risk_reason: "<warum risikoreich, wer/was wird beruehrt, was waere der Schaden bei Missbrauch>"
action_payload: '{"key":"value"}'  # optional, JSON-Objekt mit Details
---

<Im Body: ehrliche Beschreibung deines geplanten Vorgehens, welche Tools/MCPs du verwenden wuerdest. Hilft <USER_NAME> die Entscheidung zu treffen.>
```

`action_type` ist die **Lerneinheit** des Systems. Wenn <USER_NAME> dieselbe `action_type` einmal "Immer erlauben" markiert, wird sie zukuenftig automatisch durchgewunken. **Halte dich strikt an stabile Namen** und mach dir bei jeder neuen Kategorie kurz Gedanken, ob du nicht eine bestehende verwenden kannst.

### Was passiert nach dem Request

1. Bridge sieht `type: approval_request` und schreibt einen Eintrag in die Mana-Hub `approvals`-Tabelle (statt einer normalen Reply). Im Chat von <USER_NAME> erscheint eine kurze System-Notiz mit der Approval-ID.
2. <USER_NAME> hat im Risk-Approval-Tab drei Knoepfe: **Ablehnen**, **Einmalig freigeben**, **Immer erlauben**.
3. Sobald <USER_NAME> entscheidet, bekommst du eine **neue Inbox-Message** mit YAML-Header:
   ```yaml
   kind: 'risk_approval_decision'
   approval_id: <UUID>
   decision: approved   # oder rejected
   action_type: <kebab-case>
   auto_approved: false # true wenn durch Always-Policy
   policy_name: <wenn auto>
   ```
4. Du matched `approval_id` mit deinem Pending-State und reagierst:
   - **`decision: approved`** → die ursprueliche Aktion **jetzt** ausfuehren. Kurz bestaetigen, Ergebnis dokumentieren.
   - **`decision: rejected`** → Aktion **nicht** ausfuehren. Bestaetigen, evtl. risikoaermere Alternative vorschlagen.

### Pending-State haltbar machen

Du laeufst in einer langen tmux-Session und die Decision kann Stunden spaeter eintreffen. Damit du nicht vergisst:

- Lege eine Datei `memory/pending-approvals.md` an (falls nicht da).
- Eintrag pro offenem Request, neueste oben:
  ```markdown
  ## <approval-id-shortened> — <action_type> — <ISO-Timestamp>

  - reply_to_id: <inbox-id>
  - action_summary: <was wolltest du tun>
  - status: pending
  - context: <warum hast du das angefragt>
  - geplante Schritte bei approval: <kurze Liste>
  ```
- Sobald Decision-Message reinkommt: Status auf `approved` oder `rejected` setzen, Datum vermerken.

### Was du NICHT tust

- Keine sensiblen Aktionen ohne `type: approval_request`. Auch wenn <USER_NAME> im Chat sagt "mach mal" — wenn die Aktion in die obige Liste faellt, **trotzdem Approval-Request** schreiben (mit niedrigerer `risk_level` und `risk_reason: "im Chat genehmigt — formaler Request fuer Audit-Trail"`).
- Keine `type: approval_request`-Replies, die du selbst direkt ausfuehrst. Du wartest.
- Keine Verkettung mehrerer sensibler Aktionen in einem Request. Jede sensible Aktion bekommt ihren eigenen.
- Keine Auto-Wiederholung bei Ablehnung. Vorher mit <USER_NAME> klaeren.

---

## Block B — Patch fuer §5.2 Inbox (am Ende einfuegen)

**Wenn der Inbox-Header `kind: risk_approval_decision` enthaelt** (z.B. nach einem von dir vorher angelegten Approval-Request), ist das **nicht** eine neue User-Anfrage, sondern die Antwort auf deinen pending Approval. Du:

1. Liest `approval_id`, `decision`, `action_type` aus dem Header.
2. Suchst diesen `approval_id` in `memory/pending-approvals.md`.
3. Bei `decision: approved`: fuehrst die ursprueliche Aktion jetzt aus, dokumentierst das Ergebnis im Reply, markierst den Eintrag als `status: approved`.
4. Bei `decision: rejected`: fuehrst die Aktion nicht aus, dokumentierst die Ablehnung, markierst als `status: rejected`. Schlaegst ggf. eine risikoaermere Alternative vor.
5. Wenn `auto_approved: true` ist, wurde die Aktion durch eine zuvor angelegte Always-Policy ohne <USER_NAME>s Eingriff freigegeben — fuehre sie genauso aus, aber erwaehne im Reply, durch welche `policy_name` die Auto-Freigabe erfolgte.

Siehe **§4.5 Risk-Approval-Protokoll** fuer den vollen Workflow.
