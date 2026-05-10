import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/agents - Liste aller aktiven Agents mit Heartbeats
export async function GET() {
  try {
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('*')
      .eq('is_active', true)
      .order('hierarchy_level', { ascending: true })

    if (agentsError) {
      console.error('Agents fetch error:', agentsError)
      return NextResponse.json({
        agents: getFallbackAgents()
      })
    }

    const { data: heartbeats } = await supabase
      .from('agent_heartbeats')
      .select('*')
      .order('name', { ascending: true })

    const agentsWithDetails = agents?.map(agent => ({
      ...agent,
      heartbeats: heartbeats?.filter(h => h.agent_id === agent.id) || []
    })) || []

    return NextResponse.json({ agents: agentsWithDetails })
  } catch (error) {
    console.error('Error fetching agents:', error)
    return NextResponse.json({ 
      agents: getFallbackAgents(),
      error: 'Failed to fetch from database, using fallback' 
    })
  }
}

// POST /api/agents - Create new agent
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const ALLOWED_FIELDS = ['name', 'full_name', 'role', 'description', 'emoji', 'department',
      'department_color', 'status', 'hierarchy_level', 'reports_to', 'is_active']
    const sanitized: Record<string, unknown> = {}
    for (const key of ALLOWED_FIELDS) {
      if (key in body) sanitized[key] = body[key]
    }

    const { data, error } = await supabase
      .from('agents')
      .insert([sanitized])
      .select()
      .single()

    if (error) {
      console.error('Error creating agent:', error)
      return NextResponse.json({ error: 'Failed to create agent' }, { status: 400 })
    }

    return NextResponse.json({ agent: data })
  } catch (error) {
    console.error('Error creating agent:', error)
    return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 })
  }
}

// Fallback data if database not set up yet
function getFallbackAgents() {
  return [
    {
      id: '1',
      name: 'Orchestrator',
      full_name: 'Demo Orchestrator Agent',
      role: 'Orchestrator Agent',
      description: 'Coordinates the AI agent team and routes work to specialists.',
      emoji: '◎',
      department: 'Executive',
      department_color: '#8B5CF6',
      status: 'online',
      hierarchy_level: 1,
      heartbeats: [
        { id: 'h1', name: 'Agent Inbox Check', description: 'Checks agent inboxes', type: 'heartbeat', task_description: 'Check pending messages', is_enabled: true },
      ]
    },
    {
      id: '2',
      name: 'Creator',
      full_name: 'Demo Creator Agent',
      role: 'Content Agent',
      description: 'Turns strategy and research into content drafts.',
      emoji: '✦',
      department: 'Content',
      department_color: '#EC4899',
      status: 'online',
      hierarchy_level: 2,
      reports_to: '1',
      heartbeats: []
    },
    {
      id: '3',
      name: 'Researcher',
      full_name: 'Demo Research Agent',
      role: 'Research Agent',
      description: 'Researches sources, checks facts, and prepares briefings.',
      emoji: '◇',
      department: 'Research',
      department_color: '#3B82F6',
      status: 'online',
      hierarchy_level: 2,
      reports_to: '1',
      heartbeats: []
    },
    {
      id: '4',
      name: 'Operator',
      full_name: 'Demo Operations Agent',
      role: 'Operations Agent',
      description: 'Tracks operations, approvals, and recurring checks.',
      emoji: '△',
      department: 'Operations',
      department_color: '#10B981',
      status: 'online',
      hierarchy_level: 2,
      reports_to: '1',
      heartbeats: []
    },
    {
      id: '5',
      name: 'Builder',
      full_name: 'Demo Builder Agent',
      role: 'Code Agent',
      description: 'Handles implementation tasks and technical handoffs.',
      emoji: '▣',
      department: 'Engineering',
      department_color: '#F59E0B',
      status: 'online',
      hierarchy_level: 2,
      reports_to: '1',
      heartbeats: []
    }
  ]
}
