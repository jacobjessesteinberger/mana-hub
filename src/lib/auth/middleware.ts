import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env: ${name}`)
  return value
}

const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
const supabaseServiceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
const isDemoMode = process.env.MANA_HUB_DEMO_MODE === 'true'

export interface AuthenticatedUser {
  id: string
  email: string
}

export async function requireAuth(request: NextRequest): Promise<AuthenticatedUser | NextResponse> {
  if (isDemoMode) {
    return { id: 'demo-user', email: 'demo@example.com' }
  }

  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  const cookieToken = request.cookies.get('sb-access-token')?.value
    || request.cookies.get('supabase-auth-token')?.value

  const effectiveToken = token || cookieToken

  if (!effectiveToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { data: { user }, error } = await supabase.auth.getUser(effectiveToken)

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return { id: user.id, email: user.email || '' }
}

export function isAuthResponse(result: AuthenticatedUser | NextResponse): result is NextResponse {
  return result instanceof NextResponse
}

export function sanitizeForLog(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return 'An unexpected error occurred'
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

const ID_PATTERN = /^[a-zA-Z0-9_-]+$/

export function sanitizePathParam(param: string): string | null {
  if (!ID_PATTERN.test(param)) {
    return null
  }
  return param
}

export function sanitizeSearchInput(input: string): string {
  return input.replace(/[%_\\,()]/g, '').slice(0, 200)
}
