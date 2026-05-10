import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { requireAuth, isAuthResponse } from '@/lib/auth/middleware'

/**
 * Read-only index of repo-shipped documentation files (`docs/*.md`).
 *
 * The dashboard's Documentation page renders the in-app "Lastenheft"
 * inline, but also surfaces every Markdown file from this directory so
 * the user can read deep-dives without leaving the app.
 *
 * Both routes are read-only and return only files that physically live
 * under `<repo>/docs/`. No path traversal, no writes, no env leaks.
 */

interface DocFile {
  slug: string
  title: string
  group: string
}

const GROUPS: Array<{ match: RegExp; label: string; order: number }> = [
  { match: /^bridge-/, label: 'Bridge', order: 30 },
  { match: /^cron-(system|and-briefings)/, label: 'Cron & Briefings', order: 40 },
  { match: /^risk-/, label: 'Approvals', order: 50 },
  { match: /^web-push/, label: 'Notifications', order: 60 },
  { match: /^agent-/, label: 'Agents', order: 20 },
  { match: /^core-/, label: 'Architektur', order: 10 },
  { match: /^backend-/, label: 'Architektur', order: 10 },
  { match: /^(fresh-install|course-|update-)/, label: 'Setup & Ops', order: 70 },
]

function inferGroup(slug: string): string {
  for (const group of GROUPS) {
    if (group.match.test(slug)) return group.label
  }
  return 'Sonstiges'
}

function inferTitle(slug: string, content: string): string {
  const headingMatch = content.match(/^#\s+(.+?)\s*$/m)
  if (headingMatch) return headingMatch[1].trim()
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

async function listDocs(): Promise<DocFile[]> {
  const docsDir = path.join(process.cwd(), 'docs')
  const entries = await fs.readdir(docsDir, { withFileTypes: true })
  const files: DocFile[] = []

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue
    const slug = entry.name.replace(/\.md$/, '')
    const fullPath = path.join(docsDir, entry.name)
    let title = slug
    try {
      const content = await fs.readFile(fullPath, 'utf-8')
      title = inferTitle(slug, content)
    } catch {
      // Falls eine Datei verschwindet während wir lesen, ignorieren wir sie still.
    }
    files.push({ slug, title, group: inferGroup(slug) })
  }

  files.sort((a, b) => a.title.localeCompare(b.title))
  return files
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (isAuthResponse(auth)) return auth

  try {
    const files = await listDocs()
    return NextResponse.json({ files })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    console.error('[api/docs] index error:', message)
    return NextResponse.json({ files: [], error: 'Failed to list docs' }, { status: 500 })
  }
}
