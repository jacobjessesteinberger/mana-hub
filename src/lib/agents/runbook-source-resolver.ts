import kbData from '@/generated/kb-data.json'
import type { AutomationRunbook, RunbookItem, RunbookReference } from '@/lib/agents/automation-runbook'

interface ResolverJob {
  agent_id?: string | null
}

type KBEntry = {
  id: string
  path: string
  file_name: string
  category: string
}

const kbEntries = kbData.entries as KBEntry[]

function kbRef(path: string, sectionAnchor: string, purpose: string): RunbookReference {
  const entry = kbEntries.find(item => item.path === path)
  if (!entry) {
    return {
      type: 'missing',
      path,
      section_anchor: sectionAnchor,
      access_status: 'missing',
      purpose,
    }
  }

  return {
    type: 'knowledge_file',
    id: entry.id,
    path: entry.path,
    section_anchor: sectionAnchor,
    access_status: 'available',
    purpose,
  }
}

function missingRef(label: string, purpose: string): RunbookReference {
  return {
    type: 'missing',
    path: label,
    access_status: 'missing',
    purpose,
  }
}

function slackRef(channel: string, purpose: string): RunbookReference {
  return {
    type: 'slack_channel',
    path: channel,
    access_status: 'planned',
    purpose,
  }
}

function resolveItemReference(item: RunbookItem): RunbookReference | undefined {
  if (item.reference) return item.reference

  const text = `${item.label}\n${item.detail || ''}`.toLowerCase()

  if (text.includes('heartbeat.md')) {
    return missingRef('Agent HEARTBEAT.md', 'Heartbeat-Dateien werden aktuell nicht als klickbare Dashboard-Quelle synchronisiert')
  }
  if (text.includes('watchlist')) {
    return kbRef('workflows/content-planung.md', 'Quellen fuer Recherche', 'Definiert Watchlist-Kontext und taegliche Content-Recherche')
  }
  if (text.includes('research') || text.includes('recherche') || text.includes('quelle')) {
    return kbRef('workflows/research-standard.md', 'Quellen-Hierarchie', 'Definiert Quellen-Hierarchie, Fact-Checking und Research-Qualitaet')
  }
  if (text.includes('youtube') || text.includes('video')) {
    return kbRef('templates/video-briefing.md', 'Research Context', 'Demo source for video and content briefing context')
  }
  if (text.includes('breaking') || text.includes('news')) {
    return slackRef('#breaking-news', 'Output- und Monitoring-Kontext fuer AI-News')
  }
  if (text.includes('briefing') || text.includes('report')) {
    return kbRef('agents/research-agent.md', 'Outputs', 'Describes the demo research agent output style')
  }
  if (text.includes('cron')) {
    return kbRef('ops/cronjobs.md', 'Demo Agent Jobs', 'Documents scheduled demo agent jobs')
  }
  if (text.includes('knowledge base')) {
    return kbRef('INDEX.md', 'Struktur', 'Einstieg in die Knowledge Base')
  }

  return undefined
}

export function enrichRunbookSources(job: ResolverJob, runbook: AutomationRunbook): AutomationRunbook {
  const enrichedSections = runbook.sections.map(section => ({
    ...section,
    items: section.items.map(item => {
      const reference = resolveItemReference(item)
      return reference ? { ...item, reference } : item
    }),
  }))

  const enrichedSkills = runbook.skill_refs.map(skill => {
    if (skill.kb_refs.length > 0) return skill

    const lowerName = skill.skill_name.toLowerCase()
    const kb_refs: RunbookReference[] = []
    if (lowerName.includes('research')) {
      kb_refs.push(kbRef('workflows/research-standard.md', 'Quellen-Hierarchie', 'Methodik fuer Research und Quellenbewertung'))
      kb_refs.push(kbRef('workflows/content-planung.md', 'Quellen fuer Recherche', 'Operativer Content- und Watchlist-Kontext'))
      kb_refs.push(kbRef('agents/research-agent.md', 'Quality Standard', 'Demo agent-specific research rules'))
    }
    if (lowerName.includes('briefing')) {
      kb_refs.push(kbRef('templates/video-briefing.md', 'Template', 'Struktur-Vorlage fuer Briefing-Outputs'))
      kb_refs.push(kbRef('agents/research-agent.md', 'Outputs', 'Expected demo research agent outputs'))
    }
    if (lowerName.includes('fact')) {
      kb_refs.push(kbRef('workflows/research-standard.md', 'Mindeststandard pro Behauptung', 'Fact-Checking-Regeln'))
    }

    return {
      ...skill,
      kb_refs,
    }
  })

  return {
    ...runbook,
    sections: enrichedSections,
    skill_refs: enrichedSkills,
  }
}
