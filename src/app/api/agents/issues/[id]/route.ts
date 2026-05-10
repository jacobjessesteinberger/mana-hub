import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse, sanitizePathParam, escapeHtml } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'
import { updateIssueSchema, parseBody } from '@/lib/validation'

// GET /api/agents/issues/[id]
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
    .from('issues')
    .select('*')
    .eq('id', sanitizedId)
    .single()

  if (error) {
    return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
  }

  return NextResponse.json({ issue: data })
}

// PATCH /api/agents/issues/[id]
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

  const parsed = parseBody(updateIssueSchema, body)
  if (!parsed.success) return parsed.response

  const updates: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(parsed.data)) {
    updates[key] = typeof value === 'string' && key !== 'labels'
      ? escapeHtml(value)
      : value
  }

  if (parsed.data.status === 'in_progress') {
    updates.started_at = new Date().toISOString()
  }
  if (parsed.data.status === 'done') {
    updates.completed_at = new Date().toISOString()
  }

  const supabase = createServerSupabase()

  const { data, error } = await supabase
    .from('issues')
    .update(updates)
    .eq('id', sanitizedId)
    .select()
    .single()

  if (error) {
    console.error('Error updating issue:', error)
    return NextResponse.json({ error: 'Failed to update issue' }, { status: 500 })
  }

  return NextResponse.json({ issue: data })
}

// DELETE /api/agents/issues/[id]
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
    .from('issues')
    .delete()
    .eq('id', sanitizedId)

  if (error) {
    console.error('Error deleting issue:', error)
    return NextResponse.json({ error: 'Failed to delete issue' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
