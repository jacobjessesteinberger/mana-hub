# Contributing to Mana Hub Starter

Thanks for thinking about contributing. Mana Hub is a self-hosted product, so
contributions matter — they keep the public starter useful for everyone.

By contributing, you agree that your work is licensed under
[`LICENSE.md`](LICENSE.md) (Mana Hub Community License) and that the project
maintainers may relicense your contribution under
[`COMMERCIAL-LICENSE.md`](COMMERCIAL-LICENSE.md) for commercial uses.

## Before you start

1. Skim [`AGENTS.md`](AGENTS.md). It is the source of truth for the
   Core / User-Space boundary.
2. Read the relevant doc in `docs/` (e.g. `docs/risk-approval.md` if you are
   touching the approvals pipeline).
3. For larger changes, open an issue first so we can agree on scope before
   you spend the time.

## Local dev loop

```bash
git clone <your-fork> mana-hub
cd mana-hub
cp .env.example .env.local
npm install
npm run doctor   # demo mode is fine for most contributions
npm run dev
```

For Bridge changes:

```bash
cd bridge
cp .env.example .env
npm install
npm run dev      # tsx watch
```

## What to do before opening a PR

- `npm run lint` — passes
- `npm run typecheck` — passes
- `cd bridge && npm run typecheck` — passes if you touched the Bridge
- `npm run doctor` — passes (demo mode is fine)
- `npm run build` — passes (catches Server-Component / RSC mistakes)

If you change a Supabase schema:

- the migration goes into `supabase/migrations/YYYYMMDD_short_name.sql`
- every statement is **idempotent** (`ADD COLUMN IF NOT EXISTS`,
  `DROP POLICY IF EXISTS` before `CREATE POLICY`, `DO $$ … $$` for
  constraints)
- `MIGRATIONS.md` gets a new row in the table
- if behaviour changes for existing users, `UPGRADE.md` gets a note

If you touch templates / boilerplate:

- no real names, real domains, real machine paths (`/Users/...`),
  real customer data, or real prompts
- placeholders use `<USER_NAME>`, `<AGENT_NAME>`, `<COMPANY>`, etc.
- `npm run doctor` still finds the templates

## What never lands in a public PR

- `.env.local`, `.env`, real API keys, real service role keys, real VAPID
  private keys
- private prompts, private knowledge bases, real customer data
- production agent logs or chat history
- screenshots that contain any of the above

If you accidentally commit secrets, rotate them immediately at the source
(Supabase keys → Settings → API → rotate; Anthropic key → console; etc.) and
flag the maintainers.

## Branching & commits

- branch off `main`
- branch name: short kebab-case (`fix/bridge-poll-default`,
  `docs/update-readme-quickstart`)
- commit messages: present-tense, focused (e.g. `fix(bridge): handle empty
  outbox gracefully`)
- one logical change per PR — split big changes into reviewable chunks

## Questions

- "Does this fit the Core / User-Space split?" → re-read `AGENTS.md` § "Core
  vs User Space".
- "Is this OK to commit?" → if it contains data about a real human or a real
  business, no. If it could leak a secret, no.
- "How do I report a security issue?" → see `SECURITY.md`. Do not use a
  public issue.
