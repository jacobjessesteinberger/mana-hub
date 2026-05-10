# Core and User Space

Mana Hub Starter is split into updateable Core and installer-owned User Space.

## Core

Core is shipped by the upstream Mana Hub Starter project and may change during updates:

- `src/`
- `supabase/migrations/`
- `scripts/`
- `docs/`
- `.cursor/skills/`
- `templates/`
- `bridge/`
- `skills/`
- `dashboard/`
- `*.example.*`

Core contains product code, schema, API contracts, examples, documentation, and install guidance.

## User Space

User Space belongs to the installer and must not be overwritten by Core updates:

- `.env.local`
- real `user.config/*.json` files
- real `workspace/` files
- private Knowledge Base content
- private agent directories
- private bridge or connector configs
- local MCP, cron, LaunchAgent, or runner state
- logs, exports, uploads, and secrets

## Update Strategy

1. Keep private setup in User Space.
2. Pull Core updates from upstream.
3. Review `UPGRADE.md` and `MIGRATIONS.md`.
4. Apply additive migrations.
5. Run `npm run doctor`, `npm run lint`, `npm run typecheck`, and a fresh smoke check.

For the direction of changes between Core and host projects, see `docs/core-host-sync.md`.

## Feature Additions

When a new Core feature needs user configuration, ship:

- a migration if database shape changes.
- an `.example` config file.
- a documentation section.
- a doctor check if setup can fail.
- a manual upgrade note in `UPGRADE.md`.

Do not silently write private defaults into user-owned files.
