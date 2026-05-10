# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each release also has a matching GitHub Release at
<https://github.com/jesse-media/mana-hub/releases> with prebuilt notes.

## Versioning rules

- **MAJOR** — breaking changes to public APIs, schema, or migration order. Requires `UPGRADE.md` notes.
- **MINOR** — new features, additive schema changes, additive endpoints. Backwards-compatible.
- **PATCH** — bug fixes, doc improvements, security patches.

Migrations are always additive and idempotent — see [`MIGRATIONS.md`](MIGRATIONS.md).
The Core/User-Space boundary is preserved across releases — see [`docs/update-safety.md`](docs/update-safety.md).

---

## [Unreleased]

Tracks work landing on `main` after `v0.1.0`. Promote sections to a dated
release when cutting a tag.

### Added
- _placeholder_

### Changed
- _placeholder_

### Fixed
- _placeholder_

---

## [0.1.0] — 2026-05-10

**Initial Public Release.** Mana Hub Core is now publishable as a fresh-install
starter for the "Dein AI-Team in 3 Tagen" course and for end-user installations.

### Mobile experience
- Brand-new **mobile bottom tab bar** (`MobileTabBar`) with five quick-actions
  (Dashboard, Chats, Inbox, Health, Theme) and an agent picker sheet for fast
  cross-agent chat switching. Respects `safe-area-inset-bottom` so it never
  overlaps the iOS home indicator.
- Streamlined **mobile sidebar** with proper labels, full safe-area padding,
  and clean transitions.
- **Chat layout** redesigned for small screens: messages, prompt input, and
  permission row size to `100svh` minus the tab bar. No more cropped input.
- **Global responsive brandmauer** in `globals.css`: catches inline grid
  patterns, oversized horizontal padding, and unbreakable rows on the
  Dashboard, Issues, Inbox, Setup, Briefings, Routines, Org, Docs, and Agent
  detail pages, so every page wraps and stacks correctly under 720px / 480px.
- Agent detail "Health" block trimmed to real metrics (Soft Fails 24h,
  Success rate, Open Issues) — no fake placeholder values.
- `PageHeader` titles wrap as a block on mobile; tables become horizontally
  scrollable via `.tbl-wrap`; tabs become horizontally scrollable via
  `.tabs-scroll`.

### Demo mode hardening
- **Lazy Supabase initialization** on both server and browser. Both
  `createServerSupabase()` and `getBrowserSupabase()` short-circuit to a
  no-op stub client when `MANA_HUB_DEMO_MODE=true` (or its
  `NEXT_PUBLIC_…` twin) is set, so the dashboard never throws
  `Missing required env: NEXT_PUBLIC_SUPABASE_URL` in fresh installs.
- `/api/agents/heartbeats` and `/api/agents/activity` short-circuit in
  demo mode and return empty payloads, no Supabase calls.
- `next-themes` upgraded to React 19-compatible build; theme toggle is
  hydration-safe.
- `DashboardLayout` wrapped in a dedicated shell so `useAuth` is always
  inside `AuthProvider`.

### Privacy hardening for the public repo
- All host-internal agent names removed from defaults and templates.
  Default agent is now `orchestrator`; bridge / agent-setup / boilerplate
  examples reference `orchestrator` and `researcher` only.
- Logo initials, avatars, and demo strings inside the dashboard switched
  to neutral defaults (`MH`, `You`, generic placeholders) — Jesse Media
  branding lives only in `LICENSE.md`, `COMMERCIAL-LICENSE.md`,
  `SECURITY.md`, and `package.json` `author` (legal context only).
- Knowledge-base templates and briefing snippets neutralized — no
  Berlin-weather examples, no real customer references.



### Added
- **Dashboard (Next.js 16, React 19, Tailwind v4)** with full Demo Mode that
  works without a Supabase project — open the app, see synthetic agents,
  workspaces, outcomes, tasks, briefings.
- **Bridge connector** (`bridge/`) with two modes:
  - `inline` — Bridge handles the LLM call itself (default for fresh installs).
  - `file_drop` — Bridge writes `msg-*.md` to `~/agents/<name>/inbox/` and
    watches `outbox/` for replies. Used when each agent runs as a Claude Code
    session in tmux. Includes LaunchAgent persistence templates and a
    `caffeinate`-aware start wrapper.
