# Risk Approval & Policy Learning

How an agent asks for human consent before doing something risky, how the user
decides (Reject / Allow once / Allow always), and how the system **learns** —
once a user clicks "Allow always", future requests with the same `action_type`
auto-approve without showing up in the UI.

This is the canonical reference. Cursor/Claude can read this file when wiring
risk approvals into a new agent.

---

## End-to-end flow

```
1. user inbox: "verbinde mein Bankkonto"
        │
        ▼
2. agent CLAUDE.md §4.5 detects: sensitive (money + external system)
        │
        ▼
3. agent writes outbox/reply-<TS>-<id>.md with:
     type: approval_request
     action_type: external.bank.connect
     action_summary: "..."
     risk_level: critical
     risk_reason: "..."
     action_payload: {...}
        │
        ▼
4. bridge dispatchOutboxReply (file-drop.ts) sees type: approval_request
        │
        │  → calls insertApprovalFromMarker (bridge/src/approvals.ts)
        │
        ▼
5. insertApprovalFromMarker:
     a) checks approval_policies for an enabled "always" policy matching
        (agent_name, action_type)
     b) if a policy matches:
          INSERT approvals row with status='approved',
                                   auto_approved_by_policy_id=<policy.id>,
                                   decided_by='policy:<policy.id>'
          INSERT agent_messages 'system' (kind='risk_approval_request')
          INSERT agent_messages 'user'   (kind='risk_approval_decision', auto_approved=true)
          UPDATE approval_policies set use_count=use_count+1, last_used_at=NOW()
        if no policy matches:
          INSERT approvals row with execution_status='waiting_approval'
          INSERT agent_messages 'system' (kind='risk_approval_request')
        │
        ▼
6. dashboard /dashboard/agents/approvals shows the pending card with
   three buttons: [Ablehnen] [Einmalig freigeben] [Immer erlauben]
        │
        ▼
7. user clicks one → PATCH /api/agents/approvals/[id] with body:
     { status: 'approved' | 'rejected', policy: 'once' | 'always' }
        │
        ▼
8. PATCH route:
   - UPDATE approvals row (status, decided_by, decided_at, execution_status)
   - if policy='always' and status='approved':
       INSERT approval_policies (trigger_type='action_type',
                                 trigger_value=<action_type>,
                                 agent_name=<agent>,
                                 source='manual',
                                 decided_by=<user.email>,
                                 enabled=true)
       UPDATE approvals.auto_approved_by_policy_id
   - INSERT agent_messages 'user' (kind='risk_approval_decision',
                                    decision=<status>,
                                    approval_id, action_type, ...)
        │
        ▼
9. bridge poll/realtime sees the new agent_messages row,
   writeInboxMessage promotes the metadata fields into YAML frontmatter,
   writes ~/agents/<agent>/inbox/msg-<TS>-<id>.md
        │
        ▼
10. agent reads inbox file, sees kind: risk_approval_decision,
    matches approval_id with memory/pending-approvals.md,
    executes the original action (or skips on rejection)
```

`role: 'system'` agent_messages (the "request notice") are skipped by the
bridge's `decide()` function — they only show up in the dashboard chat, never
loop back to the agent's inbox. That's how the chat sees "<agent> hat Approval X
angefragt" without re-triggering the agent.

---

## Database schema

### `approvals` (extended in `20260509_approval_policies_learning.sql`)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `agent_name` | TEXT | Lowercase, matches agent dir + bridge config |
| `action_type` | TEXT | Stable kebab-case category (e.g. `external.bank.connect`). The matching key for always-policies. |
| `action_payload` | JSONB | Free-form details (recipient, amount, scopes, ...) |
| `action_summary` | TEXT | One-sentence description, escaped HTML |
| `risk_level` | TEXT | `low` / `medium` / `high` / `critical` |
| `risk_reason` | TEXT | Why this is risky |
| `status` | TEXT | `pending` / `approved` / `rejected` |
| `execution_status` | TEXT | `waiting_approval` / `approved_for_execution` / `rejected` / `executed` / `failed` / `expired` |
| `decided_by` | TEXT | User email or `policy:<policy_id>` for auto-approval |
| `decided_at` | TIMESTAMPTZ | |
| `feedback_sent_at` | TIMESTAMPTZ | When the decision message was inserted into agent_messages |
| `auto_approved_by_policy_id` | UUID | NULL if decided manually, otherwise references `approval_policies.id` |
| `expires_at` | TIMESTAMPTZ | Optional: pending requests can auto-expire |
| `policy_id` | UUID | Optional: a request can be created in the context of an existing policy (e.g. for cron-driven automations) |
| `related_issue_id` | UUID | Optional link to an issue thread |

