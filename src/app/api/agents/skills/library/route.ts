import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse } from '@/lib/auth/middleware'
import skillsData from '@/generated/skills-library.json'

// GET /api/agents/skills/library — all local skills from Cursor + Codex
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (isAuthResponse(auth)) return auth

  return NextResponse.json(skillsData)
}
