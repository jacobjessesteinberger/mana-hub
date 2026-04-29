# Update Safety

Mana Hub Starter separates updateable core code from installer-owned data.

## Updateable Core

These files can change when you pull upstream updates:

- `src/`
- `supabase/migrations/`
- `scripts/`
- `.cursor/skills/`
- `templates/`
- `bridge/`
- `skills/`
- `dashboard/`
- `*.example.*`
- docs

## Installer-Owned Files

These files should not be overwritten by updates:

- `.env.local`
- `user.config/*` except examples
- `workspace/*` except examples
- your Supabase data
- private prompts
- private skills
- private knowledge base files
- production agent outputs
- private connector configuration
- local runner state

## Recommended Upgrade Flow

```bash
git fetch upstream
git merge upstream/main
npm install
npm run doctor
```

Then review new migrations in `supabase/migrations` and run them against your own database.

For the complete boundary, see `docs/core-user-space.md`.

## User Space Is Sacred

Core releases must use additive examples and explicit migration steps. They must not silently rewrite real user config, private knowledge files, local agent prompts, bridge credentials, or `.env.local`.

## Migration Rules

- Prefer additive migrations.
- Do not drop user tables in minor updates.
- Keep demo seed data separate from production migrations.
- Document breaking changes in `UPGRADE.md`.
