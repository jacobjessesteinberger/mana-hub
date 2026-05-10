import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'
import { AGENT_MAP } from '@/lib/agents-meta'

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const supabase = createServerSupabase()
  const { data, error } = await supabase
    .from('agent_profiles')
    .select('*')
    .order('agent_name')

  if (error) {
    return NextResponse.json({ profiles: [] })
  }

  const profiles = (data || []).map(p => ({
    ...p,
    meta: AGENT_MAP[p.agent_name] || null,
  }))

  return NextResponse.json({ profiles })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const body = await request.json()
  const { agent_name, ...updates } = body

  if (!agent_name) {
    return NextResponse.json({ error: 'agent_name required' }, { status: 400 })
  }

  const supabase = createServerSupabase()
  const { data, error } = await supabase
    .from('agent_profiles')
    .update(updates)
    .eq('agent_name', agent_name)
    .select()
    .single()

  if (error) {
    console.error('Profile update error:', error.message)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }

  return NextResponse.json({ profile: data })
}
