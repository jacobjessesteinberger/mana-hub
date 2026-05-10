import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse } from '@/lib/auth/middleware'
import { isValidAgentName } from '@/lib/agents-meta'
import agentData from '@/generated/agent-files.json'

interface BundledFile {
  name: string
  size: number
  modified: string
  isMarkdown: boolean
  isJson: boolean
  content: string
}

const agentFiles = agentData.agents as Record<string, BundledFile[]>

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const name = (await params).id
  if (!isValidAgentName(name)) {
    return NextResponse.json({ error: 'Invalid agent name' }, { status: 400 })
  }

  const files = agentFiles[name] || []
  const { searchParams } = new URL(request.url)
  const fileName = searchParams.get('file')

  if (fileName) {
    const file = files.find(f => f.name === fileName)
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    return NextResponse.json({ name: file.name, content: file.content })
  }

  return NextResponse.json({
    agent: name,
    files: files.map(f => ({
      name: f.name,
      size: f.size,
      modified: f.modified,
      isMarkdown: f.isMarkdown,
      isJson: f.isJson,
    })),
  })
}
