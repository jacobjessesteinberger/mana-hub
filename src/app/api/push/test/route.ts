import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse } from '@/lib/auth/middleware'
import { sendPushToAdmin } from '@/lib/push/server'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (isAuthResponse(auth)) return auth

  const result = await sendPushToAdmin(
    {
      title: 'Mana Hub Test',
      body: 'Push-Notifications funktionieren. Du wirst hier informiert, sobald eine Risk Approval oder ein Cron-Vorschlag eintrifft.',
      url: '/dashboard/agents',
      tag: 'mana-hub-test',
    },
    { recipientEmail: auth.email },
  )

  return NextResponse.json({
    ok: result.errors.length === 0,
    attempted: result.attempted,
    delivered: result.delivered,
    removed: result.removed,
    errors: result.errors,
  })
}
