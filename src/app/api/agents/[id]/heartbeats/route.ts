import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse, sanitizePathParam } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'

// GET /api/agents/[id]/heartbeats
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
    const { data: heartbeats, error } = await supabase
      .from('agent_heartbeats')
      .select('*')
      .eq('agent_id', sanitizedId)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching heartbeats:', error)
      return NextResponse.json({ error: 'Failed to fetch heartbeats' }, { status: 400 })
    }

    return NextResponse.json({ heartbeats: heartbeats || [] })
  } catch (error) {
    console.error('Error fetching heartbeats:', error)
    return NextResponse.json({ error: 'Failed to fetch heartbeats' }, { status: 500 })
  }
}

// POST /api/agents/[id]/heartbeats
export async function POST(
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

    const ALLOWED = ['name', 'description', 'type', 'task_description', 'schedule', 'is_enabled']
    const sanitized: Record<string, unknown> = { agent_id: sanitizedId }
    for (const key of ALLOWED) {
      if (key in body) sanitized[key] = body[key]
    }

    const { data, error } = await supabase
      .from('agent_heartbeats')
      .insert([sanitized])
      .select()
      .single()

    if (error) {
      console.error('Error creating heartbeat:', error)
      return NextResponse.json({ error: 'Failed to create heartbeat' }, { status: 400 })
    }

    return NextResponse.json({ heartbeat: data })
  } catch (error) {
    console.error('Error creating heartbeat:', error)
    return NextResponse.json({ error: 'Failed to create heartbeat' }, { status: 500 })
  }
}
