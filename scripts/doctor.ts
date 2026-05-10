import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execSync } from 'node:child_process'

type Check = {
  label: string
  ok: boolean
  hint?: string
  skipped?: boolean
}

const root = process.cwd()
const hasLocalEnv = fs.existsSync(path.join(root, '.env.local'))

if (hasLocalEnv) {
  try {
    const lines = fs.readFileSync(path.join(root, '.env.local'), 'utf8').split('\n')
    for (const raw of lines) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) continue
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
      if (!m) continue
      const key = m[1]
      let val = m[2]
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = val
    }
  } catch {
    /* ignore .env.local parse errors, individual checks will surface them */
  }
}

const migrationPath = path.join(root, 'supabase', 'migrations', '000_mana_hub_core.sql')
const migrationSql = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : ''
const isDemoMode = process.env.MANA_HUB_DEMO_MODE === 'true'
  || process.env.NEXT_PUBLIC_MANA_HUB_DEMO_MODE === 'true'
  || !hasLocalEnv

const isMac = process.platform === 'darwin'

function exists(...parts: string[]) {
  return fs.existsSync(path.join(root, ...parts))
}

function expandKbEnvPath(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.startsWith('~/')) {
    return path.join(os.homedir(), trimmed.slice(2))
  }
  return trimmed
}

function migrationContains(fragment: string) {
  return migrationSql.includes(fragment)
}

function commandExists(cmd: string): boolean {
  try {
    execSync(`command -v ${cmd}`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function findStableNode(): string | null {
  const home = os.homedir()
  const candidates = [
    path.join(home, 'Library/pnpm/node'),
    '/opt/homebrew/bin/node',
    '/usr/local/bin/node',
    '/usr/bin/node',
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  const nvmDir = path.join(home, '.nvm/versions/node')
  if (fs.existsSync(nvmDir)) {
    const versions = fs.readdirSync(nvmDir).filter(v => /^v\d/.test(v))
    if (versions.length > 0) return path.join(nvmDir, versions.sort().reverse()[0], 'bin/node')
  }
  return null
}

function urlHasRestSuffix(url: string | undefined): boolean {
  if (!url) return false
  return url.includes('/rest/v1')
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
  {
    label: 'Pre-Course Setup contract exists',
    ok: exists('PRE-COURSE-SETUP.md'),
    hint: 'PRE-COURSE-SETUP.md is the binding pre-flight checklist for course-readiness. Restore from the repo.',
  },
  {
    label: 'Supabase URL has no /rest/v1/ suffix',
    ok: !urlHasRestSuffix(process.env.NEXT_PUBLIC_SUPABASE_URL) || isDemoMode,
    hint: 'NEXT_PUBLIC_SUPABASE_URL contains "/rest/v1/". Strip it, use only the base URL like https://abc.supabase.co.',
  },
  {
    label: 'Agent boilerplate template exists',
    ok: exists('templates', 'agent-boilerplate', 'CLAUDE.md')
      && exists('templates', 'agent-boilerplate', 'MEMORY.md')
      && exists('templates', 'agent-boilerplate', '.claude', 'settings.json'),
    hint: 'templates/agent-boilerplate/ is required for Course Lesson 3.1. Restore from the repo.',
  },
  {
    label: 'Agent LaunchAgent template exists',
    ok: exists('templates', 'launchagents', 'agent.plist.example')
      && exists('templates', 'launchagents', 'install-agent.sh'),
    hint: 'templates/launchagents/ is required for Course Lesson 3.5. Restore from the repo.',
  },
  {
    label: 'Knowledge Base template exists',
    ok: exists('templates', 'knowledge-base', 'INDEX.md'),
    hint: 'templates/knowledge-base/ is required for Course Lesson 4.1. Restore from the repo.',
  },
  {
    label: 'Bridge env file exists (or demo mode)',
    ok: isDemoMode || exists('bridge', '.env'),
    hint: 'Copy bridge/.env.example to bridge/.env and fill in Supabase secret key.',
  },
  {
    label: 'Bridge node_modules installed (or demo mode)',
    ok: isDemoMode || exists('bridge', 'node_modules'),
    hint: 'Run: cd bridge && npm install',
  },
]

const advisoryChecks: Check[] = [
  {
    label: 'macOS: Bridge LaunchAgent installed (optional until 24/7 bridge needed)',
    ok: !isMac || isDemoMode || fs.existsSync(path.join(os.homedir(), 'Library/LaunchAgents/com.manahub.bridge.plist')),
    hint: 'Bridge runs only while you start it manually unless you install the LaunchAgent: cd bridge && npm run launchd:install',
  },
  {
    label: 'macOS: tmux installed (needed from ca. Lesson 3.4 onward)',
    ok: !isMac || commandExists('tmux'),
    hint: 'Not required before Lesson 3.1. When you reach tmux in the course: brew install tmux',
  },
  {
    label: 'macOS: stable Node binary outside Cursor (needed for LaunchAgents)',
    ok: !isMac || findStableNode() !== null,
    hint: 'Install via brew, pnpm, or nvm before using bridge or agent LaunchAgents outside Cursor.',
  },
  {
    label: 'Dashboard: MANA_HUB_KNOWLEDGE_ROOT exists on disk (if set)',
    ok: (() => {
      const raw = process.env.MANA_HUB_KNOWLEDGE_ROOT?.trim()
      if (!raw || isDemoMode) return true
      const p = expandKbEnvPath(raw)
      try {
        return fs.existsSync(p) && fs.statSync(p).isDirectory()
      } catch {
        return false
      }
    })(),
    hint: 'Set MANA_HUB_KNOWLEDGE_ROOT in .env.local to your Markdown KB folder. The dashboard indexes it live.',
  },
  {
    label: 'RLS policies tightened for multi-tenant (only required if >1 user)',
    ok: isDemoMode || !migrationContains('USING (true) WITH CHECK (true)'),
    hint: 'Default RLS in 000_mana_hub_core.sql is single-tenant (all-authenticated-can-read-all). Tighten policies to bind on auth.uid() before letting more than one human log in. See SECURITY.md.',
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

if (advisoryChecks.length > 0) {
  console.log('\n--- Advisory (do not fail the run; see docs/course-lesson-boundaries.md) ---\n')
  for (const check of advisoryChecks) {
    const prefix = check.ok ? 'OK  ' : 'WARN'
    console.log(`${prefix} ${check.label}`)
    if (!check.ok && check.hint) console.log(`     ${check.hint}`)
  }
  console.log('')
}

const failed = checks.filter(check => !check.ok)
if (failed.length > 0) {
  console.log(`\n${failed.length} check(s) failed.\n`)
  process.exit(1)
}

console.log('\nAll required checks passed.\n')
