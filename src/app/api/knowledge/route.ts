import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse } from '@/lib/auth/middleware'
import { createHash } from 'crypto'
import kbData from '@/generated/kb-data.json'

export function fileId(filePath: string): string {
  return createHash('sha256').update(filePath).digest('hex').slice(0, 12)
}

// GET /api/knowledge
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth
  const entries = kbData.entries
  const categories = Array.from(new Set(entries.map(entry => entry.category))).sort()
  const lastSync = entries
    .map(entry => entry.modified_at)
    .filter(Boolean)
    .sort()
    .at(-1) || new Date(0).toISOString()

  return NextResponse.json({
    entries,
    categories,
    total: entries.length,
    last_sync: lastSync,
  })
}
