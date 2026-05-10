import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse, sanitizePathParam, escapeHtml } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'
import { updateGoalSchema, parseBody } from '@/lib/validation'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const isDemoMode = process.env.MANA_HUB_DEMO_MODE === 'true'

async function resolveProjectId(supabase: ReturnType<typeof createServerSupabase>, project?: string | null, projectId?: string | null) {
  if (projectId !== undefined) return projectId
  if (!project) return undefined

  let query = supabase
    .from('projects')
    .select('id, slug, name')
    .or(`slug.eq.${project},name.eq.${project}`)

  if (UUID_RE.test(project)) {
    query = supabase
      .from('projects')
      .select('id, slug, name')
      .or(`slug.eq.${project},name.eq.${project},id.eq.${project}`)
  }

  const { data } = await query.maybeSingle()
  return data?.id || null
}

// GET /api/agents/goals/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const { id } = await params
  const sanitizedId = sanitizePathParam(id)
  if (!sanitizedId) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  if (isDemoMode) {
    return NextResponse.json({
      goal: {
        id: sanitizedId,
        title: 'Install a self-hosted Mana Hub',
        status: 'active',
        level: 'project',
        progress: 62,
        target_value: 100,
        current_value: 62,
        unit: 'percent',
        tracking_source: 'manual',
        confidence: 'medium',
      },
    })
  }

  const supabase = createServerSupabase()

  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('id', sanitizedId)
    .single()

  if (error) {
    return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
  }

  return NextResponse.json({ goal: data })
}

// PATCH /api/agents/goals/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const { id } = await params
  const sanitizedId = sanitizePathParam(id)
  if (!sanitizedId) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = parseBody(updateGoalSchema, body)
  if (!parsed.success) return parsed.response

  if (isDemoMode) {
    return NextResponse.json({
      goal: {
        id: sanitizedId,
        ...parsed.data,
        updated_at: new Date().toISOString(),
      },
    })
  }

  const supabase = createServerSupabase()
  const updates: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(parsed.data)) {
    updates[key] = typeof value === 'string' ? escapeHtml(value) : value
  }

  if ('project' in parsed.data || 'project_id' in parsed.data) {
    updates.project_id = await resolveProjectId(supabase, parsed.data.project, parsed.data.project_id)
  }

  const { data, error } = await supabase
    .from('goals')
    .update(updates)
    .eq('id', sanitizedId)
    .select()
    .single()

  if (error) {
    console.error('Error updating goal:', error)
    return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 })
  }

  return NextResponse.json({ goal: data })
}

// DELETE /api/agents/goals/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const { id } = await params
  const sanitizedId = sanitizePathParam(id)
  if (!sanitizedId) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const supabase = createServerSupabase()

  const { error } = await supabase
    .from('goals')
    .delete()
    .eq('id', sanitizedId)

  if (error) {
    console.error('Error deleting goal:', error)
    return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
