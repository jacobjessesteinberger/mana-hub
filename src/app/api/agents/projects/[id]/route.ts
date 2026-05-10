import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'

const isDemoMode = process.env.MANA_HUB_DEMO_MODE === 'true'

type WorkspaceProject = {
  id: string
  slug: string
  name: string
}

type WorkspaceLinkedRow = {
  id: string
  project_id?: string | null
  project?: string | null
}

function belongsToWorkspace(row: WorkspaceLinkedRow, project: WorkspaceProject) {
  const legacyProject = row.project?.toLowerCase()
  return row.project_id === project.id || legacyProject === project.slug.toLowerCase() || legacyProject === project.name.toLowerCase()
}

function uniqueById<T extends { id: string }>(rows: T[]) {
  return [...new Map(rows.map(row => [row.id, row])).values()]
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const { id } = await params

  if (isDemoMode && id === 'demo-workspace-1') {
    return NextResponse.json({
      project: {
        id,
        slug: 'starter-setup',
        name: 'Starter Setup Workspace',
        description: 'Demo workspace for validating onboarding, agents, jobs, and skills.',
        status: 'active',
        color: '#10B981',
        owner_agent: 'orchestrator',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      issues: [
        {
          id: 'demo-task-1',
          issue_key: 'AH-1',
          title: 'Review the first demo briefing workflow',
          status: 'in_progress',
          priority: 'high',
          agent_name: 'researcher',
          created_at: new Date().toISOString(),
        },
        {
          id: 'demo-task-2',
          issue_key: 'AH-2',
          title: 'Approve risky automation change',
          status: 'in_review',
          priority: 'critical',
          agent_name: 'builder',
          created_at: new Date().toISOString(),
        },
      ],
      goals: [
        {
          id: 'demo-goal-1',
          title: 'Install a self-hosted Mana Hub',
          status: 'active',
          level: 'project',
          created_at: new Date().toISOString(),
        },
      ],
    })
  }

  const supabase = createServerSupabase()

  const projectRes = await supabase.from('projects').select('*').eq('id', id).single()

  if (projectRes.error) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const project = projectRes.data as WorkspaceProject
  const [linkedIssuesRes, legacyIssuesRes, linkedGoalsRes, legacyGoalsRes] = await Promise.all([
    supabase.from('issues').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('issues').select('*').in('project', [project.slug, project.name]).order('created_at', { ascending: false }),
    supabase.from('goals').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('goals').select('*').in('project', [project.slug, project.name]).order('created_at', { ascending: false }),
  ])

  const issues = uniqueById([
    ...(linkedIssuesRes.data || []),
    ...(legacyIssuesRes.data || []),
  ]).filter(row => belongsToWorkspace(row, project))

  const goals = uniqueById([
    ...(linkedGoalsRes.data || []),
    ...(legacyGoalsRes.data || []),
  ]).filter(row => belongsToWorkspace(row, project))

  return NextResponse.json({
    project,
    issues,
    goals,
  })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const { id } = await params
  const body = await request.json()
  const allowedFields = new Set(['name', 'description', 'status', 'color', 'owner_agent'])
  const updates: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(body)) {
    if (allowedFields.has(key)) {
      updates[key] = value
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid workspace fields provided' }, { status: 400 })
  }

  if (typeof updates.name === 'string') {
    updates.name = updates.name.trim()
  }

  if (updates.name === '') {
    return NextResponse.json({ error: 'name must not be empty' }, { status: 400 })
  }

  if (updates.status && !['active', 'paused', 'completed', 'archived'].includes(String(updates.status))) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 })
  }

  const supabase = createServerSupabase()
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Project update error:', error.message)
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }

  return NextResponse.json({ project: data })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const { id } = await params
  const supabase = createServerSupabase()

  const { error } = await supabase
    .from('projects')
    .update({ status: 'archived' })
    .eq('id', id)

  if (error) {
    console.error('Project archive error:', error.message)
    return NextResponse.json({ error: 'Failed to archive project' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
