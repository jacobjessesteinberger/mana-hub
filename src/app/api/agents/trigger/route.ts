import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'
import { execFileSync } from 'child_process'

export const runtime = 'nodejs'

const TMUX_BIN = process.env.TMUX_BIN || 'tmux'
const AGENTS_DIR = process.env.AGENT_WORKSPACE_DIR || ''
const SESSION_NAME_RE = /^[a-zA-Z0-9_-]+$/

function outputKindForJob(job: { name?: string | null; description?: string | null; prompt?: string | null }): string {
  const text = `${job.name || ''}\n${job.description || ''}\n${job.prompt || ''}`
  return /briefing|report|maintenance/i.test(text) ? 'briefing' : 'cron'
}

function isTmuxSessionAlive(session: string): boolean {
  if (!SESSION_NAME_RE.test(session)) return false
  try {
    execFileSync(TMUX_BIN, ['has-session', '-t', session], { stdio: 'ignore' })
    return true
  } catch { return false }
}

function notifyAgent(session: string, filename: string): boolean {
  if (!isTmuxSessionAlive(session)) return false
  try {
    const replyFilename = `reply-${Date.now()}.md`
    const prompt = `Neue Inbox-Datei: inbox/${filename}. Lies sie, bearbeite die Anfrage gemäß deiner CLAUDE.md und schreibe deine Antwort in outbox/${replyFilename}, dann lösche die Inbox-Datei. Wenn die Inbox-Frontmatter output_kind: briefing enthält, übernimm in deiner Outbox-Antwort die Frontmatter-Felder type: reply, output_kind: briefing, source: cron, job_id, job_name, briefing_title und agent.`
    execFileSync(TMUX_BIN, ['send-keys', '-t', session, '-l', prompt])
    execFileSync(TMUX_BIN, ['send-keys', '-t', session, 'Enter'])
    return true
  } catch { return false }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { triggerSchema, parseBody } = await import('@/lib/validation')
  const parsed = parseBody(triggerSchema, body)
  if (!parsed.success) return parsed.response

  const { agent_id, job_id } = parsed.data
  if (!AGENTS_DIR) {
    return NextResponse.json({
      error: 'Local agent connector not configured',
      hint: 'Set AGENT_WORKSPACE_DIR or replace this route with your own HTTP/webhook connector.',
    }, { status: 503 })
  }

  const supabase = createServerSupabase()

  const { data: job, error: jobErr } = await supabase
    .from('agent_cron_jobs')
    .select('*')
    .eq('id', job_id)
    .eq('agent_id', agent_id)
    .single()

  if (jobErr || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const { writeFileSync, existsSync, mkdirSync } = await import('fs')
  const safeAgentsDir = AGENTS_DIR.replace(/\/+$/, '')
  const inboxDir = `${safeAgentsDir}/${agent_id}/inbox`
  if (!existsSync(inboxDir)) {
    mkdirSync(inboxDir, { recursive: true })
  }

  const filename = `cron-${agent_id}-${Date.now()}.md`
  const outputKind = outputKindForJob(job)
  const briefingTitle = outputKind === 'briefing'
    ? String(job.name || job.description || 'Agent Briefing').replace(/"/g, "'")
    : ''
  const content = `---
type: cron
output_kind: ${outputKind}
source: cron
job_id: ${job.id}
job_name: ${job.name}
briefing_title: "${briefingTitle}"
agent: ${agent_id}
timestamp: ${new Date().toISOString()}
triggered_by: manual
---

${job.description || job.name}

${outputKind === 'briefing' ? `Wichtig: Schreibe deine Antwort als Briefing in die Outbox und übernimm diese Frontmatter:
---
type: reply
output_kind: briefing
source: cron
job_id: ${job.id}
job_name: ${job.name}
briefing_title: "${briefingTitle}"
agent: ${agent_id}
---
` : ''}
`

  try {
    writeFileSync(`${inboxDir}/${filename}`, content)
  } catch (err) {
    console.error('Failed to write inbox file:', err)
    return NextResponse.json({ error: 'Failed to write trigger file' }, { status: 500 })
  }

  const notified = notifyAgent(agent_id, filename)

  await supabase
    .from('agent_cron_jobs')
    .update({ last_run_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', job_id)

  return NextResponse.json({
    ok: true,
    notified,
    message: notified
      ? `Job "${job.name}" an ${agent_id.toUpperCase()} gesendet`
      : `Job geschrieben, aber ${agent_id.toUpperCase()} tmux-Session nicht erreichbar`,
  })
}
