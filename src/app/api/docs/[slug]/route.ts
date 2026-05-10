import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { requireAuth, isAuthResponse } from '@/lib/auth/middleware'

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/

function inferTitle(slug: string, content: string): string {
  const headingMatch = content.match(/^#\s+(.+?)\s*$/m)
  if (headingMatch) return headingMatch[1].trim()
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAuth(req)
  if (isAuthResponse(auth)) return auth

  const { slug } = await params

  if (!slug || !SLUG_PATTERN.test(slug) || slug.length > 80) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  }

  const docsDir = path.join(process.cwd(), 'docs')
  const filePath = path.join(docsDir, slug + '.md')

  // Resolved path must stay within docsDir — guard against any sneaky traversal
  // even though SLUG_PATTERN already excludes "/" and ".".
  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(path.resolve(docsDir) + path.sep)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  }

  try {
    const content = await fs.readFile(resolved, 'utf-8')
    return NextResponse.json({
      slug,
      title: inferTitle(slug, content),
      content,
    })
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return NextResponse.json({ error: 'Doc not found' }, { status: 404 })
    }
    const message = error instanceof Error ? error.message : 'unknown'
    console.error('[api/docs/[slug]] read error:', message)
    return NextResponse.json({ error: 'Failed to read doc' }, { status: 500 })
  }
}
