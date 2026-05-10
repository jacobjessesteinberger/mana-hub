import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'
import { AGENT_NAMES } from '@/lib/agents-meta'

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const agent = new URL(request.url).searchParams.get('agent')
  const supabase = createServerSupabase()

  if (!agent) {
    const { data } = await supabase
      .from('agent_activity')
      .select('agent_name, active, steps, elapsed, updated_at, permission_pending, permission_prompt')

    const map: Record<string, unknown> = {}
    for (const row of (data || []) as Array<Record<string, unknown>>) {
      const name = row.agent_name as string
      if (!name) continue
      map[name] = {
        active: row.active ?? false,
        steps: row.steps ?? [],
        elapsed: row.elapsed ?? null,
        updated_at: row.updated_at ?? null,
        permission_pending: row.permission_pending ?? false,
        permission_prompt: row.permission_prompt ?? null,
      }
    }

    return NextResponse.json({ activities: map }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  }

  if (!AGENT_NAMES.has(agent)) {
    return NextResponse.json({ active: false, steps: [], elapsed: null, updated_at: null })
  }

  const { data } = await supabase
    .from('agent_activity')
    .select('*')
    .eq('agent_name', agent)
    .single()

  return NextResponse.json({
    active: data?.active ?? false,
    steps: data?.steps ?? [],
    elapsed: data?.elapsed ?? null,
    updated_at: data?.updated_at ?? null,
    permission_pending: data?.permission_pending ?? false,
    permission_prompt: data?.permission_prompt ?? null,
  }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}
