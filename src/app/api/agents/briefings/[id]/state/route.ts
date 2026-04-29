import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'

type BriefingStateAction =
  | 'mark_read'
  | 'mark_unread'
  | 'archive'
  | 'unarchive'
  | 'pin'
  | 'unpin'
  | 'dismiss_urgency'

interface BriefingUserState {
  briefing_id: string
  user_id: string
  read_at: string | null
  archived_at: string | null
  pinned_at: string | null
  dismissed_urgency_at: string | null
}

const ACTIONS = new Set<BriefingStateAction>([
  'mark_read',
  'mark_unread',
  'archive',
  'unarchive',
  'pin',
  'unpin',
  'dismiss_urgency',
])

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const { id } = await params
  const body = await request.json().catch(() => ({})) as { action?: BriefingStateAction }
  const action = body.action

  if (!action || !ACTIONS.has(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const supabase = createServerSupabase()
  const { data: briefing, error: briefingError } = await supabase
    .from('agent_messages')
    .select('id, role')
    .eq('id', id)
    .eq('role', 'assistant')
    .single()

  if (briefingError || !briefing) {
    return NextResponse.json({ error: 'Briefing not found' }, { status: 404 })
  }

  const { data: existing, error: existingError } = await supabase
    .from('briefing_user_state')
    .select('briefing_id, user_id, read_at, archived_at, pinned_at, dismissed_urgency_at')
    .eq('briefing_id', id)
    .eq('user_id', auth.id)
    .maybeSingle()

  if (existingError && !existingError.message.includes('briefing_user_state')) {
    return NextResponse.json({ error: 'Failed to fetch briefing state' }, { status: 500 })
  }

  if (existingError?.message.includes('briefing_user_state')) {
    return NextResponse.json({
      error: 'briefing_user_state table missing',
      migration_required: true,
      migration: 'supabase/migrations/20260426_briefing_user_state.sql',
    }, { status: 409 })
  }

  const now = new Date().toISOString()
  const nextState: BriefingUserState = {
    briefing_id: id,
    user_id: auth.id,
    read_at: existing?.read_at || null,
    archived_at: existing?.archived_at || null,
    pinned_at: existing?.pinned_at || null,
    dismissed_urgency_at: existing?.dismissed_urgency_at || null,
  }

  switch (action) {
    case 'mark_read':
      nextState.read_at = now
      break
    case 'mark_unread':
      nextState.read_at = null
      break
    case 'archive':
      nextState.archived_at = now
      nextState.read_at = nextState.read_at || now
      break
    case 'unarchive':
      nextState.archived_at = null
      break
    case 'pin':
      nextState.pinned_at = now
      break
    case 'unpin':
      nextState.pinned_at = null
      break
    case 'dismiss_urgency':
      nextState.dismissed_urgency_at = now
      break
  }

  const { data, error } = await supabase
    .from('briefing_user_state')
    .upsert(nextState, { onConflict: 'briefing_id,user_id' })
    .select('briefing_id, user_id, read_at, archived_at, pinned_at, dismissed_urgency_at')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to update briefing state' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, state: data }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  })
}
