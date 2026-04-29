import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse, escapeHtml } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'
import { AGENT_NAMES } from '@/lib/agents-meta'
import { normalizeAutomationRunbook } from '@/lib/agents/automation-runbook'

const RISK_TERMS = /shell|script|exec|token|credential|secret|delete|filesystem|network|http|api|browser|oauth|env|sudo|payment|finance/i
const isDemoMode = process.env.MANA_HUB_DEMO_MODE === 'true'

interface CronJobSkillSource {
  id?: string
  agent_id?: string | null
  name?: string | null
  description?: string | null
  prompt?: string | null
  runbook?: unknown
}

function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
}

function analyzeSkill(input: { name: string; description?: string; source_url?: string }) {
  const text = `${input.name}\n${input.description || ''}\n${input.source_url || ''}`
  const requiredPermissions = [
    /shell|script|exec|sudo/i.test(text) ? 'shell' : null,
    /network|http|api|browser|oauth/i.test(text) ? 'network' : null,
    /token|credential|secret|env/i.test(text) ? 'secrets_review' : null,
    /delete|filesystem|file/i.test(text) ? 'filesystem' : null,
  ].filter((item): item is string => Boolean(item))
  const riskLevel = /sudo|credential|secret|token|delete|payment|finance/i.test(text)
    ? 'critical'
    : RISK_TERMS.test(text)
      ? 'high'
      : 'medium'
  const securityScore = riskLevel === 'critical' ? 35 : riskLevel === 'high' ? 55 : 78
  const qualityScore = input.description && input.description.length > 80 ? 78 : 58
  const status = riskLevel === 'critical' ? 'reviewing' : 'safe'

  return {
    status,
    risk_level: riskLevel,
    security_score: securityScore,
    quality_score: qualityScore,
    required_permissions: requiredPermissions,
    review_summary: riskLevel === 'critical'
      ? 'Kritische Berechtigungen erkannt. Manuelle Prüfung vor Installation erforderlich.'
      : riskLevel === 'high'
        ? 'Erhöhtes Risiko erkannt. Vor Installation Quelle und Berechtigungen prüfen.'
        : 'Automatische Prüfung ohne kritische Signale abgeschlossen.',
  }
}

function categoryFromSkill(skillName: string) {
  const lower = skillName.toLowerCase()
  if (lower.includes('research') || lower.includes('recherche')) return 'research'
  if (lower.includes('briefing') || lower.includes('report')) return 'management'
  if (lower.includes('fact') || lower.includes('quality') || lower.includes('check')) return 'analytics'
  if (lower.includes('content') || lower.includes('post') || lower.includes('video')) return 'content'
  if (lower.includes('finance') || lower.includes('deal')) return 'finance'
  if (lower.includes('code') || lower.includes('deploy')) return 'coding'
  return 'general'
}

