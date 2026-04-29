import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse, sanitizePathParam } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'

const isDemoMode = process.env.MANA_HUB_DEMO_MODE === 'true'

// GET /api/agents/[id]/skills
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (isAuthResponse(auth)) return auth

  const { id } = await params
  const sanitizedId = sanitizePathParam(id)
  if (!sanitizedId) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  if (isDemoMode) {
    return NextResponse.json({
      skills: sanitizedId === 'researcher'
        ? [
          {
            id: 'demo-skill-research',
            agent_id: 'researcher',
            name: 'Demo Research Brief',
            description: 'Reads relevant markdown headings and prepares concise briefings.',
            category: 'research',
            is_enabled: true,
            config: {},
          },
        ]
        : [],
    })
  }

  try {
    const supabase = createServerSupabase()
    const { data: skills, error } = await supabase
      .from('agent_skills')
      .select('*')
      .eq('agent_id', sanitizedId)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching skills:', error)
      return NextResponse.json({ error: 'Failed to fetch skills' }, { status: 400 })
    }

    return NextResponse.json({ skills: skills || [] })
  } catch (error) {
    console.error('Error fetching skills:', error)
    return NextResponse.json({ error: 'Failed to fetch skills' }, { status: 500 })
  }
}

// POST /api/agents/[id]/skills
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (isAuthResponse(auth)) return auth

  const { id } = await params
  const sanitizedId = sanitizePathParam(id)
  if (!sanitizedId) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  try {
    const body = await req.json()
    const supabase = createServerSupabase()

    const ALLOWED = ['name', 'description', 'category', 'is_enabled', 'config']
    const sanitized: Record<string, unknown> = { agent_id: sanitizedId }
    for (const key of ALLOWED) {
      if (key in body) sanitized[key] = body[key]
    }

    const { data, error } = await supabase
      .from('agent_skills')
      .insert([sanitized])
      .select()
      .single()

    if (error) {
      console.error('Error creating skill:', error)
      return NextResponse.json({ error: 'Failed to create skill' }, { status: 400 })
    }

    return NextResponse.json({ skill: data })
  } catch (error) {
    console.error('Error creating skill:', error)
    return NextResponse.json({ error: 'Failed to create skill' }, { status: 500 })
  }
}
