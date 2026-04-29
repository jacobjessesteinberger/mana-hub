import { NextRequest, NextResponse } from 'next/server'
import kbData from '@/generated/kb-data.json'

const demoContent: Record<string, string> = {
  'demo-index': '# Demo Knowledge Base\n\nThis is the entry point for your Mana Hub knowledge base.\n\nReplace these demo files with your own markdown files.',
  'demo-research-standard': '# Research Standard\n\nDefine trusted sources, verification rules, and output requirements for your research agents.',
  'demo-content-planning': '# Content Planning\n\nDefine how agents turn research into content ideas, outlines, and publishing tasks.',
  'demo-research-agent': '# Research Agent\n\nDescribe your research agent role, standards, outputs, and escalation rules.',
  'demo-cronjobs': '# Cronjobs\n\nDocument scheduled agent jobs, expected outputs, and review requirements.',
  'demo-briefing-template': '# Briefing Template\n\nUse this file as a starting point for structured agent briefings.',
}

export async function GET(request: NextRequest) {
  const id = new URL(request.url).searchParams.get('id')
  const entry = kbData.entries.find(item => item.id === id)
  if (!entry) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  return NextResponse.json({
    id: entry.id,
    path: entry.path,
    content: demoContent[entry.id] || `# ${entry.file_name}\n\nDemo content.`,
  })
}
