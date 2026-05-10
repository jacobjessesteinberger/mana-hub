import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse } from '@/lib/auth/middleware'
import { existsSync } from 'node:fs'
import { groupByCategory, resolveKnowledgeRootFromEnv, scanKnowledgeRoot } from '@/lib/knowledge/fs-index'
import { getDemoKnowledgeEntries } from '@/lib/knowledge/demo-data'

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const configuredRoot = resolveKnowledgeRootFromEnv()
  let entries = getDemoKnowledgeEntries()
  let source: 'filesystem' | 'demo' = 'demo'
  let warning: string | null = null

  if (configuredRoot) {
    if (existsSync(configuredRoot)) {
      try {
        entries = await scanKnowledgeRoot(configuredRoot)
        source = 'filesystem'
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        warning = `Knowledge Base Ordner konnte nicht gelesen werden: ${msg}`
      }
    } else {
      warning = `MANA_HUB_KNOWLEDGE_ROOT gesetzt, aber Ordner fehlt: ${configuredRoot}`
    }
  }

  const categories = groupByCategory(entries)
  const lastSync =
    entries
      .map(e => e.modified_at || e.updated_at)
      .filter(Boolean)
      .sort()
      .at(-1) ?? new Date().toISOString()

  return NextResponse.json({
    entries,
    categories,
    total: entries.length,
    last_sync: lastSync,
    source,
    warning,
  })
}
