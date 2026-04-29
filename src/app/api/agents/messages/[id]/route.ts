import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse, escapeHtml } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'
import { stopAgentWork } from '@/lib/agents/control'

type MessageRow = {
  id: string
  agent_name: string
  role: string
  content: string
  ticket_id?: string | null
  reply_to_id?: string | null
  metadata?: Record<string, unknown> | null
}

function mergeMetadata(message: MessageRow, updates: Record<string, unknown>) {
  return {
    ...(message.metadata || {}),
    ...updates,
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const { id } = await params
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const action = typeof body.action === 'string' ? body.action : 'edit'
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : undefined
  const stopAgent = body.stop_agent !== false

  const supabase = createServerSupabase()
  const { data: message, error: fetchError } = await supabase
    .from('agent_messages')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  const original = message as MessageRow
  if (original.role !== 'user') {
    return NextResponse.json({ error: 'Only user messages can be edited or retracted' }, { status: 400 })
  }

  const currentStatus = original.metadata?.lifecycle_status
  if (currentStatus === 'retracted') {
    return NextResponse.json({ error: 'Message already retracted' }, { status: 409 })
  }

  const now = new Date().toISOString()

  if (action === 'retract') {
    const { data, error } = await supabase
      .from('agent_messages')
      .update({
        metadata: mergeMetadata(original, {
          lifecycle_status: 'retracted',
          retracted_at: now,
          retracted_by: auth.email || auth.id,
          retract_reason: reason || 'User retracted message',
        }),
      })
      .eq('id', original.id)
      .select()
      .single()

    if (error) {
      console.error('Message retract error:', error.message)
      return NextResponse.json({ error: 'Failed to retract message' }, { status: 500 })
    }

    const stopResult = stopAgent
      ? await stopAgentWork(original.agent_name, reason || 'Message retracted by user', original.id)
      : { ok: true, interrupted: false }

    return NextResponse.json({ message: data, stop: stopResult })
  }

  if (action !== 'edit') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) {
    return NextResponse.json({ error: 'content required' }, { status: 400 })
  }

  const nextVersion = Number(original.metadata?.edit_version || 1) + 1
  const newRow: Record<string, unknown> = {
    agent_name: original.agent_name,
    role: 'user',
    content: escapeHtml(content),
    ticket_id: original.ticket_id ?? null,
    metadata: mergeMetadata(original, {
      lifecycle_status: 'edited',
      previous_message_id: original.id,
      edit_version: nextVersion,
      edited_at: now,
      edited_by: auth.email || auth.id,
    }),
  }
  if (original.reply_to_id) newRow.reply_to_id = original.reply_to_id

  const { data: editedMessage, error: insertError } = await supabase
    .from('agent_messages')
    .insert(newRow)
    .select()
    .single()

  if (insertError || !editedMessage) {
    console.error('Message edit insert error:', insertError?.message)
    return NextResponse.json({ error: 'Failed to create edited message' }, { status: 500 })
  }

  await supabase
    .from('agent_messages')
    .update({
      metadata: mergeMetadata(original, {
        lifecycle_status: 'superseded',
        edited_at: now,
        edited_by: auth.email || auth.id,
        superseded_by: editedMessage.id,
      }),
    })
    .eq('id', original.id)

  const stopResult = stopAgent
    ? await stopAgentWork(original.agent_name, reason || 'Message edited and resent by user', original.id)
    : { ok: true, interrupted: false }

  return NextResponse.json({
    message: editedMessage,
    original_message_id: original.id,
    stop: stopResult,
  }, { status: 201 })
}
