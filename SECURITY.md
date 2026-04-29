# Security Policy

Do not commit secrets, private data, API keys, access tokens, credentials, customer data, production prompts, private knowledge base files, or agent logs.

Mana Hub Starter is designed for self-hosted installs. The public starter must not include telemetry, owner-controlled webhooks, owner-controlled databases, or hidden remote services.

Before deploying Mana Hub:

- configure Supabase authentication
- review RLS policies
- rotate any key that was ever committed accidentally
- use environment variables for secrets
- keep `SUPABASE_SERVICE_ROLE_KEY` server-side only
- restrict connected agent permissions
- disable demo mode for production
- replace demo agents with your own agents
- keep private files in `user.config/` and `workspace/`
- verify your setup with `npm run doctor`
- run a private-data scan before publishing or recording course material
- review upload limits and Storage policies before accepting real files
- confirm `/api/agents/[id]/stop` actually interrupts or records the active runner state

Authentication options:

- Demo mode for local preview only
- Supabase Email/Magic Link as the recommended default
- Supabase Google OAuth as an optional provider
- Custom auth adapters for advanced self-hosted setups

To report a security issue, contact the project owner privately. Do not open a public issue for sensitive security reports.

## Public Starter Boundary

The public starter must remain blank:

- no private host backend URLs
- no personal machine paths
- no real customer, project, workspace, report, prompt, or chat data
- no production Supabase project references
- no committed OAuth credentials
- no service role keys outside local secret stores