function collectDiscoveredSkills(jobs: CronJobSkillSource[]) {
  const map = new Map<string, {
    id: string
    agent_id: string
    name: string
    description: string
    category: string
    source: 'runbook'
    confidence: string
    job_count: number
  }>()

  for (const job of jobs) {
    const agentId = job.agent_id || 'orchestrator'
    if (!AGENT_NAMES.has(agentId)) continue

    const runbook = normalizeAutomationRunbook(job)
    for (const skill of runbook.skill_refs || []) {
      const id = `${agentId}:${skill.skill_id}`
      const existing = map.get(id)
      if (existing) {
        existing.job_count += 1
        continue
      }
      map.set(id, {
        id,
        agent_id: agentId,
        name: skill.skill_name,
        description: skill.used_for,
        category: categoryFromSkill(skill.skill_name),
        source: 'runbook',
        confidence: skill.confidence,
        job_count: 1,
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  if (isDemoMode) {
    return NextResponse.json({
      skills: [
        {
          id: 'demo-skill-research',
          slug: 'demo-research-brief',
          name: 'Demo Research Brief',
          description: 'Reads only relevant knowledge-base headings and turns them into a concise briefing.',
          category: 'research',
          source: 'local',
          status: 'safe',
          risk_level: 'medium',
          security_score: 82,
          quality_score: 78,
          required_permissions: [],
          review_summary: 'Demo skill for local preview.',
          created_at: new Date().toISOString(),
        },
      ],
      assignments: [
        {
          id: 'demo-assignment-1',
          skill_id: 'demo-skill-research',
          agent_id: 'researcher',
          status: 'assigned',
        },
      ],
      discoveredSkills: [
        {
          id: 'researcher:demo-research',
          agent_id: 'researcher',
          name: 'Demo Research',
          description: 'Used by the demo morning briefing job.',
          category: 'research',
          source: 'runbook',
          confidence: 'specified',
          job_count: 1,
        },
      ],
      needsMigration: false,
    })
  }

  const supabase = createServerSupabase()
  const [skillsRes, assignmentsRes, jobsRes] = await Promise.all([
    supabase.from('company_skills').select('*').order('created_at', { ascending: false }),
    supabase.from('company_skill_agent_assignments').select('*'),
    supabase
      .from('agent_cron_jobs')
      .select('id, agent_id, name, description, prompt, runbook')
      .order('agent_id'),
  ])

  const needsMigration = Boolean(skillsRes.error || assignmentsRes.error)
  if (skillsRes.error) {
    console.error('Skill hub fetch error:', skillsRes.error.message)
  }
  let jobsData = (jobsRes.data || []) as CronJobSkillSource[]
  if (jobsRes.error) {
    console.error('Skill discovery fetch error:', jobsRes.error.message)
    const fallbackJobsRes = await supabase
      .from('agent_cron_jobs')
      .select('id, agent_id, name, description, prompt')
      .order('agent_id')
    if (fallbackJobsRes.error) {
      console.error('Skill discovery fallback error:', fallbackJobsRes.error.message)
    } else {
      jobsData = (fallbackJobsRes.data || []) as CronJobSkillSource[]
    }
  }

  return NextResponse.json({
    skills: skillsRes.error ? [] : skillsRes.data || [],
    assignments: assignmentsRes.error ? [] : assignmentsRes.data || [],
    discoveredSkills: collectDiscoveredSkills(jobsData),
    needsMigration,
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const sourceUrl = typeof body.source_url === 'string' ? body.source_url.trim() : ''
  const source = ['local', 'cloud_hub', 'external', 'manual'].includes(String(body.source)) ? String(body.source) : 'manual'
  const version = typeof body.version === 'string' ? body.version.trim() : ''
  const analysis = analyzeSkill({ name, description, source_url: sourceUrl })

  const supabase = createServerSupabase()
  const { data, error } = await supabase
    .from('company_skills')
    .insert({
      slug: slugify(name) || `skill-${Date.now()}`,
      name: escapeHtml(name),
      description: description ? escapeHtml(description) : null,
      source,
      source_url: sourceUrl || null,
      version: version || null,
      created_by: auth.email,
      ...analysis,
      metadata: { imported_by: 'dashboard', auto_reviewed: true },
    })
    .select()
    .single()

  if (error) {
    console.error('Skill hub create error:', error.message)
    return NextResponse.json({ error: 'Failed to create skill proposal' }, { status: 500 })
  }

  return NextResponse.json({ skill: data }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const skillId = typeof body.skill_id === 'string' ? body.skill_id : ''
  if (!skillId) return NextResponse.json({ error: 'skill_id required' }, { status: 400 })

  const supabase = createServerSupabase()

  if (body.action === 'assign') {
    const agentIds = Array.isArray(body.agent_ids)
      ? body.agent_ids.map(String).filter(agent => AGENT_NAMES.has(agent))
      : []

    await supabase
      .from('company_skill_agent_assignments')
      .delete()
      .eq('skill_id', skillId)

    if (agentIds.length > 0) {
      const { error: assignError } = await supabase
        .from('company_skill_agent_assignments')
        .insert(agentIds.map(agent_id => ({ skill_id: skillId, agent_id, status: 'assigned' })))

      if (assignError) {
        console.error('Skill assignment error:', assignError.message)
        return NextResponse.json({ error: 'Failed to assign skill' }, { status: 500 })
      }
    }

    const { data } = await supabase
      .from('company_skills')
      .update({
        status: agentIds.length > 0 ? 'installed' : 'safe',
        installed_at: agentIds.length > 0 ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', skillId)
      .select()
      .single()

    return NextResponse.json({ ok: true, skill: data, agent_ids: agentIds })
  }

  if (body.action === 'status') {
    const status = typeof body.status === 'string' ? body.status : ''
    if (!['proposed', 'reviewing', 'safe', 'installed', 'rejected', 'disabled', 'update_available'].includes(status)) {
      return NextResponse.json({ error: 'invalid status' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('company_skills')
      .update({
        status,
        reviewed_at: ['safe', 'rejected'].includes(status) ? new Date().toISOString() : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', skillId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
    return NextResponse.json({ ok: true, skill: data })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
