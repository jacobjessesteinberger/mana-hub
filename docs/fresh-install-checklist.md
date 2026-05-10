# Fresh Install Checklist

Use this checklist for a clean course install or GitHub release validation.

## 1. Local Project

- [ ] Clone/open the starter in a clean folder.
- [ ] Run `npm install`.
- [ ] Copy `.env.example` to `.env.local`.
- [ ] Keep `.env.local` untracked.
- [ ] Run `npm run doctor`.

## 2. Supabase

- [ ] Create a new Supabase project.
- [ ] Copy Project URL into `NEXT_PUBLIC_SUPABASE_URL`.
- [ ] Copy anon key into `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] Copy service role key into `SUPABASE_SERVICE_ROLE_KEY` only in `.env.local`.
- [ ] Run **all** SQL files in `supabase/migrations/` in alphabetical order. Start with `000_mana_hub_core.sql`, then `010_planning_context.sql`, ... ending with the most recent `20260509_*.sql`. They are additive and idempotent (`IF NOT EXISTS`), so re-running is safe. Concretely (current set):
   - `000_mana_hub_core.sql`
   - `010_planning_context.sql`
   - `014_chat_attachments.sql`
   - `015_add_metadata_column.sql`
   - `020_activity_permissions.sql`
   - `20260426_agent_briefing_metadata.sql`
   - `20260426_agent_cron_runbooks.sql`
   - `20260426_approvals_risk_queue.sql`
   - `20260426_automation_requests_upgrade.sql`
   - `20260426_briefing_user_state.sql`
   - `20260426_goals_outcome_tracking.sql`
   - `20260426_issues_workflow_os.sql`
   - `20260509_approval_policies_learning.sql` (Risk-Approval Always-Policies + Lerneffekt)
- [ ] Configure auth provider for the test user.
- [ ] Confirm RLS policies are active.
- [ ] Optional: create a Storage bucket for real attachment uploads.

## 3. User Space

- [ ] Copy `user.config/agents.example.json` to a local user-owned config.
- [ ] Copy `user.config/integrations.example.json` to a local user-owned config.
- [ ] Copy `workspace/knowledge.example/` to a user-owned knowledge workspace if needed.
- [ ] Do not edit private setup into Core source files.

## 4. Agent And Bridge

- [ ] Choose runner mode: demo, `tmux`, or custom connector.
- [ ] For `tmux`, set `MANA_HUB_RUNNER=tmux`.
- [ ] Confirm `MANA_HUB_TMUX_BIN` points to the local `tmux` binary.
- [ ] Start one local agent session matching an agent name.
- [ ] Confirm the connector reads `agent_messages`.
- [ ] Confirm the connector writes assistant replies.
- [ ] Confirm `/api/agents/[id]/stop` interrupts or records stopped state.

## 5. Dashboard Smoke Tests

- [ ] Run `npm run dev`.
- [ ] Open `/login`.
- [ ] Use demo mode or the configured Supabase auth user.
- [ ] Open `/dashboard/agents`.
- [ ] Confirm the sidebar shows Core Starter, not a private host.
- [ ] Open an agent chat.
- [ ] Send a text message.
- [ ] Upload a test Markdown, CSV, PDF, or PNG file.
- [ ] Copy a message.
- [ ] Edit a user message and confirm the original is superseded.
- [ ] Retract a user message and confirm the agent is stopped.
- [ ] Type `/stop` and confirm a stop event is recorded.
- [ ] Open Workspaces and start a Workspace Review.
- [ ] Open Outcomes and update progress/current value.
- [ ] Open Tasks and create or update a task.
- [ ] Open Risk Approval and verify the empty or pending state.
- [ ] Open Knowledge Base and preview a Markdown file.
- [ ] Open Documentation and verify Core/User-Space and API sections.

## 6. Release Checks

- [ ] Run `npm run doctor`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Run `npm run test:e2e` if Playwright browsers are installed.
- [ ] Search for private host names, real emails, real domains, `/Users/`, and production URLs.
- [ ] Confirm demo data is synthetic and not inspired by real work.
- [ ] Confirm license boundaries are present in `LICENSE.md`, `COMMERCIAL-LICENSE.md`, and `README.md`.
