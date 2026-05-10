export type RunbookConfidence = 'specified' | 'inferred' | 'missing'
export type RunbookSectionKey = 'trigger' | 'sources' | 'research_rules' | 'workflow_steps' | 'output_contract' | 'quality_checks' | 'handoffs' | 'unknowns'
export type RunbookReferenceType = 'knowledge_file' | 'agent_file' | 'slack_channel' | 'external_url' | 'api' | 'missing'
export type RunbookAccessStatus = 'available' | 'missing' | 'unknown' | 'planned'

export interface RunbookReference {
  type: RunbookReferenceType
  id?: string
  path?: string
  url?: string
  section_anchor?: string
  access_status: RunbookAccessStatus
  purpose?: string
}

export interface RunbookItem {
  label: string
  detail?: string
  confidence: RunbookConfidence
  reference?: RunbookReference
}

export interface AutomationSkillRef {
  skill_id: string
  skill_name: string
  agent_id?: string
  source: 'local' | 'cloud_hub' | 'external' | 'manual' | 'inferred'
  version?: string
  used_for: string
  confidence: RunbookConfidence
  kb_refs: RunbookReference[]
  override_notes?: string
}

export interface RunbookSection {
  key: RunbookSectionKey
  title: string
  summary: string
  confidence: RunbookConfidence
  items: RunbookItem[]
}

export interface AutomationRunbook {
  version: 1
  source: 'specified' | 'mixed' | 'inferred'
  quality_score: number
  missing_fields: string[]
  skill_refs: AutomationSkillRef[]
  sections: RunbookSection[]
}

interface AutomationRunbookJob {
  agent_id?: string | null
  name?: string | null
  description?: string | null
  prompt?: string | null
  schedule_hour?: number | null
  schedule_minute?: number | null
  schedule_day?: number | null
  schedule_expr?: string | null
  http_target?: string | null
  output_kind?: string | null
  risk_level?: string | null
  runbook?: unknown
  runbook_quality_score?: number | null
  runbook_missing_fields?: string[] | null
}

const SECTION_TITLES: Record<RunbookSectionKey, string> = {
  trigger: 'Trigger',
  sources: 'Quellen',
  research_rules: 'Recherche-Regeln',
  workflow_steps: 'Arbeitsschritte',
  output_contract: 'Output-Vorgaben',
  quality_checks: 'Qualitätscheck',
  handoffs: 'Handoffs',
  unknowns: 'Offene Lücken',
}

const REQUIRED_SECTIONS: RunbookSectionKey[] = [
  'trigger',
  'sources',
  'research_rules',
  'workflow_steps',
  'output_contract',
  'quality_checks',
  'handoffs',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function asReference(value: unknown): RunbookReference | undefined {
  if (!isRecord(value)) return undefined
  const type = value.type
  const accessStatus = value.access_status
  if (
    !['knowledge_file', 'agent_file', 'slack_channel', 'external_url', 'api', 'missing'].includes(String(type)) ||
    !['available', 'missing', 'unknown', 'planned'].includes(String(accessStatus))
  ) {
    return undefined
  }
  return {
    type: type as RunbookReferenceType,
    id: asString(value.id) || undefined,
    path: asString(value.path) || undefined,
    url: asString(value.url) || undefined,
    section_anchor: asString(value.section_anchor) || undefined,
    access_status: accessStatus as RunbookAccessStatus,
    purpose: asString(value.purpose) || undefined,
  }
}

function asItems(value: unknown): RunbookItem[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry): RunbookItem | null => {
      if (typeof entry === 'string') {
        const label = entry.trim()
        return label ? { label, confidence: 'specified' } : null
      }
      if (!isRecord(entry)) return null
      const label = asString(entry.label) || asString(entry.name) || asString(entry.title)
      if (!label) return null
      const confidence = entry.confidence === 'inferred' || entry.confidence === 'missing' ? entry.confidence : 'specified'
      return {
        label,
        detail: asString(entry.detail) || asString(entry.description) || undefined,
        confidence,
        reference: asReference(entry.reference),
      }
    })
    .filter((item): item is RunbookItem => Boolean(item))
}

function formatSchedule(job: AutomationRunbookJob): string | null {
  if (job.schedule_hour != null && job.schedule_minute != null) {
    const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
    const time = `${String(job.schedule_hour).padStart(2, '0')}:${String(job.schedule_minute).padStart(2, '0')}`
    return job.schedule_day != null ? `${days[job.schedule_day] || job.schedule_day} ${time}` : `Täglich ${time}`
  }
  return asString(job.schedule_expr)
}

function detectItems(text: string, patterns: Array<[RegExp, string, string?]>): RunbookItem[] {
  return patterns
    .filter(([pattern]) => pattern.test(text))
    .map(([, label, detail]) => ({ label, detail, confidence: 'inferred' as const }))
}

