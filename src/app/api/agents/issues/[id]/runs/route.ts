import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse, sanitizePathParam } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'
import { createRunSchema, updateRunSchema, parseBody } from '@/lib/validation'

// GET /api/agents/issues/[id]/runs
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

  const supabase = createServerSupabase()

  const { data, error } = await supabase
    .from('issue_runs')
    .select('*')
    .eq('issue_id', sanitizedId)
    .order('started_at', { ascending: false })

  if (error) {
    console.error('Error fetching runs:', error)
    return NextResponse.json({ error: 'Failed to fetch runs' }, { status: 500 })
  }

  return NextResponse.json({ runs: data })
}

// POST /api/agents/issues/[id]/runs
export async function POST(
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

  const parsed = parseBody(createRunSchema, body)
  if (!parsed.success) return parsed.response

  const supabase = createServerSupabase()

  const { data, error } = await supabase
    .from('issue_runs')
    .insert({
      issue_id: sanitizedId,
      agent_name: parsed.data.agent_name,
      status: 'running',
      run_id: `run-${Date.now()}`,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating run:', error)
    return NextResponse.json({ error: 'Failed to create run' }, { status: 500 })
  }

  await supabase
    .from('issues')
    .update({ status: 'in_progress', started_at: new Date().toISOString() })
    .eq('id', sanitizedId)
    .eq('status', 'todo')

  return NextResponse.json({ run: data }, { status: 201 })
}

// PATCH /api/agents/issues/[id]/runs — IDOR-safe: scoped to issue_id
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

  const parsed = parseBody(updateRunSchema, body)
  if (!parsed.success) return parsed.response

  const { run_id, status, output, tokens_used } = parsed.data

  const updates: Record<string, unknown> = { status }
  if (output) updates.output = output
  if (tokens_used) updates.tokens_used = tokens_used

  if (['succeeded', 'failed', 'stopped'].includes(status)) {
    updates.completed_at = new Date().toISOString()
  }

  const supabase = createServerSupabase()

  const { data, error } = await supabase
    .from('issue_runs')
    .update(updates)
    .eq('id', run_id)
    .eq('issue_id', sanitizedId)
    .select()
    .single()

  if (error) {
    console.error('Error updating run:', error)
    return NextResponse.json({ error: 'Failed to update run' }, { status: 500 })
  }

  return NextResponse.json({ run: data })
}
