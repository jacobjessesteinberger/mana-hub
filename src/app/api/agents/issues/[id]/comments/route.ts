import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse, sanitizePathParam, escapeHtml } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'
import { createCommentSchema, parseBody } from '@/lib/validation'

// GET /api/agents/issues/[id]/comments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const { id } = await params
  const sanitizedId = sanitizePathParam(id)
  if (!sanitizedId) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const supabase = createServerSupabase()

  const { data, error } = await supabase
    .from('issue_comments')
    .select('*')
    .eq('issue_id', sanitizedId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
  }

  return NextResponse.json({ comments: data })
}

// POST /api/agents/issues/[id]/comments
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const { id } = await params
  const sanitizedId = sanitizePathParam(id)
  if (!sanitizedId) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = parseBody(createCommentSchema, body)
  if (!parsed.success) return parsed.response

  const supabase = createServerSupabase()

  const { data, error } = await supabase
    .from('issue_comments')
    .insert({
      issue_id: sanitizedId,
      author: parsed.data.author ?? (auth as { email: string }).email.split('@')[0],
      content: escapeHtml(parsed.data.content),
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
  }

  return NextResponse.json({ comment: data }, { status: 201 })
}
