import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse, escapeHtml } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'

// GET /api/agents/tickets?agent=researcher&status=open
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const { searchParams } = new URL(request.url)
  const agent = searchParams.get('agent')
  const status = searchParams.get('status')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)

  const supabase = createServerSupabase()

  let query = supabase
    .from('agent_tickets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (agent) {
    query = query.eq('agent_name', agent)
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching tickets:', error)
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 })
  }

  return NextResponse.json({ tickets: data })
}

// POST /api/agents/tickets — Neues Ticket erstellen
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  try {
    const body = await request.json()
    const { agent_name, title, description, priority } = body

    if (!agent_name || !title) {
      return NextResponse.json({ error: 'agent_name and title required' }, { status: 400 })
    }

    const supabase = createServerSupabase()

    const { data, error } = await supabase
      .from('agent_tickets')
      .insert({
        agent_name,
        title: escapeHtml(title),
        description: description ? escapeHtml(description) : null,
        priority: priority || 'normal',
        created_by: auth.email
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating ticket:', error)
      return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 })
    }

    return NextResponse.json({ ticket: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
