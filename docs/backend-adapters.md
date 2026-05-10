# Backend Adapters

Mana Hub Starter supports Supabase out of the box, but the product should not be conceptually locked to Supabase.

The v1 starter uses server routes and Supabase helpers directly. Future custom backends should keep that dependency behind an adapter boundary instead of leaking host-specific code into UI components.

## Supported in v1

- `demo`: local preview without real persistence
- `supabase`: default production path with Supabase Auth, Postgres, RLS, Realtime, and Storage
- `tmux` runner: optional local host runner for interrupting active agent sessions
- `custom connector`: user-owned process that reads/writes the same API contracts

## Extension Point

Installers who do not use Supabase can implement a custom adapter behind the `ManaHubBackendAdapter` interface.

Expected resources:

- issues / tasks
- approvals
- agents
- messages
- message lifecycle metadata (`active`, `edited`, `superseded`, `retracted`)
- projects / workspaces
- goals / outcomes
- jobs
- skills
- knowledge references
- file attachment metadata
- stop/control events

## Rule

UI and product logic should move toward service calls like:

```ts
manaHubDb.issues.list()
manaHubDb.approvals.list()
manaHubDb.health.check()
```

Direct `supabase.from(...)` calls should stay inside the Supabase adapter or server routes that are explicitly marked as Supabase-only.

## Message Lifecycle Contract

Connectors must treat `agent_messages.metadata.lifecycle_status` as authoritative:

- `retracted`: do not process.
- `superseded`: do not process; prefer the referenced edited message.
- `edited`: process as the current user intent.
- missing or `active`: process normally.

## Stop Contract

`POST /api/agents/[id]/stop` records a stop event and may interrupt a host runner. A custom connector should either interrupt the live process or mark its own work as stopped so the dashboard does not keep waiting.

## Attachment Contract

Attachments are passed through `agent_messages.metadata.attachments`. Connectors should pass supported files to the agent runtime and degrade gracefully when a file type cannot be processed.
