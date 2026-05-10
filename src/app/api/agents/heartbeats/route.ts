import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'

const isDemoMode = process.env.MANA_HUB_DEMO_MODE === 'true'

// GET /api/agents/heartbeats?agent=researcher — latest heartbeat per agent
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const { searchParams } = new URL(request.url)
  const agent = searchParams.get('agent')

  if (isDemoMode) {
    if (agent) return NextResponse.json({ heartbeat: null })
    return NextResponse.json({ heartbeats: [] })
  }

  const supabase = createServerSupabase()

  if (agent) {
    // Single agent: latest heartbeat
    const { data, error } = await supabase
      .from('agent_heartbeats')
      .select('*')
      .eq('agent_name', agent)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      return NextResponse.json({ heartbeat: null })
    }

    return NextResponse.json({ heartbeat: data })
  }

  // All agents: latest heartbeat per agent using distinct
  const { data, error } = await supabase
    .rpc('get_latest_heartbeats')

  if (error) {
    // Fallback: just get recent heartbeats
    const { data: fallback } = await supabase
      .from('agent_heartbeats')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({ heartbeats: fallback || [] })
  }

  return NextResponse.json({ heartbeats: data })
}
