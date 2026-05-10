import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse } from '@/lib/auth/middleware'
import { existsSync } from 'node:fs'
import {
  findRelativePathByEntryId,
  readKnowledgeFile,
  resolveKnowledgeRootFromEnv,
} from '@/lib/knowledge/fs-index'
import { getDemoKnowledgeEntries } from '@/lib/knowledge/demo-data'

const demoContentByPath: Record<string, string> = {
  'INDEX.md':
    '# Demo Knowledge Base\n\nThis is the entry point for your Mana Hub knowledge base.\n\nReplace these demo files with your own markdown files.\n\nTip: set MANA_HUB_KNOWLEDGE_ROOT in .env.local to your real KB folder.',
  'workflows/research-standard.md':
    '# Research Standard\n\nDefine trusted sources, verification rules, and output requirements for your research agents.',
  'workflows/content-planung.md':
    '# Content Planning\n\nDefine how agents turn research into content ideas, outlines, and publishing tasks.',
  'agents/research-agent.md':
    '# Research Agent\n\nDescribe your research agent role, standards, outputs, and escalation rules.',
  'ops/cronjobs.md':
    '# Cronjobs\n\nDocument scheduled agent jobs, expected outputs, and review requirements.',
  'templates/video-briefing.md':
    '# Briefing Template\n\nUse this file as a starting point for structured agent briefings.',
}

// GET /api/knowledge/file?id=<12-char sha256 prefix>
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const id = new URL(request.url).searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const configuredRoot = resolveKnowledgeRootFromEnv()
  if (configuredRoot && existsSync(configuredRoot)) {
    try {
      const relative = await findRelativePathByEntryId(configuredRoot, id)
      if (!relative) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 })
      }
      const result = await readKnowledgeFile(configuredRoot, relative)
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: result.error === 'Invalid path' ? 400 : 404 })
      }
      return NextResponse.json({
        id,
        path: relative,
        content: result.content,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  const entry = getDemoKnowledgeEntries().find(item => item.id === id)
  if (!entry) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  return NextResponse.json({
    id: entry.id,
    path: entry.path,
    content:
      demoContentByPath[entry.path] || `# ${entry.file_name}\n\nDemo content. Set MANA_HUB_KNOWLEDGE_ROOT to index your own files.`,
  })
}
