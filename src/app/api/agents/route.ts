import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/agents - Liste aller Agents mit Skills und Heartbeats
export async function GET() {
  try {
    // Fetch agents
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('*')
      .eq('is_active', true)
      .order('hierarchy_level', { ascending: true })

    if (agentsError) {
      console.error('Agents fetch error:', agentsError)
      // Return fallback data if table doesn't exist
      return NextResponse.json({
        agents: getFallbackAgents()
      })
    }

    // Fetch skills for all agents
    const { data: skills } = await supabase
      .from('agent_skills')
      .select('*')
      .order('name', { ascending: true })

    // Fetch heartbeats for all agents
    const { data: heartbeats } = await supabase
      .from('agent_heartbeats')
      .select('*')
      .order('name', { ascending: true })

    // Combine data
    const agentsWithDetails = agents?.map(agent => ({
      ...agent,
      skills: skills?.filter(s => s.agent_id === agent.id) || [],
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
      skills: [
        { id: 's1', name: 'Planning', description: 'Plans and routes work', category: 'strategy', is_enabled: true },
        { id: 's2', name: 'Coordination', description: 'Coordinates the agent team', category: 'management', is_enabled: true },
      ],
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
      skills: [
        { id: 's3', name: 'Content Creation', description: 'Creates content drafts', category: 'content', is_enabled: true },
      ],
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
      skills: [
        { id: 's4', name: 'Research', description: 'Performs structured research', category: 'research', is_enabled: true },
      ],
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
      skills: [
        { id: 's5', name: 'Operations Review', description: 'Reviews operational risks', category: 'operations', is_enabled: true },
      ],
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
      skills: [
        { id: 's6', name: 'Implementation', description: 'Implements technical tasks', category: 'coding', is_enabled: true },
      ],
      heartbeats: []
    }
  ]
}