### `approval_policies` (extended in same migration)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `name` | TEXT | Human label, e.g. `Always: external.bank.read` |
| `description` | TEXT | Auto-generated when created via "Immer erlauben" UI button |
| `trigger_type` | TEXT | `'action_type'` for the learning workflow (the only type currently supported) |
| `trigger_value` | TEXT | The exact `action_type` string this policy auto-approves |
| `agent_name` | TEXT | Optional scope. NULL = global (any agent), otherwise per-agent |
| `source` | TEXT | `'manual'` (user clicked Always) / `'inferred'` (some heuristic added it) / `'system'` |
| `decided_by` | TEXT | User email who created the policy |
| `enabled` | BOOLEAN | Soft-delete via `enabled=false` instead of hard-delete |
| `use_count` | INTEGER | How many requests this policy has auto-approved |
| `last_used_at` | TIMESTAMPTZ | Most recent auto-approval |

Lookup index: `idx_approval_policies_lookup ON (agent_name, trigger_value, enabled) WHERE trigger_type='action_type'` — fast for `POST /api/agents/approvals` policy check.

---

## Agent contract (`type: approval_request`)

The agent writes a normal `outbox/reply-<TS>-<id>.md` but with `type: approval_request` in the frontmatter. The full set of recognised fields:

```yaml
---
reply_to_id: <id of the original inbox message>
created_at: <ISO timestamp>

type: approval_request                  # mandatory marker
action_type: <kebab-case category>      # mandatory; matching key for always-policies
action_summary: "<one sentence>"        # used as the card title in UI
risk_level: critical                    # low | medium | high | critical
risk_reason: "<why>"                    # used as the card subtitle
action_payload: '{"key":"value"}'       # optional JSON, kept in approvals.action_payload
---

<body: the agent's plan, in markdown — used as the description in the UI>
```

The body is also used as `action_summary` if the frontmatter doesn't supply one (first non-empty line, max 240 chars).

If the request misses `action_type`, the bridge logs and skips. The reply file is still moved to `outbox/processed/` so the agent doesn't loop.

---

## Decision contract (back to the agent)

After the user (or an always-policy) decides, the agent receives a normal inbox message with this YAML frontmatter:

```yaml
---
id: <UUID of the agent_messages row>
agent_name: <agent>
role: user
created_at: <ISO timestamp>
kind: risk_approval_decision            # NEW — promoted by writeInboxMessage
approval_id: <UUID of the original approval>
decision: approved                       # or rejected
action_type: <kebab-case>                # echoed for matching
action_summary: <copied>
auto_approved: false                     # true if an always-policy decided
policy_name: <only present if auto_approved=true>
---

Risk Approval genehmigt: <action_summary>
Approval-ID: <UUID>
Action-Type: <kebab-case>
Risiko-Level: <level>
Auto-genehmigt durch Policy: <name>      # only if auto
Begruendung:
<reason or "Keine zusaetzliche Begruendung hinterlegt.">

Du darfst die beantragte Aktion jetzt ausfuehren. Nutze exakt den genehmigten Scope und dokumentiere das Ergebnis.
```

The agent matches `approval_id` against its `memory/pending-approvals.md` (see snippet) and either runs the action (on `approved`) or skips it (on `rejected`).

---

## What the user sees in the UI

`/dashboard/agents/approvals`:

- **Pending list** — one card per pending approval, with three buttons:
  - **Ablehnen** → PATCH `{status: 'rejected'}`
  - **Einmalig freigeben** → PATCH `{status: 'approved', policy: 'once'}`
  - **Immer erlauben** → PATCH `{status: 'approved', policy: 'always'}` (also creates an `approval_policies` row)
- **Aktive Always-Policies** — list of currently enabled policies with use-count, last-used, who created them, and a Deaktivieren button (soft-delete: `enabled=false`).

Card visuals: risk level badge (Critical/High/Medium/Low), execution status badge, "Auto via Policy" badge for auto-approved cards.

---

## Recommended `action_type` naming

Stable kebab-case, hierarchical, agent-shareable. Examples:

- `external.bank.connect` — connect a bank account via OAuth
- `external.bank.read` — read transactions only
- `external.bank.write` — initiate a transfer
- `finance.invoice.send` — send an invoice to a third party
- `finance.subscription.purchase` — buy a subscription
- `social.youtube.publish` — publish a YouTube video / community post
- `social.instagram.dm` — send an Instagram DM
- `data.delete` — delete records (parameterise scope in `action_payload`)
- `oauth.token.create` — create a new long-lived OAuth token
- `legal.contract.sign` — sign a contract on behalf of the user
- `personnel.hire` — hire a freelancer