function missingItem(label: string): RunbookItem {
  return { label, confidence: 'missing' }
}

function section(key: RunbookSectionKey, items: RunbookItem[], fallbackSummary: string): RunbookSection {
  const confidence: RunbookConfidence = items.length === 0 || items.every(item => item.confidence === 'missing')
    ? 'missing'
    : items.every(item => item.confidence === 'specified')
      ? 'specified'
      : 'inferred'

  return {
    key,
    title: SECTION_TITLES[key],
    summary: confidence === 'missing' ? fallbackSummary : items.map(item => item.label).join(', '),
    confidence,
    items: items.length ? items : [missingItem(fallbackSummary)],
  }
}

function normalizeSpecifiedSection(key: RunbookSectionKey, value: unknown): RunbookSection | null {
  if (Array.isArray(value)) {
    const items = asItems(value)
    return items.length ? section(key, items, `${SECTION_TITLES[key]} nicht spezifiziert`) : null
  }
  if (!isRecord(value)) return null

  const items = asItems(value.items)
  const summary = asString(value.summary)
  const confidence = value.confidence === 'inferred' || value.confidence === 'missing' ? value.confidence : 'specified'

  if (!items.length && !summary) return null

  return {
    key,
    title: asString(value.title) || SECTION_TITLES[key],
    summary: summary || items.map(item => item.label).join(', '),
    confidence,
    items: items.length ? items : [{ label: summary || SECTION_TITLES[key], confidence }],
  }
}

function inferRunbookFromPrompt(job: AutomationRunbookJob): RunbookSection[] {
  const text = `${job.name || ''}\n${job.description || ''}\n${job.prompt || ''}`
  const schedule = formatSchedule(job)
  const kind = job.output_kind || (/briefing|report/i.test(text) ? 'briefing' : 'cron')

  const triggerItems: RunbookItem[] = job.http_target
    ? [{ label: 'HTTP Trigger', detail: job.http_target, confidence: 'specified' }]
    : schedule
      ? [{ label: schedule, detail: 'Zeitplan aus agent_cron_jobs', confidence: 'specified' }]
      : []

  const sourceItems = detectItems(text, [
    [/heartbeat\.md/i, 'Heartbeat.md', 'Datei wurde im Crownjob-Text erwähnt'],
    [/watchlist/i, 'Watchlist', 'Watchlist wurde im Crownjob-Text erwähnt'],
    [/youtube|video/i, 'Video-/YouTube-Kontext', 'Videos wurden erwähnt, konkrete Kanäle fehlen ggf.'],
    [/news|breaking/i, 'News-Kontext', 'News wurden erwähnt, konkrete Plattformen fehlen ggf.'],
    [/knowledge|kb|index\.md/i, 'Knowledge Base', 'Knowledge Base wurde erwähnt'],
    [/api|http|web/i, 'API/Web', 'Web/API wurde erwähnt'],
    [/finance|rechnung|zahlung/i, 'Finance-Kontext', 'Finance-Bezug wurde erwähnt'],
  ])

  const ruleItems = detectItems(text, [
    [/top|priorit/i, 'Priorisierung erwähnt'],
    [/watchlist/i, 'Watchlist berücksichtigen'],
    [/breaking/i, 'Breaking News priorisieren'],
    [/ideen|ideas/i, 'Ideen ableiten'],
  ])

  const stepCandidates: Array<RunbookItem | null> = [
    job.description ? { label: job.description, confidence: 'inferred' as const } : null,
    /sektion\s*2/i.test(text) ? { label: 'Sektion 2 auswerten', confidence: 'inferred' as const } : null,
    /sektion\s*3/i.test(text) ? { label: 'Sektion 3 auswerten', confidence: 'inferred' as const } : null,
    /sektion\s*7/i.test(text) ? { label: 'Sektion 7 auswerten', confidence: 'inferred' as const } : null,
    /post/i.test(text) ? { label: 'Post-Entwurf erstellen', confidence: 'inferred' as const } : null,
  ]
  const stepItems = stepCandidates.filter((item): item is RunbookItem => item !== null)

  const outputItems = [
    { label: kind === 'briefing' ? 'Briefing/Report' : String(kind), confidence: job.output_kind ? 'specified' as const : 'inferred' as const },
    ...detectItems(text, [
      [/watchlist/i, 'Watchlist-Section'],
      [/videoideen|videoideen|video-ideen/i, 'Videoideen-Section'],
      [/abendreport|abendbriefing/i, 'Abendreport-Section'],
      [/post/i, 'Post-Entwurf'],
    ]),
  ]

  const qualityItems = [
    job.risk_level === 'high' || job.risk_level === 'critical'
      ? { label: 'Risk Approval erforderlich', confidence: 'specified' as const }
      : { label: 'Monitoring Review', detail: 'Kein kritischer Risk-Approval-Level hinterlegt', confidence: 'inferred' as const },
  ]

  return [
    section('trigger', triggerItems, 'Trigger nicht spezifiziert'),
    section('sources', sourceItems, 'Konkrete Quellen nicht spezifiziert'),
    section('research_rules', ruleItems, 'Recherche- und Auswahlregeln nicht spezifiziert'),
    section('workflow_steps', stepItems, 'Arbeitsschritte nicht spezifiziert'),
    section('output_contract', outputItems, 'Output-Vorgaben nicht spezifiziert'),
    section('quality_checks', qualityItems, 'Qualitätschecks nicht spezifiziert'),
    section('handoffs', [], 'Handoffs nicht spezifiziert'),
  ]
}

