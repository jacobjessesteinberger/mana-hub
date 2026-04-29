import fs from 'node:fs'
import path from 'node:path'

type Check = {
  label: string
  ok: boolean
  hint?: string
}

const root = process.cwd()
const hasLocalEnv = fs.existsSync(path.join(root, '.env.local'))
const migrationPath = path.join(root, 'supabase', 'migrations', '000_mana_hub_core.sql')
const migrationSql = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : ''
const isDemoMode = process.env.MANA_HUB_DEMO_MODE === 'true'
  || process.env.NEXT_PUBLIC_MANA_HUB_DEMO_MODE === 'true'
  || !hasLocalEnv

function exists(...parts: string[]) {
  return fs.existsSync(path.join(root, ...parts))
}

function migrationContains(fragment: string) {
  return migrationSql.includes(fragment)
}

const checks: Check[] = [
  {
    label: 'Environment example exists',
    ok: exists('.env.example'),
    hint: 'Restore .env.example from the repository.',
  },
  {
    label: 'Local environment file exists',
    ok: hasLocalEnv || isDemoMode,
    hint: 'Copy .env.example to .env.local for a real install.',
  },
  {
    label: 'Supabase URL configured',
    ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) || isDemoMode,
    hint: 'Set NEXT_PUBLIC_SUPABASE_URL in .env.local.',
  },
  {
    label: 'Supabase anon key configured',
    ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) || isDemoMode,
    hint: 'Set NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.',
  },
  {
    label: 'Supabase service role key configured',
    ok: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) || isDemoMode,
    hint: 'Set SUPABASE_SERVICE_ROLE_KEY in .env.local and keep it server-side only.',
  },
  {
    label: 'User config examples exist',
    ok: exists('user.config', 'agents.example.json') && exists('user.config', 'integrations.example.json'),
    hint: 'Restore user.config/*.example.json from the repository.',
  },
  {
    label: 'Workspace examples exist',
    ok: exists('workspace', 'knowledge.example', 'INDEX.md'),
    hint: 'Restore workspace examples from the repository.',
  },
  {
    label: 'Supabase migrations exist',
    ok: exists('supabase', 'migrations', '000_mana_hub_core.sql'),
    hint: 'Restore supabase/migrations before production setup.',
  },
  {
    label: 'Message lifecycle schema is present',
    ok: migrationContains('reply_to_id UUID') && migrationContains('metadata JSONB'),
    hint: 'Ensure agent_messages includes reply_to_id and metadata for edit/retract/attachments.',
  },
  {
    label: 'Workspace review schema is present',
    ok: migrationContains('project_id UUID REFERENCES projects') && migrationContains('tracking_source TEXT') && migrationContains('planning_context JSONB') && migrationContains('created_by TEXT'),
    hint: 'Update 000_mana_hub_core.sql so workspaces, outcomes, and tasks can be linked.',
  },
  {
    label: 'Risk approval schema is present',
    ok: migrationContains('CREATE TABLE IF NOT EXISTS approval_policies') && migrationContains('action_type TEXT') && migrationContains('action_payload JSONB') && migrationContains('requested_at TIMESTAMPTZ'),
    hint: 'Update 000_mana_hub_core.sql so Risk Approval API routes match the database.',
  },
  {
    label: 'Agent stop/control schema is present',
    ok: migrationContains('active BOOLEAN') && migrationContains('started_at TIMESTAMPTZ'),
    hint: 'Update agent_activity and issue_runs columns for stop/control support.',
  },
  {
    label: 'Install Helper skill exists',
    ok: exists('.cursor', 'skills', 'mana-hub-install-helper', 'SKILL.md'),
    hint: 'Restore .cursor/skills/mana-hub-install-helper/SKILL.md.',
  },
  {
    label: 'Course folder contract exists',
    ok: exists('templates', 'README.md') && exists('bridge', 'README.md') && exists('skills', 'README.md') && exists('dashboard', 'README.md'),
    hint: 'Restore templates/, bridge/, skills/, and dashboard/ course map files.',
  },
  {
    label: 'Fresh install checklist exists',
    ok: exists('docs', 'fresh-install-checklist.md'),
    hint: 'Create docs/fresh-install-checklist.md before course recording.',
  },
  {
    label: 'Update safety documentation exists',
    ok: exists('docs', 'update-safety.md') && exists('UPGRADE.md'),
    hint: 'Restore docs/update-safety.md and UPGRADE.md.',
  },
]

console.log('\nMana Hub Starter Doctor\n')
if (isDemoMode) {
  console.log('Running in demo-ready mode. Supabase checks are informational until .env.local exists.\n')
}
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}`)
  if (!check.ok && check.hint) console.log(`     ${check.hint}`)
}

const failed = checks.filter(check => !check.ok)
if (failed.length > 0) {
  console.log(`\n${failed.length} check(s) failed.\n`)
  process.exit(1)
}

console.log('\nAll checks passed.\n')
