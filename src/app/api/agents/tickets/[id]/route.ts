import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse, escapeHtml } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'

// PATCH /api/agents/tickets/[id] — Ticket-Status updaten
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const { id } = await params

  try {
    const body = await request.json()

    const allowedFields = ['status', 'priority', 'result', 'title', 'description']
    const updates: Record<string, unknown> = {}

    for (const key of allowedFields) {
      if (key in body) {
        updates[key] = typeof body[key] === 'string' && ['title', 'description', 'result'].includes(key)
          ? escapeHtml(body[key])
          : body[key]
      }
    }

    // Set completed_at when status changes to done
    if (updates.status === 'done') {
      updates.completed_at = new Date().toISOString()
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const supabase = createServerSupabase()

    const { data, error } = await supabase
      .from('agent_tickets')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating ticket:', error)
      return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 })
    }

    return NextResponse.json({ ticket: data })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
