# Cron-Jobs & Briefings

How cron triggers an agent, how the agent must reply, and how that reply ends up in the **Briefings** tab of the Mana Hub dashboard (instead of the regular chat).

This is the canonical reference. Cursor/Claude can read this file when setting up a cron-driven briefing for any agent.

---

## End-to-end flow

```
agent_cron_jobs (Supabase row, output_kind='briefing')
        │
        │  every BRIDGE_CRON_TICK_INTERVAL_MS (default 5 min)
        ▼
bridge/src/cron.ts → triggerJob()
        │   - generates a UUID for cronMessage.id
        │   - writes inbox/cron-<TS>-<id>.md with YAML frontmatter
        │     including output_kind, source: cron, job_id, job_name, briefing_title
        │   - appends prompt instructing the agent to mirror those fields
        ▼
~/agents/<agent>/inbox/cron-<TS>-<id>.md
        │
        │  agent (Claude Code) processes oldest inbox file first
        │  reads MEMORY/CURRENT/KB, writes reply file
        ▼
~/agents/<agent>/outbox/reply-<TS>-<id>.md
        │   YAML frontmatter must include:
        │     reply_to_id, created_at,
        │     type: reply, output_kind: briefing, source: cron,
        │     job_id, job_name, briefing_title, agent, category, urgency
        ▼
bridge/src/file-drop.ts → dispatchOutboxReply()
        │   - parses frontmatter
        │   - lifts well-known fields into top-level metadata
        │   - inserts row into agent_messages with metadata.kind=briefing,
        │     metadata.source=cron, metadata.title, metadata.category, metadata.urgency
        ▼
agent_messages row
        │
        │  src/lib/agents/briefings.ts → isBriefingRow()
        │  any of these matches → row appears in Briefings tab:
        │    metadata.kind === 'briefing'
        │    metadata.source === 'cron'
        │    metadata.job_name matches /briefing|report|maintenance/i
        │    content has 'output_kind: briefing' or 'source: cron' frontmatter
        │    content title matches one of STRICT_BRIEFING_PATTERNS
        ▼
/dashboard/agents/briefings (UI)
```

If any of those frontmatter fields are missing on the **agent reply**, the message falls back to the regular chat. That is the single most common bug, and the entire system below is designed to prevent it.

---

## `agent_cron_jobs` table (relevant columns)

Defined in `supabase/migrations/000_mana_hub_core.sql` and `supabase/migrations/20260426_automation_requests_upgrade.sql`.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (PK) | e.g. `orchestrator-morning-briefing` (kebab-case, stable, used as `job_id` everywhere) |
| `agent_id` | TEXT | Lowercase agent name, must match `~/agents/<agent_id>/` and `BRIDGE_AGENT_NAMES` |
| `name` | TEXT | Human label, e.g. `Morning Briefing` (becomes `briefing_title` and `metadata.title`) |
| `description` | TEXT | Optional, helps the agent understand context |
| `prompt` | TEXT | What the bridge sends as the inbox body. Be explicit. The bridge auto-appends a YAML mirror-block when `output_kind='briefing'`. |
| `enabled` | BOOLEAN | `true` for active jobs |
| `schedule_hour` | INTEGER 0-23 | Local time hour |
| `schedule_minute` | INTEGER 0-59 | **Should be a multiple of 5** (default tick interval is 300_000 ms; non-multiples may be missed) |
| `schedule_day` | INTEGER 0-6 | `null` = every day, otherwise weekday (0=Sunday, 6=Saturday) |
| `output_kind` | TEXT | `'briefing'`, `'cron'`, `'task'`, `'outcome'`, `'finance_action'`. **Use `'briefing'` for anything that should appear in the Briefings tab.** |
| `automation_type` | TEXT | `'agent_cron'` for our use case |

The CLI helper `scripts/create-cron-job.ts` (`npm run cron:create -- --help`) creates rows with safe defaults.

---

## What the agent must put into the reply frontmatter

For any inbox file with `kind: cron` and (`output_kind: briefing` OR `source: cron`), the agent's outbox reply must have **all** of these fields:

```yaml
---
reply_to_id: <id from inbox header — must be a UUID>
created_at: <ISO timestamp>

type: reply
output_kind: briefing
source: cron
job_id: <copy from inbox>
job_name: <copy from inbox>
briefing_title: <copy from inbox, with quotes if it contains spaces>
agent: <agent name, lowercase>
category: <Morning | Evening | Maintenance | Finance | Social | Research | ...>
urgency: <low | normal | high | critical>
---
```

`category` and `urgency` are author-defined. `briefings.ts` will infer them if they are missing, but supplying them explicitly is more deterministic. See `inferBriefingCategory()` and `inferBriefingUrgency()` in `src/lib/agents/briefings.ts` for the inference logic.

A drop-in copy-paste block for the agent's `CLAUDE.md` lives at `templates/agent-boilerplate/snippets/briefing-routine.md`.

---

## Recommended `category` values

The Briefings UI groups by `metadata.category`. Common values:

- `Morning` — daily morning briefing
- `Evening` — end-of-day wrap-up
- `Maintenance` — system / health checks
- `Finance` — invoice, revenue, runway summaries
- `Social` — YouTube/Instagram/TikTok performance
- `Research` — AI/tech news scan
- anything else — also fine, will be shown as its own group

---

## Recommended `urgency` values

| Value | When to use |
|---|---|
| `low` | Quiet day, purely informational |
| `normal` | Default — nothing burning |
| `high` | A sprint goal slips today, a deadline wobbles, a measurable risk surfaces |
| `critical` | Real emergency — money, security, contracts, data loss |

