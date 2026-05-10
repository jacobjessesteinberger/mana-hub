# Migrations

Run the SQL files in `supabase/migrations/` in **alphabetical order** in the
Supabase SQL editor (or via the Supabase CLI).

Every migration in this repo is **idempotent** — re-running the same file on
the same project is safe and a no-op.

## Order matters

The bundled CLI / dashboard does not auto-track which migrations have been
applied. You are responsible for applying them in order. Sorted alphabetically
they line up correctly:

| # | File | What it does |
| --- | --- | --- |
| 1 | `000_mana_hub_core.sql` | Core tables (`agent_messages`, `agent_heartbeats`, `agent_activity`, `projects`, `goals`, `issues`, `issue_comments`, `issue_runs`, `approvals`, `approval_policies`, `agent_cron_jobs`, `cron_requests`, `agent_profiles`, `briefing_user_state` placeholder), pgcrypto extension, default RLS policies. |
| 2 | `010_planning_context.sql` | Adds planning context columns to issues / projects. |
| 3 | `014_chat_attachments.sql` | Notes for chat attachment metadata. |
| 4 | `015_add_metadata_column.sql` | Adds the `metadata JSONB` column to `agent_messages`. |
| 5 | `020_activity_permissions.sql` | Adds activity / runner permission columns. |
| 6 | `20260426_agent_briefing_metadata.sql` | Briefing-specific fields and indexes for `agent_messages`. |
| 7 | `20260426_agent_cron_runbooks.sql` | Adds runbook + skill_refs columns to `agent_cron_jobs`. |
| 8 | `20260426_approvals_risk_queue.sql` | Risk fields (`action_summary`, `risk_level`, `risk_reason`, `requested_at`) on `approvals`. |
| 9 | `20260426_automation_requests_upgrade.sql` | Cron-request upgrade fields. |
| 10 | `20260426_briefing_user_state.sql` | `briefing_user_state` table + per-user RLS example. |
| 11 | `20260426_goals_outcome_tracking.sql` | Outcome-tracking columns on `goals` (`tracking_source`, `confidence`, etc.). |
| 12 | `20260426_issues_workflow_os.sql` | Workflow-OS columns on `issues`. |
| 13 | `20260509_approval_policies_learning.sql` | Always-Policies learning columns on `approval_policies` and `approvals`. |
| 14 | `20260510_push_subscriptions.sql` | `push_subscriptions` table for Web-Push browser endpoints. |

When you add a new migration, give it an ISO-date prefix
(`YYYYMMDD_short_name.sql`) and document it in the table above.

## RLS

`000_mana_hub_core.sql` enables Row-Level Security on every table and ships
**permissive single-tenant policies** (`USING (true) WITH CHECK (true)` for
authenticated). Tighten them before letting more than one human into your
Supabase project. See `SECURITY.md`.

## Rules for adding migrations

- Prefer additive migrations (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).
- Never drop user tables in minor updates.
- Never overwrite user data.
- Wrap policy / constraint creation in `DROP … IF EXISTS` or `DO $$ … $$` blocks
  so re-runs stay safe.
- Keep demo seed data out of production migrations.
- Document breaking changes in `UPGRADE.md`.

## Initial setup

1. Create your own Supabase project.
2. Open the SQL editor (or use the Supabase CLI).
3. Paste and run each migration file in alphabetical order.
4. Run `npm run doctor` to verify the schema substring checks pass.
5. Confirm with `docs/fresh-install-checklist.md`.

## Demo data

Demo data lives in the dashboard runtime (when `MANA_HUB_DEMO_MODE=true`),
not in production migrations.
