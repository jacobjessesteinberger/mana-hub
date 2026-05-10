import { createHash } from 'crypto'
import { readdir, stat, readFile } from 'node:fs/promises'
import path from 'node:path'

export type KBEntry = {
  id: string
  path: string
  category: string
  file_name: string
  file_size: number
  modified_at: string | null
  updated_at?: string | null
}

/** Same algorithm as legacy API ids — deterministic from relative path within KB root */
export function kbEntryId(relativePath: string): string {
  return createHash('sha256').update(relativePath).digest('hex').slice(0, 12)
}

export function resolveKnowledgeRootFromEnv(): string | null {
  const raw = process.env.MANA_HUB_KNOWLEDGE_ROOT?.trim()
  if (!raw) return null
  return expandUserPath(raw)
}

export function expandUserPath(raw: string): string {
  if (raw.startsWith('~/')) {
    const home = process.env.HOME || process.env.USERPROFILE || ''
    if (!home) return raw
    return path.join(home, raw.slice(2))
  }
  return raw
}

function categoryForRelative(relativePosix: string): string {
  const segments = relativePosix.split('/').filter(Boolean)
  if (segments.length <= 1) return 'root'
  return segments[0] || 'root'
}

/**
 * Resolve a KB-relative path safely under root — no traversal, no absolute paths.
 */
export function safeResolvedKbFile(rootAbsolute: string, relativePosix: string): string | null {
  if (!relativePosix || relativePosix.includes('\0')) return null
  const rel = relativePosix.replace(/\\/g, '/').trim()
  if (!rel || rel.startsWith('/') || /^[a-zA-Z]:/.test(rel)) return null
  const segments = rel.split('/').filter(Boolean)
  if (segments.some(seg => seg === '..')) return null
  const rootResolved = path.resolve(rootAbsolute)
  const joined = path.resolve(rootResolved, ...segments)
  const prefix = rootResolved.endsWith(path.sep) ? rootResolved : `${rootResolved}${path.sep}`
  if (joined !== rootResolved && !joined.startsWith(prefix)) return null
  return joined
}

async function collectMarkdownFiles(rootAbsolute: string): Promise<string[]> {
  const absolutePaths: string[] = []

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const e of entries) {
      if (e.name.startsWith('.')) continue
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        await walk(full)
      } else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
        absolutePaths.push(full)
      }
    }
  }

  await walk(rootAbsolute)
  return absolutePaths
}

export async function scanKnowledgeRoot(rootAbsolute: string): Promise<KBEntry[]> {
  const rootResolved = path.resolve(rootAbsolute)
  const files = await collectMarkdownFiles(rootResolved)
  const entries: KBEntry[] = []

  for (const abs of files) {
    const rel = path.relative(rootResolved, abs)
    const relativePosix = rel.split(path.sep).join('/')
    const st = await stat(abs)
    const mtime = st.mtime.toISOString()
    entries.push({
      id: kbEntryId(relativePosix),
      path: relativePosix,
      category: categoryForRelative(relativePosix),
      file_name: path.basename(abs),
      file_size: st.size,
      modified_at: mtime,
      updated_at: mtime,
    })
  }

  entries.sort((a, b) => a.path.localeCompare(b.path, 'de'))
  return entries
}

export function groupByCategory(entries: KBEntry[]): Record<string, KBEntry[]> {
  const categories: Record<string, KBEntry[]> = {}
  for (const e of entries) {
    if (!categories[e.category]) categories[e.category] = []
    categories[e.category].push(e)
  }
  return categories
}

export async function readKnowledgeFile(
  rootAbsolute: string,
  relativePosix: string
): Promise<{ content: string } | { error: string }> {
  const resolved = safeResolvedKbFile(rootAbsolute, relativePosix)
  if (!resolved) return { error: 'Invalid path' }
  if (!resolved.toLowerCase().endsWith('.md')) return { error: 'Only markdown files are allowed' }
  try {
    const content = await readFile(resolved, 'utf8')
    return { content }
  } catch {
    return { error: 'File not found' }
  }
}

export async function findRelativePathByEntryId(
  rootAbsolute: string,
  id: string
): Promise<string | null> {
  const entries = await scanKnowledgeRoot(rootAbsolute)
  const match = entries.find(e => e.id === id)
  return match ? match.path : null
}
