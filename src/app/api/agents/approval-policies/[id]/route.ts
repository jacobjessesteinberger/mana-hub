import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'

const isDemoMode = process.env.MANA_HUB_DEMO_MODE === 'true'

/**
 * Soft-delete an always-policy. We disable rather than DELETE so the audit trail
 * (which approvals were auto-approved by this policy) stays intact.
 *
 * Use ?hard=true to actually drop the row (only do this if no approvals reference it).
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const { id } = await params
  if (isDemoMode) {
    return NextResponse.json({ ok: true, hard: false, id })
  }

  const supabase = createServerSupabase()
  const { searchParams } = new URL(request.url)
  const hard = searchParams.get('hard') === 'true'

  if (hard) {
    const { error } = await supabase.from('approval_policies').delete().eq('id', id)
    if (error) {
      console.error('approval_policies hard-delete error:', error.message)
      return NextResponse.json({ error: 'Failed to delete policy' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, hard: true, id })
  }

  const { error } = await supabase
    .from('approval_policies')
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) {
    console.error('approval_policies disable error:', error.message)
    return NextResponse.json({ error: 'Failed to disable policy' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, hard: false, id })
}
