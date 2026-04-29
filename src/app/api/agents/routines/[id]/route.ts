import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'
import { sanitizePathParam } from '@/lib/auth/middleware'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const { id } = await params
  const sanitizedId = sanitizePathParam(id)

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const input = body as { enabled?: boolean; runbook?: unknown; runbook_quality_score?: number; runbook_missing_fields?: string[] }
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof input.enabled === 'boolean') updates.enabled = input.enabled
  if (input.runbook && typeof input.runbook === 'object' && !Array.isArray(input.runbook)) {
    updates.runbook = input.runbook
    updates.runbook_updated_at = new Date().toISOString()
  }
  if (typeof input.runbook_quality_score === 'number') updates.runbook_quality_score = input.runbook_quality_score
  if (Array.isArray(input.runbook_missing_fields)) updates.runbook_missing_fields = input.runbook_missing_fields

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: 'enabled or runbook update required' }, { status: 400 })
  }

  const supabase = createServerSupabase()

  const { data, error } = await supabase
    .from('agent_cron_jobs')
    .update(updates)
    .eq('id', sanitizedId)
    .select()
    .single()

  if (error) {
    console.error('Error updating routine:', error)
    return NextResponse.json({ error: 'Failed to update routine' }, { status: 500 })
  }

  return NextResponse.json({ routine: data })
}
