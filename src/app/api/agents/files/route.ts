import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'

const ALLOWED_FILES = [
  'SOUL.md',
  'HEARTBEAT.md',
  'MEMORY.md',
] as const

const BOT_DIRS: Record<string, string> = {
  orchestrator: 'orchestrator',
  researcher: 'researcher',
  creator: 'creator',
  operator: 'operator',
  builder: 'builder',
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const agentId = searchParams.get('agent')
  const fileName = searchParams.get('file')

  if (!agentId || !fileName) {
    return NextResponse.json({ error: 'agent and file params required' }, { status: 400 })
  }

  const botDir = BOT_DIRS[agentId]
  if (!botDir) {
    return NextResponse.json({ error: 'Unknown agent' }, { status: 400 })
  }

  if (!ALLOWED_FILES.includes(fileName as typeof ALLOWED_FILES[number])) {
    return NextResponse.json({ error: 'File not allowed' }, { status: 403 })
  }

  const workspaceRoot = process.env.AGENT_WORKSPACE_DIR || path.join(os.homedir(), 'mana-hub-workspace')
  const filePath = path.join(workspaceRoot, botDir, 'workspace', fileName)

  const resolved = path.resolve(filePath)
  const expectedBase = path.resolve(path.join(workspaceRoot, botDir, 'workspace'))
  if (!resolved.startsWith(expectedBase)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  if (!fs.existsSync(resolved)) {
    return NextResponse.json({ error: 'File not found', content: null }, { status: 404 })
  }

  try {
    const stat = fs.statSync(resolved)
    if (stat.size > 500_000) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 })
    }

    const content = fs.readFileSync(resolved, 'utf-8')

    return NextResponse.json({
      agent: agentId,
      file: fileName,
      content,
      size: stat.size,
      modified: stat.mtime.toISOString(),
    })
  } catch {
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const agentId = searchParams.get('agent')

  if (!agentId) {
    return NextResponse.json({ error: 'agent param required' }, { status: 400 })
  }

  const botDir = BOT_DIRS[agentId]
  if (!botDir) {
    return NextResponse.json({ error: 'Unknown agent' }, { status: 400 })
  }

  const workspaceDir = path.join(os.homedir(), botDir, 'workspace')
  const files: { name: string; size: number; modified: string }[] = []

  for (const f of ALLOWED_FILES) {
    const fp = path.join(workspaceDir, f)
    if (fs.existsSync(fp)) {
      const stat = fs.statSync(fp)
      files.push({ name: f, size: stat.size, modified: stat.mtime.toISOString() })
    }
  }

  return NextResponse.json({ agent: agentId, files })
}