---

## Why `reply_to_id` must be a UUID

`agent_messages.reply_to_id` is `UUID NOT NULL`'s nullable cousin (`UUID NULL`). If the agent's reply mirrors a non-UUID id, the database insert fails with Postgres `22P02` ("invalid input syntax for type uuid") and the reply is silently dropped — neither the chat nor the Briefings tab show it.

`bridge/src/cron.ts` generates `randomUUID()` for every cron trigger since the Mai 2026 fix. `bridge/src/file-drop.ts` defensively sets `reply_to_id` to `null` if the agent mirrors a non-UUID id, so even a malformed reply still lands as an "orphan" briefing row instead of being lost.

If you're creating cron jobs by hand, make sure the **trigger UUID** that the bridge generates is the one the agent echoes back — never invent a stable id like `cron-<job>-<ts>`.

---

## Creating a cron job (recommended path)

Use the CLI helper. It loads `.env.local`, validates input, and upserts:

```bash
npm run cron:create -- \
  --agent orchestrator \
  --id orchestrator-morning-briefing \
  --name "Morning Briefing" \
  --schedule "07:30" \
  --output-kind briefing \
  --prompt "Schreib mir das taegliche Morgenbriefing nach §5.8."
```

`--id` is the stable kebab-case identifier (becomes `job_id` in metadata everywhere). `--schedule` accepts `HH:MM` in 24h local time. Minute must be a multiple of 5 — the helper warns otherwise.

Re-running the same command updates the existing row (UPSERT on `id`).

To delete: `npm run cron:create -- --id <job-id> --delete`.

To list: `npm run cron:create -- --list`.

---

## Required CLAUDE.md additions for any agent that should run briefings

Drop the contents of `templates/agent-boilerplate/snippets/briefing-routine.md` into your agent's `CLAUDE.md` as a new section (typical placement: §5.8 Cron-Briefings). Replace `<AGENT_NAME>` with the agent's actual lowercase name. The snippet contains:

1. The full Cron-Briefing protocol (what to do when an inbox file has `output_kind: briefing`).
2. The Outbox-Frontmatter contract (the YAML block above).
3. A concrete body format (Wetter / Heute anstehend / Mein Vorschlag — adjustable).
4. Data-source guidance (Perplexity for weather, KB for context).
5. Forbidden patterns (no replies without frontmatter, no fabricated data).

You should also patch §5.2 (Inbox handling) and §5.3 (Outbox conventions) to reference the new section. The snippet header explains exactly which lines to add.

---

## Verifying it works end-to-end

After creating the cron job and updating the agent's `CLAUDE.md`:

1. **Manual trigger** (don't wait for the schedule):
   ```bash
   tmux send-keys -t <agent> "process_inbox" Enter
   ```
   or drop a hand-written `cron-*.md` into `~/agents/<agent>/inbox/` (with the same frontmatter the bridge would write — see `bridge/src/file-drop.ts` `writeInboxMessage`).

2. **Watch the agent** in tmux: `tmux attach -t <agent>` — confirm it reads the inbox file and writes a reply file in `outbox/`.

3. **Check the bridge log** for `[file-drop] dispatched reply` — confirms the row was inserted into `agent_messages`.

4. **Check Supabase**:
   ```sql
   SELECT id, role, metadata->>'kind' AS kind,
          metadata->>'source' AS source,
          metadata->>'title' AS title,
          metadata->>'category' AS category,
          metadata->>'urgency' AS urgency
   FROM agent_messages
   WHERE agent_name = '<agent>'
   ORDER BY created_at DESC
   LIMIT 5;
   ```
   The newest row must have `kind=briefing`, `source=cron`, populated `title`, `category`, `urgency`.

5. **Open the dashboard** → `/dashboard/agents/briefings` → the briefing must appear in its category column.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Briefing in chat instead of Briefings tab | Agent reply is missing `output_kind: briefing` and `source: cron` in its YAML frontmatter. Check `outbox/processed/reply-*.md`. |
| Cron fires but nothing in `agent_messages` | `reply_to_id` is not a UUID. Should not happen since the Mai 2026 fix — verify `bridge/src/cron.ts` line that does `randomUUID()`. |
| Cron does not fire on schedule | `schedule_minute` is not a multiple of 5 and the bridge tick missed the exact minute. Set `BRIDGE_CRON_TICK_INTERVAL_MS=60000` in `bridge/.env`, or use multiples of 5. |
| Bridge logs `Job <id> output_kind=cron` although you wanted briefing | The DB row's `output_kind` column is still `'cron'`. Re-run `npm run cron:create -- --id <id> --output-kind briefing`. |
| Agent ignores the cron file | `BRIDGE_MODE=file_drop` and `BRIDGE_AGENT_NAMES` includes the agent? tmux session is up? See `docs/bridge-modes.md`. |

---

## Related files

- `bridge/src/cron.ts` — schedules and writes inbox files
- `bridge/src/file-drop.ts` — `writeInboxMessage`, `dispatchOutboxReply`
- `src/lib/agents/briefings.ts` — `isBriefingRow`, inference helpers
- `src/app/api/agents/trigger/route.ts` — manual UI trigger (mirrors the cron contract)
- `src/app/dashboard/agents/briefings/page.tsx` — the UI
- `templates/agent-boilerplate/snippets/briefing-routine.md` — drop-in CLAUDE.md block
- `scripts/create-cron-job.ts` — `npm run cron:create`
