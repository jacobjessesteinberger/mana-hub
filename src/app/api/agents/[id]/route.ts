import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse, sanitizePathParam } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'

// GET /api/agents/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (isAuthResponse(auth)) return auth

  const { id } = await params
  const sanitizedId = sanitizePathParam(id)
  if (!sanitizedId) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  try {
    const supabase = createServerSupabase()
    const [agentRes, heartbeatsRes] = await Promise.all([
      supabase.from('agents').select('*').eq('id', sanitizedId).single(),
      supabase.from('agent_heartbeats').select('*').eq('agent_id', sanitizedId).order('name', { ascending: true }),
    ])

    const { data: agent, error: agentError } = agentRes
    const { data: heartbeats } = heartbeatsRes

    if (agentError) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    return NextResponse.json({
      agent: {
        ...agent,
        heartbeats: heartbeats || []
      }
    })
  } catch (error) {
    console.error('Error fetching agent:', error)
    return NextResponse.json({ error: 'Failed to fetch agent' }, { status: 500 })
  }
}

// PATCH /api/agents/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (isAuthResponse(auth)) return auth

  const { id } = await params
  const sanitizedId = sanitizePathParam(id)
  if (!sanitizedId) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  try {
    const body = await req.json()
    const supabase = createServerSupabase()

    const ALLOWED_FIELDS = ['name', 'full_name', 'role', 'description', 'emoji', 'department',
      'department_color', 'status', 'hierarchy_level', 'reports_to', 'is_active']
    const sanitized: Record<string, unknown> = {}
    for (const key of ALLOWED_FIELDS) {
      if (key in body) sanitized[key] = body[key]
    }

    const { data, error } = await supabase
      .from('agents')
      .update({
        ...sanitized,
        updated_at: new Date().toISOString()
      })
      .eq('id', sanitizedId)
      .select()
      .single()

    if (error) {
      console.error('Error updating agent:', error)
      return NextResponse.json({ error: 'Failed to update agent' }, { status: 400 })
    }

    return NextResponse.json({ agent: data })
  } catch (error) {
    console.error('Error updating agent:', error)
    return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 })
  }
}

// DELETE /api/agents/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (isAuthResponse(auth)) return auth

  const { id } = await params
  const sanitizedId = sanitizePathParam(id)
  if (!sanitizedId) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  try {
    const supabase = createServerSupabase()
    const { error } = await supabase
      .from('agents')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', sanitizedId)

    if (error) {
      console.error('Error deleting agent:', error)
      return NextResponse.json({ error: 'Failed to delete agent' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting agent:', error)
    return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 })
  }
}
