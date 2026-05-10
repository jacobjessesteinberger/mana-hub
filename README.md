# Mana Hub Starter

> Self-hosted operations dashboard for your own AI agents.
> Postgres + Next.js + Claude Code + your own Mac.

[![Release](https://img.shields.io/github/v/release/jesse-media/mana-hub?include_prereleases&label=release&color=8B5CF6)](https://github.com/jesse-media/mana-hub/releases)
[![License](https://img.shields.io/badge/license-Community-blue)](LICENSE.md)
[![CI](https://img.shields.io/github/actions/workflow/status/jesse-media/mana-hub/ci.yml?branch=main&label=CI)](https://github.com/jesse-media/mana-hub/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%E2%89%A520.10-339933)](package.json)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E)](https://supabase.com)
[![Anthropic](https://img.shields.io/badge/Anthropic-Claude%20Code-cc785c)](https://www.anthropic.com)

Mana Hub Starter is the blank, installable Mana Hub Core for building a
self-hosted AI agent operations dashboard. It ships a dashboard, Supabase
schema, file-drop bridge for Claude Code in `tmux`, install-helper Cursor
skill, synthetic demo data, and update-safety boundaries — so you can
connect your own agents, knowledge base, tasks, outcomes, approvals, and
routines on infrastructure you own.

---

## Table of contents

1. [What you get](#what-you-get)
2. [Requirements](#requirements)
3. [Quickstart (5 min, demo mode)](#quickstart-5-min-demo-mode)
4. [Full install (live Supabase + agents)](#full-install-live-supabase--agents)
5. [Course project map](#course-project-map)
6. [Self-hosted trust model](#self-hosted-trust-model)
7. [Update safety](#update-safety)
8. [Versioning & releases](#versioning--releases)
9. [Install helper skill](#install-helper-skill)
10. [Documentation](#documentation)
11. [Community & contributing](#community--contributing)
12. [License](#license)
13. [Security](#security)

---

## What you get

- Agent dashboard with live status, heartbeats, chat, and routines
- Risk-Approval pipeline with one-time and "always allow" policies
- Cron-driven briefings (morning briefing pattern, Karpathy-Wiki KB)
- Workspace review loop, outcomes, jobs & skills
- File-Drop Bridge for Claude Code running in `tmux`
- macOS LaunchAgent templates for the bridge and per-agent runners
- Install Helper Cursor Skill that walks you through a fresh setup
- Synthetic demo data so the dashboard works before you connect anything

This starter intentionally **does not** ship private business modules,
private knowledge bases, real prompts, real reports, customer data, OAuth
credentials, production environment files, or host-specific integrations.

## Requirements

| Tool | Required? | Approx. cost | Why |
| --- | --- | --- | --- |
| **Node.js ≥ 20.10** | required | free | Runs the Next.js dashboard, the Bridge, and `npm run doctor`. |
| **Git** | required | free | Cloning the repo, version control. |
| **Supabase** project | required (live mode) | free tier works | Postgres, auth, realtime channel for the dashboard. |
| **Claude Code CLI** | required for live agents | requires an Anthropic plan (Claude Pro / Max / API) | Runs each agent locally; the Bridge talks to it via the file-drop protocol. |
| **Cursor** | recommended | free or Pro | Where the Install-Helper skill and other project skills run. |
| **tmux** | required for persistent agents | free | Keeps each agent in a long-running session the Bridge can attach to. |
| **macOS** | recommended | — | LaunchAgent templates assume macOS. Linux works for the dashboard + Bridge; you write your own systemd unit. |
| **A spare Mac (Mac Mini etc.)** | optional | ~600 EUR for a base Mac Mini, or use any always-on Mac | The 24/7 host that keeps your agents online. Not required for the dashboard itself. |
| **Anthropic API key** | optional | pay-per-token | Only needed by the in-dashboard planning helper (`/api/agents/plan`). Agents themselves use your local Claude Code subscription. |
| **Web push (VAPID)** | optional | free | Browser push for new approvals. Subscribe-flow is not wired in this release; treat as roadmap. |

You do not need all of this on day one. `MANA_HUB_DEMO_MODE=true` (the
default) lets you boot the dashboard with synthetic data and zero secrets.

## Quickstart (5 min, demo mode)

```bash
git clone https://github.com/jesse-media/mana-hub.git mana-hub
cd mana-hub
cp .env.example .env.local
npm install
npm run doctor
npm run dev
```

Open <http://localhost:3000/login> and choose **Open Local Demo**.
`npm run doctor` auto-loads `.env.local`, runs the required health checks,
and prints **advisory** warnings (tmux, LaunchAgents, etc.) without
failing the script — so you can explore the dashboard before you install
anything else.

## Full install (live Supabase + agents)

> Read **`PRE-COURSE-SETUP.md`** first — especially **Teil A**, the minimum
> needed before the live agent lessons. Skipping the env / Supabase URL
> hygiene is the #1 cause of silent failures.

1. Create your own Supabase project (free tier is fine).
2. Copy the API keys into `.env.local` — the new Supabase keys map as:
   `sb_publishable_…` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `sb_secret_…` → `SUPABASE_SERVICE_ROLE_KEY`. Use the **base** project URL,
   no `/rest/v1/` suffix.
3. Run the SQL files in `supabase/migrations/` in alphabetical order in the
   Supabase SQL editor (every migration is idempotent / safe to re-run).
4. Pick your auth provider (magic link is the default; Google OAuth is
   optional and lives in your Supabase project, not in this repo).
5. Copy `user.config/*.example.json` into your own `user.config/*.json` files.
6. Set up the Bridge and at least one agent — see `docs/bridge-modes.md`,
   `docs/bridge-persistence.md`, `docs/agent-setup.md`.
7. Run `npm run doctor` and the checklist in `docs/fresh-install-checklist.md`
   until both are green.
8. (macOS) Install the Bridge as a LaunchAgent so it survives reboots:
   `cd bridge && npm install && npm run launchd:install`.

For risk-approval, see `docs/risk-approval.md`. For cron / briefings, see
`docs/cron-and-briefings.md`.

## Course project map

- `PRE-COURSE-SETUP.md` is the binding pre-flight checklist for course-readiness.
- `templates/agent-boilerplate/` is the agent skeleton copied to `~/agents/<name>/` in Module 3.1.
- `templates/launchagents/` provides per-agent macOS LaunchAgent install scripts (Module 3.5).
- `templates/knowledge-base/` is the Karpathy-Wiki-pattern knowledge base stub (Module 4.1).
- `bridge/` is the long-running connector with two modes: `inline` (default) and `file_drop` (course mode).
- `bridge/launchd/` provides the macOS LaunchAgent for the bridge itself.
- `supabase/migrations/` contains the initial Core schema and OS-Layer extensions.
- `.cursor/skills/mana-hub-install-helper/` is the install helper skill (must read `PRE-COURSE-SETUP.md` first).
- `skills/` contains course-facing skill notes.
- `dashboard/` maps course lessons to dashboard code.
- `user.config/` and `workspace/` are user-owned customization areas.

## Self-hosted trust model

Mana Hub Starter is self-hosted.

- There is no central Mana Hub server.
- Your Supabase project is yours.
- Your service role key stays in `.env.local`.
- Your agents, prompts, skills, and knowledge base stay in user-owned files.
- Google OAuth is optional and configured in your own Supabase project.
- Supabase is the supported v1 default; the backend boundary is documented in
  `docs/backend-adapters.md`.

> **Single-tenant by default.** The shipped Row-Level-Security policies grant
> every authenticated user access to all rows. Multi-tenant deployments must
> tighten the policies to bind on `auth.uid()` — see `SECURITY.md`.

## Update safety

Private installer files are separated from updateable core files.

- Core: `src/`, `supabase/migrations/`, `docs/`, examples, `scripts/`, project skills
- User config: `user.config/` (gitignored except examples)
- User workspace: `workspace/` (gitignored except examples)
- Secrets: `.env.local` (gitignored)

See `docs/core-user-space.md`, `docs/core-host-sync.md`, `docs/update-safety.md`,
and `UPGRADE.md`.

## Versioning & releases

Mana Hub follows [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`):

- **MAJOR** — breaking changes (public API, schema, migration order). Always
  paired with a migration note in [`UPGRADE.md`](UPGRADE.md).
- **MINOR** — new features and additive schema changes. Backwards-compatible.
- **PATCH** — bug fixes, doc improvements, security patches.

Every release is tagged (`vX.Y.Z`), published as a
[GitHub Release](https://github.com/jesse-media/mana-hub/releases) with notes,
and recorded in [`CHANGELOG.md`](CHANGELOG.md). New SQL migrations always
land additively and idempotently — see [`MIGRATIONS.md`](MIGRATIONS.md).

To upgrade an existing installation:

```bash
git fetch origin
git checkout v0.1.0   # or `git pull origin main` for bleeding edge
npm install
npm run doctor
```

Detailed upgrade flow lives in [`UPGRADE.md`](UPGRADE.md).

## Install helper skill

Open the project in Cursor (or any Claude-Code-compatible workflow) and ask
for the `mana-hub-install-helper` skill. It guides you through Supabase
values, agent names, local runner mode, bridge path, and intended setup mode.
It must not write secrets into Git-tracked files.

## Documentation

| Doc | What it covers |
| --- | --- |
| `PRE-COURSE-SETUP.md` | Minimum setup before the live agent lessons. |
| `docs/fresh-install-checklist.md` | Step-by-step, every box must be green. |
| `docs/agent-setup.md` | Per-agent CLAUDE.md, MEMORY, MCP, permissions. |
| `docs/bridge-modes.md` | `inline` vs `file_drop` and when to use which. |
| `docs/bridge-persistence.md` | Keep the Bridge alive (LaunchAgent / tmux). |
| `docs/risk-approval.md` | End-to-end risk-approval flow + always-policies. |
| `docs/cron-and-briefings.md` | How cron triggers briefings (Briefings tab). |
| `docs/cron-system.md` | Agent-driven cron-request workflow (proposal → review). |
| `docs/web-push.md` | VAPID keys + browser notifications for approvals/cron-requests. |
| `docs/backend-adapters.md` | The Supabase boundary; how to swap backends. |
| `docs/course-lesson-boundaries.md` | What to do live vs. before recording. |
| `docs/update-safety.md` + `UPGRADE.md` | How to pull core updates safely. |
| `MIGRATIONS.md` | Migration ordering and notes. |
| In-App: `/dashboard/agents/docs` | Renders the Lastenheft (14 module specs + architecture diagram) inline and lets you read every `docs/*.md` file without leaving the app. |

## Community & contributing

- Bug reports and questions: <https://github.com/jesse-media/mana-hub/issues>
- Pull requests: see [`CONTRIBUTING.md`](CONTRIBUTING.md). Keep secrets out,
  document migrations.
- Discussions: <https://github.com/jesse-media/mana-hub/discussions>
- If Mana Hub helps you ship, a star on GitHub is the best way to say thanks.

## License

Mana Hub Starter is published under the **Mana Hub Community License**
(`LICENSE.md`).

You may use Mana Hub for personal, educational, and internal business purposes.
You may **not** sell, host, rebrand, sublicense, or commercialize Mana Hub
itself as a standalone product, SaaS, template, managed service, or competing
platform without a commercial license. See `COMMERCIAL-LICENSE.md`.

## Security

- Never commit `.env.local`, API keys, service role keys, private prompts,
  private knowledge base files, customer data, or production agent logs.
- The default RLS policies are permissive (single-tenant). Read `SECURITY.md`
  before exposing your deployment to multiple users.
- To report a vulnerability, see `SECURITY.md` for the disclosure channel.