**Important**: `action_type` is the matching key for always-policies. The same string twice = same policy. Pick stable names; avoid free-form variations like `bank-connect`, `bankConnect`, `connect_bank`.

Per-agent policies vs global policies: when the user clicks "Immer erlauben", the policy is scoped to the **requesting agent** (`agent_name=<agent>`). To create a global policy (any agent can use it), insert into `approval_policies` directly with `agent_name=NULL`.

---

## Manual approval creation (for testing / scripts)

For cases where a non-agent piece of code wants to gate something:

```bash
curl -X POST http://localhost:3003/api/agents/approvals \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <session-token>" \
  -d '{
    "agent_name": "orchestrator",
    "action_type": "external.bank.connect",
    "action_summary": "Test approval card",
    "risk_level": "critical",
    "risk_reason": "Manual test",
    "action_payload": {"test": true}
  }'
```

Response includes `auto_approved: true/false` and `policy: {id, name}` if an always-policy auto-decided it.

---

## Verifying it works end-to-end

After applying the migration, restarting the bridge, and adding the §4.5 snippet to your agent's `CLAUDE.md`:

1. Send a sensitive prompt to the agent ("verbinde mein Bankkonto").
2. Check `~/agents/<agent>/outbox/processed/reply-*.md` — should have `type: approval_request`.
3. Check the bridge log for `[file-drop] approval ... pending — visible in Risk-Approval tab`.
4. Open `/dashboard/agents/approvals` — the card should appear with three buttons.
5. Click **Einmalig freigeben** — the agent should receive a decision-message inbox file within seconds and execute / acknowledge.
6. Repeat the same prompt → another card appears (one-shot, no policy created).
7. Click **Immer erlauben** — the agent reacts as in step 5, AND a new "Always-Policy" appears in the lower section of the page.
8. Repeat the same prompt a third time → **no card appears**, the agent receives an auto-approved decision-message immediately. Bridge log: `auto-approved by policy <id>`.

If step 4 shows nothing: check that `dispatchOutboxReply` in `bridge/src/file-drop.ts` recognises `type: approval_request` and that the migration applied (look for `approvals.auto_approved_by_policy_id` column).

If step 8 still shows a card: verify the `approval_policies` row exists with `enabled=true`, matching `trigger_value=<action_type>`, and `agent_name` either NULL or matching.

---

## Why two separate "approve" pathways exist

There are two conceptually different things in the codebase:

1. **`/api/agents/approvals`** + the `approvals` table — the system documented above. Application-level human-in-the-loop. The agent explicitly asks. The user clicks once / always / reject. **This is what users want for "Bank verbinden" type questions.**
2. **`/api/agents/approve`** + tmux send-keys — Claude Code's built-in *permission prompt* for filesystem/shell operations. Sends `1` / `2` / `3` to the tmux session to choose Allow once / Allow always / Deny. Only fires if the agent is started **without** `--dangerously-skip-permissions`. The 24/7 LaunchAgent template uses the flag, so this pathway is dormant by design.

These two pathways do not interact. If you want the *Claude Code built-in* prompt to feed back into the dashboard, that would be a separate integration (out of scope of this document).

---

## Related files

- `supabase/migrations/000_mana_hub_core.sql` — original `approvals` + `approval_policies` schema
- `supabase/migrations/20260426_approvals_risk_queue.sql` — risk-level / execution-status columns
- `supabase/migrations/20260509_approval_policies_learning.sql` — learning columns + lookup index
- `src/lib/agents/approvals.ts` — server-side helpers (policy lookup, decision message)
- `src/app/api/agents/approvals/route.ts` — POST (with always-policy auto-approve) + GET
- `src/app/api/agents/approvals/[id]/route.ts` — PATCH (with `policy: 'once'|'always'`)
- `src/app/api/agents/approval-policies/route.ts` — list policies
- `src/app/api/agents/approval-policies/[id]/route.ts` — disable policy
- `src/app/dashboard/agents/approvals/page.tsx` — UI (three buttons + policy list)
- `bridge/src/approvals.ts` — bridge-side approval marker handling
- `bridge/src/file-drop.ts` — `dispatchOutboxReply` recognises `type: approval_request`; `writeInboxMessage` promotes decision metadata
- `templates/agent-boilerplate/snippets/risk-approval-routine.md` — drop-in CLAUDE.md block
