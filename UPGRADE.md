# Upgrade Guide

Mana Hub Starter separates updateable core files from installer-owned files.

Expected workflow:

```bash
git remote add upstream https://github.com/jesse-media/mana-hub.git
git fetch upstream
git merge upstream/main
npm install
npm run doctor
```

Always read `MIGRATIONS.md` and `CHANGELOG.md` before upgrading.

If you maintain your own fork, replace the remote URL with your fork's URL.

## Do Not Edit Core For Private Setup

Prefer these files for your own setup:

- `.env.local`
- `user.config/agents.json`
- `user.config/branding.json`
- `user.config/integrations.json`
- `workspace/knowledge/`
- `workspace/skills/`

These files are ignored by git so upstream updates do not overwrite them.

## Before Pulling Updates

```bash
git status
npm run doctor
```

Commit or back up your own changes before merging upstream updates.

## After Pulling Updates

1. Run `npm install`.
2. Review `MIGRATIONS.md`.
3. Apply new additive migrations to your own database.
4. Run `npm run doctor`.
5. Run `npm run lint`.
6. Run `npm run typecheck`.
7. Run `npm run build`.
8. Run `npm run test:e2e` when Playwright browsers are installed.

## Update-Safe Rule

Core updates may change `src/`, `supabase/migrations/`, `docs/`, `scripts/`, `.cursor/skills/`, `templates/`, `bridge/`, `skills/`, and `dashboard/`.

Core updates must not overwrite `.env.local`, real files in `user.config/`, real files in `workspace/`, private agent folders, private connector configs, or local secrets.
