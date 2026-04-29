# Mana Hub Starter

Mana Hub Starter is the blank, installable Mana Hub Core for building a self-hosted AI agent operations dashboard.

It includes the dashboard, Supabase schema, API contracts, Install Helper Skill, synthetic demo structure, update-safety rules, and documentation needed to connect your own agents, bridge, knowledge base, tasks, outcomes, approvals, and routines.

## Included

- Agent dashboard and live status
- Agent chat
- Task / execution monitor
- Workspaces
- Outcomes
- Briefings
- Risk approvals
- Jobs & Skills
- Skill Hub
- File attachments and knowledge previews
- Chat message edit/retract and `/stop`
- Workspace Review Loop
- Context-window fill indicator
- Install Helper Cursor Skill
- Supabase migrations

## Not Included

This starter intentionally excludes private business modules, private knowledge bases, real prompts, real reports, customer data, OAuth credentials, production environment files, and host-specific integrations.

## Quickstart

```bash
cp .env.example .env.local
npm install
npm run doctor
npm run dev
```

The default local preview uses demo mode. Open `/login` and choose `Open Local Demo`.

For a fresh install:

1. Create your own Supabase project.
2. Add your own values to `.env.local`.
3. Run the SQL migrations in `supabase/migrations`.
4. Choose your auth provider in your own Supabase project.
5. Copy `user.config/*.example.json` into user-owned local config files.
6. Configure your own agents, bridge/connector, and knowledge workspace.
7. Run the Fresh-Install checks in `docs/fresh-install-checklist.md`.

Run:

```bash
npm run doctor
```

to check the local setup.

## Course Project Map

- `templates/` contains copyable starter templates.
- `bridge/` documents the local bridge or connector contract.
- `supabase/migrations/` contains the initial Core schema.
- `.cursor/skills/mana-hub-install-helper/` contains the install helper skill.
- `skills/` contains course-facing skill notes.
- `dashboard/` maps course lessons to dashboard code.
- `user.config/` and `workspace/` are user-owned customization areas.

## Self-Hosted Trust Model

Mana Hub Starter is self-hosted.

- There is no central Mana Hub server.
- Your Supabase project is yours.
- Your service role key stays in `.env.local`.
- Your agents, prompts, skills, and knowledge base stay in user-owned files.
- Google OAuth is optional and configured in your own Supabase project.
- Supabase is the supported v1 default, but the backend boundary is documented in `docs/backend-adapters.md`.

## Update Safety

Private installer files are separated from updateable core files.

- Core: `src/`, `supabase/migrations/`, docs, examples, scripts, project skills
- User config: `user.config/` (gitignored except examples)
- User workspace: `workspace/` (gitignored except examples)
- Secrets: `.env.local` (gitignored)

See `docs/core-user-space.md`, `docs/core-host-sync.md`, `docs/update-safety.md`, and `UPGRADE.md`.

## Install Helper

Use the project skill `mana-hub-install-helper` in Cursor or Claude Code compatible workflows to guide a fresh install. The skill asks for Supabase values, agent names, local runner mode, bridge path, and intended setup mode. It must not write secrets into Git-tracked files.

## License

This project is intended to use the Mana Hub Community License.

You may use Mana Hub for personal, educational, and internal business purposes. You may not sell, host, rebrand, sublicense, or commercialize Mana Hub itself as a standalone product, SaaS, template, managed service, or competing platform without a commercial license.

See `LICENSE.md` and `COMMERCIAL-LICENSE.md`.

## Security

Never commit `.env.local`, API keys, service role keys, private prompts, private knowledge base files, customer data, or production agent logs.
