import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { AGENTS } from '@/lib/agents-meta'

const isDemoMode = process.env.MANA_HUB_DEMO_MODE === 'true'


export async function GET() {
  if (isDemoMode) {
    const now = Date.now()
    return NextResponse.json({
      agents: AGENTS.map((agent, index) => ({
        id: agent.name,
        name: agent.label,
        emoji: agent.emoji,
        role: agent.role,
        department: agent.role,
        department_color: agent.color,
        is_online: index < 3,
        model: 'demo-agent',
        heartbeat_interval: '30s',
        last_seen: new Date(now - index * 45_000).toISOString(),
        updated_at: new Date(now - index * 45_000).toISOString(),
        uptime_minutes: 120 - index * 12,
        context_window_percent: 24 + index * 8,
        context_tokens: 12_000 + index * 4000,
        context_max: 200000,
        messages_session: 4 + index,
        health_flags: index < 3 ? [] : ['Demo agent offline'],
        last_action_preview: index < 3 ? 'Demo activity from local preview mode' : null,
        last_action_time: index < 3 ? new Date(now - index * 60_000).toISOString() : null,
        heartbeat_age_ms: index * 45_000,
      })),
      cron_jobs: [
        {
          id: 'demo-morning-briefing',
          agent_id: 'researcher',
          name: 'Morning Briefing',
          description: 'Demo briefing job with research, quality check, and output review.',
          enabled: true,
          schedule_hour: 8,
          schedule_minute: 30,
          last_status: 'success',
        },
      ],
      activity: [
        {
          agent_id: 'researcher',
          event_summary: 'Prepared demo research briefing',
          created_at: new Date(now - 300_000).toISOString(),
        },
      ],
      token_usage: {},
      recent_actions: [],
      source: 'demo',
    })
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get latest heartbeat per agent from agent_heartbeats
    const { data: heartbeats } = await supabase
      .from('agent_heartbeats')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    const latestHb: Record<string, typeof heartbeats extends (infer T)[] | null ? T : never> = {}
    for (const hb of heartbeats || []) {
      if (!latestHb[hb.agent_name]) {
        latestHb[hb.agent_name] = hb
      }
    }

    // Get cron jobs (try agent_cron_jobs, fall back gracefully)
    let cronJobs: unknown[] = []
    try {
      const { data } = await supabase
        .from('agent_cron_jobs')
        .select('*')
        .order('agent_id')
        .order('name')
      cronJobs = data || []
    } catch { /* table may not exist */ }

    // Get activity log (try agent_activity_log, fall back gracefully)
    let activityLog: unknown[] = []
    try {
      const { data } = await supabase
        .from('agent_activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      activityLog = data || []
    } catch { /* table may not exist */ }

    // Get recent heartbeat history for restart detection
    const { data: hbHistory } = await supabase
      .from('agent_heartbeats')
      .select('agent_name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    // Get latest messages per agent for "last action"
    const { data: recentMsgs } = await supabase
      .from('agent_messages')
      .select('agent_name, content, created_at, role')
      .order('created_at', { ascending: false })
      .limit(30)

    // Build agent list from agents-meta.ts + heartbeats
    const now = Date.now()
    const agents = AGENTS.map(agent => {
      const hb = latestHb[agent.name]
      const hbAge = hb ? now - new Date(hb.created_at).getTime() : Infinity
      const isOnline = hb?.status === 'online' && hbAge < 120_000

      const contextPercent = hb?.context_usage_percent ?? 0
      const uptimeMinutes = hb?.session_uptime_minutes || 0

      // Health flags
      const healthFlags: string[] = []
      const agentHbHistory = (hbHistory || []).filter((h: { agent_name: string }) => h.agent_name === agent.name)
      const offlineTransitions = agentHbHistory.filter((h: { status: string }, i: number, arr: { status: string }[]) =>
        h.status === 'online' && i + 1 < arr.length && arr[i + 1].status === 'offline'
      )
      if (offlineTransitions.length > 0) {
        healthFlags.push(`${offlineTransitions.length} Restart(s) in letzten Heartbeats`)
      }
      if (hbAge > 300_000 && hb) {
        healthFlags.push('Heartbeat veraltet (>5min)')
      }
      if (contextPercent > 80) {
        healthFlags.push(`Kontext bei ${contextPercent}% — Komprimierung bald`)
      }
      if (!hb) {
        healthFlags.push('Kein Heartbeat empfangen')
      }

      const lastMsg = (recentMsgs || []).find((m: { agent_name: string }) => m.agent_name === agent.name)

      return {
        id: agent.name,
        name: agent.label,
        emoji: agent.emoji,
        role: agent.role,
        department: agent.role,
        department_color: agent.color,
        is_online: isOnline,
        model: 'claude-code/opus-4.6',
        heartbeat_interval: '15s',
        last_seen: hb?.created_at || null,
        updated_at: hb?.created_at || null,
        uptime_minutes: uptimeMinutes,
        context_window_percent: contextPercent,
        context_tokens: Math.round(contextPercent * 2000),
        context_max: 200000,
        messages_session: 0,
        health_flags: healthFlags,
        last_action_preview: lastMsg?.content?.substring(0, 100) || null,
        last_action_time: lastMsg?.created_at || null,
        heartbeat_age_ms: hb ? hbAge : null,
      }
    })

    return NextResponse.json({
      agents,
      cron_jobs: cronJobs,
      activity: activityLog,
      token_usage: {},
      recent_actions: [],
      source: 'live',
    })
  } catch (error) {
    console.error('Monitoring API error:', error)

    const fallbackAgents = AGENTS.map(a => ({
      id: a.name,
      name: a.label,
      emoji: a.emoji,
      role: a.role,
      department: a.role,
      department_color: a.color,
      is_online: false,
      model: 'claude-code/opus-4.6',
      heartbeat_interval: '15s',
      last_seen: null,
      updated_at: null,
      uptime_minutes: 0,
      context_window_percent: 0,
      context_tokens: 0,
      context_max: 200000,
      messages_session: 0,
      health_flags: ['Keine Daten verfügbar'],
      last_action_preview: null,
      last_action_time: null,
      heartbeat_age_ms: null,
    }))

    return NextResponse.json({
      agents: fallbackAgents,
      cron_jobs: [],
      activity: [],
      token_usage: {},
      recent_actions: [],
      source: 'fallback',
    })
  }
}
