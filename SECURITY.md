# Security Policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security reports.

Use one of these private channels instead:

1. **GitHub Private Vulnerability Reporting** — preferred. Open
   <https://github.com/jesse-media/mana-hub-starter/security/advisories/new>.
2. **Maintainer contact** — if private reporting is not enabled yet, reach
   the maintainer via the GitHub profile <https://github.com/jesse-media>
   and request a private channel.

The maintainer (JESSE MEDIA, Jacob Jesse) will acknowledge reports within
5 business days and aim to publish a fix or mitigation within 30 days for
confirmed issues.

## Supported versions

Mana Hub Starter is published as a rolling source-available release. Only the
latest commit on `main` receives security fixes. If you fork the repo, you are
responsible for keeping your fork up to date.

## Single-tenant assumption (read this before going live)

Mana Hub Starter is designed for **single-tenant self-hosted installs**.

The default Row-Level-Security policies in `supabase/migrations/000_mana_hub_core.sql`
look like:

```sql
CREATE POLICY "authenticated_all_<table>" ON <table>
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

In plain English: **every authenticated user sees and can write every row in
every table.** That is fine when you are the only user of your Supabase
project. It is **a data leak** the moment a second human gets a login on the
same Supabase project.

If you plan to host Mana Hub for more than one person:

- bind every policy to `auth.uid()` (or a tenant_id, org_id, etc.)
- gate write paths server-side, not just on the client
- never rely on RLS as your only line of defense — also validate ownership in
  API routes that use the service-role key

`scripts/doctor.ts` does not enforce this — it is your responsibility before
exposing your deployment.

## Pre-deploy checklist

- [ ] `MANA_HUB_DEMO_MODE=false` and `NEXT_PUBLIC_MANA_HUB_DEMO_MODE=false`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` only present server-side (never in
      `NEXT_PUBLIC_*` vars or client bundles)
- [ ] No `.env.local` or `bridge/.env` committed (verify with
      `git ls-files | grep -E '\.env(\.local)?$'`)
- [ ] No `~/.claude.json`, `~/.zshrc`, or other host-config files committed
- [ ] RLS policies reviewed for your tenancy model (single vs multi)
- [ ] Anthropic / Perplexity / other API keys live only in user-owned files
      (`user.config/`, `~/agents/<name>/.env`)
- [ ] Storage bucket policies and upload size limits configured if you accept
      file attachments
- [ ] `/api/agents/[id]/stop` and the Bridge actually interrupt the active
      runner in your environment (test before shipping)
- [ ] `npm run doctor` exits 0
- [ ] Private prompts, knowledge bases, agent logs stay in `user.config/` and
      `workspace/` (both gitignored)
- [ ] `npm run build` succeeds with `MANA_HUB_DEMO_MODE=false`

## What must never land in public commits

- `.env.local`, `.env`, any `*.env` file with real values
- API keys, service role keys, OAuth client secrets, VAPID private keys
- private business data, real customer names, real workspace names
- private prompts, real CLAUDE.md content beyond the synthetic templates
- private knowledge base content (anything outside `templates/knowledge-base/`
  and `workspace/knowledge.example/`)
- production agent logs, production chat history
- screenshots that contain any of the above

## Authentication

- **Demo mode** — local preview only, never deploy with demo mode on.
- **Supabase Email / Magic Link** — recommended default for solo / small-team
  installs.
- **Supabase Google OAuth** — optional, gated by `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED`.
- **Custom adapters** — see `docs/backend-adapters.md` if you need something else.

## Public starter boundary

The public starter must remain blank:

- no private host backend URLs
- no personal machine paths (`/Users/...`)
- no real customer, project, workspace, report, prompt, or chat data
- no production Supabase project references
- no committed OAuth credentials
- no service role keys outside local secret stores

If you find any of the above in the public repo, treat it as a security report
and use the private channel above.