- **Risk Approval system** with policy learning. Sensitive agent actions
  (bank connections, deletions, posting under your name…) trigger a
  `type: approval_request` from the agent. The dashboard's Risk Approval tab
  offers Reject / Allow once / Allow always. "Allow always" stores a policy
  that auto-approves matching future requests, with full audit trail.
- **Cron-Request workflow**. Agents can propose new cron jobs via
  `type: cron_request` markers. Bridge inserts them as pending; the dashboard's
  Cron-Vorschläge tab lets you approve, edit, or reject. High/critical risk
  proposals create a parallel approval entry.
- **Web-Push notifications** (VAPID). Browser/OS-level push for new
  approvals and cron requests, even when the dashboard tab is closed. Works
  end-to-end from agent → Bridge → dashboard's internal push endpoint
  (token-protected) → Service Worker.
- **In-app Documentation page** (`/dashboard/agents/docs`). Renders a
  14-module Lastenheft with architecture diagram, plus a read-only viewer
  for every `docs/*.md` file. Hash-routing for permalinks, sticky sidebar
  with search, deeplink to GitHub.
- **Knowledge Base integration** following the Karpathy-Wiki Markdown-tree
  pattern. Dashboard indexes any folder via `MANA_HUB_KNOWLEDGE_ROOT`;
  agents read the same files via symlink. Demo data fallback when not set.
- **Workspaces, Outcomes, Tasks, Briefings, Heartbeats** — the core
  productivity surfaces, all backed by Supabase tables, all with realtime
  updates.
- **Backend adapter boundary**. `createServerSupabase()` + `requireAuth()` is
  the single boundary; future Postgres-but-not-Supabase setups can adapt at
  this layer without touching UI/logic.
- **Install Helper Cursor skill**
  (`.cursor/skills/mana-hub-install-helper/SKILL.md`) — guides users through
  Supabase setup, env config, agent boilerplate, doctor checks.
- **Speedrun Skill** (`.cursor/skills/mana-hub-speedrun/SKILL.md`) —
  condensed 30-minute setup for experienced users.
- **Agent boilerplate templates** (`templates/agent-boilerplate/`) with
  CLAUDE.md / MEMORY / CURRENT structure, `.mcp.json` examples for
  Perplexity / Playwright / Context7 / YouTube Data, per-agent `.env.example`
  and `start.sh.example`.
- **Doctor script** (`npm run doctor`) — fresh-install verification with
  required + advisory checks.
- **CI workflow** (`.github/workflows/ci.yml`) — lint + typecheck + doctor +
  build on every push and pull request, plus bridge typecheck.
- **Issue & PR templates** in `.github/`.
- **Documentation set** under `docs/`: agent setup, bridge modes, bridge
  persistence, risk approval, cron & briefings, cron system, web-push,
  backend adapters, course lesson boundaries, fresh-install checklist,
  update safety, core-host sync.
- **Idempotent SQL migrations** under `supabase/migrations/`. Every migration
  uses `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN IF NOT EXISTS`,
  `DROP POLICY IF EXISTS` so reruns stay green.
- **Dual licensing**: Mana Hub Community License (`LICENSE.md`) for
  personal / educational / internal business use; commercial license
  (`COMMERCIAL-LICENSE.md`) required for SaaS, reselling, rebranding, and
  managed hosting.

### Security
- **Demo Mode is the default** — no Supabase credentials required to try
  the product, no service-role keys ever leave the local machine.
- **`.env.local` and `bridge/.env` are gitignored**; `.env.example` files
  contain only placeholders.
- **Service-role key only on the server**; never bundled into the client.
- **Path-traversal hardening** on the docs API
  (`/api/docs/[slug]` accepts only `^[a-z0-9-]+$` and resolves against the
  docs/ directory).
- **Service-token-protected internal push endpoint**
  (`/api/push/notify-internal`) so the Bridge can trigger push without
  exposing it to the public internet.
- **No personal data, customer data, real prompts, or production logs in
  the public repo** — verified with a secret scan + path scan over the
  whole tree before publishing.

[Unreleased]: https://github.com/jesse-media/mana-hub/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/jesse-media/mana-hub/releases/tag/v0.1.0
