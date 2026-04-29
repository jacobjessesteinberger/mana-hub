import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse, escapeHtml } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'

const MESSAGE_COLUMNS = '*'

// GET /api/agents/messages?agent=researcher&limit=100&before=ISO&after=ISO&ticket_id=xxx
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const { searchParams } = new URL(request.url)
  const agent = searchParams.get('agent')
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)
  const ticketId = searchParams.get('ticket_id')
  const before = searchParams.get('before')
  const after = searchParams.get('after')

  if (!agent) {
    return NextResponse.json({ error: 'agent parameter required' }, { status: 400 })
  }

  const supabase = createServerSupabase()

  if (after) {
    let query = supabase
      .from('agent_messages')
      .select(MESSAGE_COLUMNS)
      .eq('agent_name', agent)
      .gt('created_at', after)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (ticketId) query = query.eq('ticket_id', ticketId)

    const { data, error } = await query
    if (error) {
      console.error('Error fetching messages:', error)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }
    return NextResponse.json({ messages: data || [], has_more: false }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    })
  }

  let query = supabase
    .from('agent_messages')
    .select(MESSAGE_COLUMNS)
    .eq('agent_name', agent)
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (before) {
    query = query.lt('created_at', before)
  }
  if (ticketId) {
    query = query.eq('ticket_id', ticketId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }

  const rows = data || []
  const hasMore = rows.length > limit
  const messages = (hasMore ? rows.slice(0, limit) : rows).reverse()
  return NextResponse.json({ messages, has_more: hasMore }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
  })
}

// POST /api/agents/messages
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { createMessageSchema, parseBody } = await import('@/lib/validation')
  const parsed = parseBody(createMessageSchema, body)
  if (!parsed.success) return parsed.response

  const { agent_name, content, ticket_id, reply_to_id, metadata } = parsed.data
  const supabase = createServerSupabase()
  const sanitizedContent = escapeHtml(content)

  const row: Record<string, unknown> = {
    agent_name,
    content: sanitizedContent,
    role: 'user',
    ticket_id: ticket_id ?? null,
  }
  if (metadata?.attachments && metadata.attachments.length > 0) {
    row.metadata = metadata
  }
  if (reply_to_id) row.reply_to_id = reply_to_id

  let { data, error } = await supabase
    .from('agent_messages')
    .insert(row)
    .select()
    .single()

  if (error && reply_to_id) {
    delete row.reply_to_id
    const retry = await supabase
      .from('agent_messages')
      .insert(row)
      .select()
      .single()
    data = retry.data
    error = retry.error
  }

  if (error) {
    console.error('Error creating message:', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }

  return NextResponse.json({ message: data }, { status: 201 })
}
