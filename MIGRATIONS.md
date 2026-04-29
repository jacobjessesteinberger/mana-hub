# Migrations

Run the SQL files in `supabase/migrations` in order.

Supabase is the supported v1 backend. If you use a custom backend, implement the equivalent schema behind your adapter.

## Rules

- Prefer additive migrations.
- Do not drop user tables in minor updates.
- Do not overwrite user data.
- Keep demo seed data separate from production migrations.
- Document breaking changes in `UPGRADE.md`.

## Initial Setup

1. Create your own Supabase project.
2. Open the SQL editor or use the Supabase CLI.
3. Run `supabase/migrations/000_mana_hub_core.sql`.
4. Add later migration files in chronological order.

## Initial Core Tables

The initial migration covers:

- `agent_messages` with metadata, replies, attachments, and lifecycle support
- `agent_heartbeats` with context-window usage
- `agent_activity` and `issue_runs` for runner state and stop-control
- `projects`, `goals`, and `issues` for Workspace Review and Outcomes
- `approvals` for Risk Approval
- `agent_cron_jobs` and `cron_requests` for Jobs & Skills

## Demo Data

Demo data must live in separate seed files, not in production migrations.
