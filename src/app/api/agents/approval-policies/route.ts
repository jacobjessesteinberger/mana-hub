import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'

const isDemoMode = process.env.MANA_HUB_DEMO_MODE === 'true'

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  if (isDemoMode) {
    return NextResponse.json({
      policies: [
        {
          id: 'demo-policy-1',
          name: 'Always: automation.config.update',
          description: 'Demo always-policy.',
          trigger_type: 'action_type',
          trigger_value: 'automation.config.update',
          enabled: true,
          agent_name: null,
          source: 'manual',
          decided_by: 'demo@local',
          use_count: 3,
          last_used_at: new Date(Date.now() - 86_400_000).toISOString(),
          created_at: new Date(Date.now() - 7 * 86_400_000).toISOString(),
        },
      ],
    })
  }

  const supabase = createServerSupabase()
  const { searchParams } = new URL(request.url)
  const agent = searchParams.get('agent')
  const enabled = searchParams.get('enabled')

  let query = supabase
    .from('approval_policies')
    .select('id, name, description, trigger_type, trigger_value, enabled, agent_name, source, decided_by, use_count, last_used_at, created_at, updated_at')
    .eq('trigger_type', 'action_type')
    .order('created_at', { ascending: false })
    .limit(100)

  if (agent) query = query.or(`agent_name.eq.${agent},agent_name.is.null`)
  if (enabled === 'true') query = query.eq('enabled', true)
  if (enabled === 'false') query = query.eq('enabled', false)

  const { data, error } = await query
  if (error) {
    console.error('approval_policies fetch error:', error.message)
    return NextResponse.json({ policies: [], error: 'Failed to fetch policies' }, { status: 500 })
  }
  return NextResponse.json({ policies: data || [] })
}
