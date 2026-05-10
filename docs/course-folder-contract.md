# Course Folder Contract

This starter keeps the course structure explicit so a fresh install does not depend on hidden host files.

## Required Learning Areas

| Course Area | Starter Path | Purpose |
| --- | --- | --- |
| Templates | `templates/` | Copyable agent, config, and workspace templates. |
| Bridge | `bridge/` | Local connector/runner notes and placeholder contracts. |
| Supabase | `supabase/migrations/` | Core SQL schema for a fresh user project. |
| Skills | `.cursor/skills/` and `skills/` | Install Helper plus user-facing skill examples. |
| Dashboard | `src/app/dashboard/agents/` and `dashboard/` | Production dashboard code plus a course map. |
| User Config | `user.config/` | User-owned agent, branding, and connector configuration examples. |
| Workspace | `workspace/` | User-owned Knowledge Base and skill workspace examples. |

## Update Rule

The paths `user.config/` and `workspace/` are user-owned. Core updates may add examples, migrations, docs, and dashboard features, but they must not overwrite user-specific files.

## Course Coverage

- Supabase lessons use `supabase/migrations/000_mana_hub_core.sql`.
- Agent boilerplate lessons use `templates/agent-boilerplate/README.md` and the
  surrounding files (`CLAUDE.md`, `MEMORY.md`, `CURRENT.md`, `.mcp.json`,
  `.claude/settings.json`, `inbox/`, `outbox/`, `memory/`).
- Bridge lessons use `bridge/README.md`, `docs/bridge-modes.md`, and
  `docs/bridge-persistence.md`.
- Knowledge Base lessons use `templates/knowledge-base/INDEX.md` (shipped
  template) and `workspace/knowledge.example/INDEX.md` (example workspace).
- Skill lessons use `.cursor/skills/mana-hub-install-helper/` and `skills/README.md`.
- Dashboard lessons use `src/app/dashboard/agents/` and the in-app Documentation page.
