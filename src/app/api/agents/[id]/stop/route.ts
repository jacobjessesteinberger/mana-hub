import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse } from '@/lib/auth/middleware'
import { stopAgentWork } from '@/lib/agents/control'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const { id } = await params
  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const reason = typeof body.reason === 'string' && body.reason.trim()
    ? body.reason.trim().slice(0, 500)
    : 'User requested stop'
  const sourceMessageId = typeof body.source_message_id === 'string' ? body.source_message_id : undefined

  const result = await stopAgentWork(id, reason, sourceMessageId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'Failed to stop agent' }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    interrupted: result.interrupted,
    message: result.interrupted
      ? `${id} was interrupted by the configured host adapter.`
      : `${id} stop was recorded; no live host session was interrupted.`,
  })
}
