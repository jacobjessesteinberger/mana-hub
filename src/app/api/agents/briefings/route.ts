import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'
import { enrichBriefingRow, isBriefingRow, type AgentCronJob, type BriefingRow } from '@/lib/agents/briefings'

const isDemoMode = process.env.MANA_HUB_DEMO_MODE === 'true'

interface BriefingUserState {
  briefing_id: string
  read_at: string | null
  archived_at: string | null
  pinned_at: string | null
  dismissed_urgency_at: string | null
}

type BriefingWithState = BriefingRow & {
  read_at: string | null
  archived_at: string | null
  pinned_at: string | null
  dismissed_urgency_at: string | null
  is_unread: boolean
  is_archived: boolean
  is_pinned: boolean
  needs_attention: boolean
}

function attachState(row: BriefingRow, state?: BriefingUserState): BriefingWithState {
  const urgency = row.metadata?.urgency || 'low'
  const isUnread = !state?.read_at
  const urgencyDismissed = Boolean(state?.dismissed_urgency_at)
  return {
    ...row,
    read_at: state?.read_at || null,
    archived_at: state?.archived_at || null,
    pinned_at: state?.pinned_at || null,
    dismissed_urgency_at: state?.dismissed_urgency_at || null,
    is_unread: isUnread,
    is_archived: Boolean(state?.archived_at),
    is_pinned: Boolean(state?.pinned_at),
    needs_attention: !urgencyDismissed && (urgency === 'critical' || urgency === 'high' || row.metadata?.action_required === true),
  }
}

function sortBriefings(a: BriefingWithState, b: BriefingWithState) {
  if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
  if (a.needs_attention !== b.needs_attention) return a.needs_attention ? -1 : 1
  if (a.is_unread !== b.is_unread) return a.is_unread ? -1 : 1
  return b.created_at.localeCompare(a.created_at)
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
  const days = Math.min(parseInt(searchParams.get('days') || '30', 10), 90)
  const view = searchParams.get('view') || 'inbox'
  const status = searchParams.get('status')
  const agent = searchParams.get('agent')
  const category = searchParams.get('category')
  const urgency = searchParams.get('urgency')
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  if (isDemoMode) {
    const row = attachState({
      id: 'demo-briefing-1',
      agent_name: 'researcher',
      role: 'assistant',
      content: 'Demo briefing: the starter is running locally, setup steps are visible, and no production data is connected.',
      ticket_id: null,
      reply_to_id: null,
      created_at: new Date().toISOString(),
      metadata: {
        category: 'setup',
        urgency: 'normal',
        action_required: false,
      },
    } as BriefingRow)
    const briefings = [row]
      .filter(item => agent && agent !== 'all' ? item.agent_name === agent : true)
      .filter(item => category && category !== 'all' ? item.metadata?.category === category : true)
      .filter(item => urgency && urgency !== 'all' ? item.metadata?.urgency === urgency : true)
      .slice(0, limit)
    return NextResponse.json({
      briefings,
      stats: {
        total: 1,
        unread: 1,
        needs_attention: 0,
        catchup: 0,
        archived: 0,
        today_unread: 1,
      },
    })
  }

  const supabase = createServerSupabase()
  const baseSelect = 'id, agent_name, role, content, ticket_id, reply_to_id, created_at'
  const selectWithMetadata = `${baseSelect}, metadata`

  const { data: cronJobs } = await supabase
    .from('agent_cron_jobs')
    .select('id, agent_id, name, description, prompt, enabled, schedule_hour, schedule_minute, schedule_day')
    .eq('enabled', true)

  let { data, error } = await supabase
    .from('agent_messages')
    .select(selectWithMetadata)
    .eq('role', 'assistant')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1000)

  if (error && error.message.includes('metadata')) {
    const retry = await supabase
      .from('agent_messages')
      .select(baseSelect)
      .eq('role', 'assistant')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1000)

    data = retry.data?.map(row => ({ ...row, metadata: null })) || null
    error = retry.error
  }

  if (error) {
    console.error('Briefings fetch error:', error.message)
    return NextResponse.json({ briefings: [], error: 'Failed to fetch briefings' }, { status: 500 })
  }

  const enrichedBriefings = ((data || []) as BriefingRow[])
    .filter(row => isBriefingRow(row, (cronJobs || []) as AgentCronJob[]))
    .map(row => enrichBriefingRow(row, (cronJobs || []) as AgentCronJob[]))

  const briefingIds = enrichedBriefings.map(row => row.id)
  let userStates: BriefingUserState[] = []
  if (briefingIds.length > 0) {
    const { data: states, error: stateError } = await supabase
      .from('briefing_user_state')
      .select('briefing_id, read_at, archived_at, pinned_at, dismissed_urgency_at')
      .eq('user_id', auth.id)
      .in('briefing_id', briefingIds)

    if (!stateError) {
      userStates = (states || []) as BriefingUserState[]
    } else if (!stateError.message.includes('briefing_user_state')) {
      console.error('Briefing state fetch error:', stateError.message)
    }
  }

  const stateByBriefingId = new Map(userStates.map(state => [state.briefing_id, state]))
  const allWithState = enrichedBriefings
    .map(row => attachState(row, stateByBriefingId.get(row.id)))

  const todayPrefix = new Date().toISOString().slice(0, 10)
  const stats = {
    total: allWithState.length,
    unread: allWithState.filter(row => row.is_unread && !row.is_archived).length,
    needs_attention: allWithState.filter(row => row.needs_attention && !row.is_archived).length,
    catchup: allWithState.filter(row => row.is_unread && !row.is_archived && !row.created_at.startsWith(todayPrefix)).length,
    archived: allWithState.filter(row => row.is_archived).length,
    today_unread: allWithState.filter(row => row.is_unread && !row.is_archived && row.created_at.startsWith(todayPrefix)).length,
  }

  const filtered = allWithState
    .filter(row => {
      if (view === 'archive') return row.is_archived
      if (view === 'read') return !row.is_unread || row.is_archived
      if (view === 'catchup') return !row.is_archived && row.is_unread && !row.created_at.startsWith(todayPrefix)
      if (view === 'all' || view === 'reader' || view === 'list') return !row.is_archived
      return !row.is_archived && row.is_unread
    })
    .filter(row => status === 'unread' ? row.is_unread : status === 'read' ? !row.is_unread : true)
    .filter(row => agent && agent !== 'all' ? row.agent_name === agent : true)
    .filter(row => category && category !== 'all' ? row.metadata?.category === category : true)
    .filter(row => urgency && urgency !== 'all' ? row.metadata?.urgency === urgency : true)
    .sort(sortBriefings)
    .slice(0, limit)

  return NextResponse.json({ briefings: filtered, stats }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  })
}
