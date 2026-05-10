import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const { id } = await params
  const supabase = createServerSupabase()
  const baseSelect = 'id, agent_name, role, content, ticket_id, reply_to_id, created_at'
  const selectWithMetadata = `${baseSelect}, metadata`

  let { data, error } = await supabase
    .from('agent_messages')
    .select(selectWithMetadata)
    .eq('id', id)
    .eq('role', 'assistant')
    .single()

  if (error && error.message.includes('metadata')) {
    const retry = await supabase
      .from('agent_messages')
      .select(baseSelect)
      .eq('id', id)
      .eq('role', 'assistant')
      .single()

    data = retry.data ? { ...retry.data, metadata: null } : null
    error = retry.error
  }

  if (error || !data) {
    return NextResponse.json({ error: 'Briefing not found' }, { status: 404 })
  }

  return NextResponse.json({ briefing: data }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  })
}