function inferSkillRefs(job: AutomationRunbookJob): AutomationSkillRef[] {
  const text = `${job.name || ''}\n${job.description || ''}\n${job.prompt || ''}`
  const agentId = asString(job.agent_id) || undefined
  const skills: AutomationSkillRef[] = []

  if (agentId === 'researcher' || /research|recherche|news|briefing|report|watchlist/i.test(text)) {
    skills.push({
      skill_id: `${agentId || 'agent'}-research`,
      skill_name: agentId === 'researcher' ? 'Demo Research' : 'Research',
      agent_id: agentId,
      source: 'inferred',
      used_for: 'Quellen finden, Signale bewerten und relevante Themen priorisieren',
      confidence: 'inferred',
      kb_refs: [],
    })
  }

  if (/briefing|report/i.test(text)) {
    skills.push({
      skill_id: `${agentId || 'agent'}-briefing-writing`,
      skill_name: 'Briefing Writing',
      agent_id: agentId,
      source: 'inferred',
      used_for: 'Ergebnisse in ein lesbares, entscheidbares Briefing verdichten',
      confidence: 'inferred',
      kb_refs: [],
    })
  }

  if (/fact|quelle|source|prüf|verify|verifikation/i.test(text)) {
    skills.push({
      skill_id: `${agentId || 'agent'}-fact-checking`,
      skill_name: 'Fact Checking',
      agent_id: agentId,
      source: 'inferred',
      used_for: 'Behauptungen prüfen und schwache Quellen kennzeichnen',
      confidence: 'inferred',
      kb_refs: [],
    })
  }

  if (skills.length === 0) {
    skills.push({
      skill_id: `${agentId || 'agent'}-general-automation`,
      skill_name: 'General Automation Execution',
      agent_id: agentId,
      source: 'inferred',
      used_for: 'Geplanten Crownjob ausführen',
      confidence: 'inferred',
      kb_refs: [],
    })
  }

  return skills
}

function mergeSections(inferred: RunbookSection[], specifiedRunbook: unknown): RunbookSection[] {
  if (!isRecord(specifiedRunbook)) return inferred

  return inferred.map(inferredSection => {
    const specified = normalizeSpecifiedSection(inferredSection.key, specifiedRunbook[inferredSection.key])
    return specified || inferredSection
  })
}

function evaluate(sections: RunbookSection[]) {
  const missingFields = REQUIRED_SECTIONS
    .filter(key => {
      const current = sections.find(sectionItem => sectionItem.key === key)
      return !current || current.confidence === 'missing'
    })
    .map(key => SECTION_TITLES[key])

  const specified = sections.filter(current => current.confidence === 'specified').length
  const inferred = sections.filter(current => current.confidence === 'inferred').length
  const qualityScore = Math.round(((specified * 1 + inferred * 0.45) / sections.length) * 100)
  const source = specified > 0 && inferred > 0 ? 'mixed' : specified > 0 ? 'specified' : 'inferred'

  return { missingFields, qualityScore, source: source as AutomationRunbook['source'] }
}

export function normalizeAutomationRunbook(job: AutomationRunbookJob): AutomationRunbook {
  const inferred = inferRunbookFromPrompt(job)
  const sections = mergeSections(inferred, job.runbook)
  const firstEvaluation = evaluate(sections)
  const unknownItems = firstEvaluation.missingFields.length
    ? firstEvaluation.missingFields.map(label => ({ label: `${label} fehlt`, confidence: 'missing' as const }))
    : [{ label: 'Keine offenen Lücken erkannt', confidence: 'specified' as const }]
  const sectionsWithUnknowns = [
    ...sections,
    section('unknowns', unknownItems, 'Keine offenen Lücken erkannt'),
  ]
  const evaluated = evaluate(sectionsWithUnknowns)

  return {
    version: 1,
    source: evaluated.source,
    quality_score: typeof job.runbook_quality_score === 'number' && job.runbook_quality_score > 0
      ? job.runbook_quality_score
      : evaluated.qualityScore,
    missing_fields: job.runbook_missing_fields?.length ? job.runbook_missing_fields : evaluated.missingFields,
    skill_refs: inferSkillRefs(job),
    sections: sectionsWithUnknowns,
  }
}
