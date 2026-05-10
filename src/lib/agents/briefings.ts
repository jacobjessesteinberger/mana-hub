export interface BriefingRow {
  id: string
  agent_name: string
  role: string
  content: string
  ticket_id: string | null
  reply_to_id: string | null
  created_at: string
  metadata?: {
    kind?: string
    source?: string
    job_id?: string
    job_name?: string
    title?: string
    category?: string
    urgency?: BriefingUrgency
    summary?: string
    action_required?: boolean
    inferred?: boolean
  } | null
}

export type BriefingUrgency = 'low' | 'normal' | 'high' | 'critical'

export interface AgentCronJob {
  id: string
  agent_id: string
  name: string
  description: string | null
  prompt: string | null
  enabled?: boolean | null
  schedule_hour?: number | null
  schedule_minute?: number | null
  schedule_day?: number | null
}

const STRICT_BRIEFING_PATTERNS = [
  /\bmorning briefing\b/i,
  /\bmorning report\b/i,
  /\bmorgenbriefing\b/i,
  /\bmorgen[-\s]?briefing\b/i,
  /\bmorgen report\b/i,
  /\bmorgen-report\b/i,
  /\babendbriefing\b/i,
  /\babend[-\s]?briefing\b/i,
  /\babend report\b/i,
  /\bevening briefing\b/i,
  /\bdaily briefing\b/i,
  /\bdaily report\b/i,
  /\bdaily research\b/i,
  /\bmaintenance report\b/i,
  /\bmaintenance briefing\b/i,
  /\bweekly maintenance\b/i,
  /\bsystem[-\s]?health[-\s]?check\b/i,
  /\bsecurity[-\s]?audit\b/i,
  /\bweekly report\b/i,
  /\byoutube report\b/i,
  /\bsocial report\b/i,
  /\bsocial media performance report\b/i,
  /\bfinance report\b/i,
  /\bresearch briefing\b/i,
  /\bai\/tech research briefing\b/i,
  /\bcron report\b/i,
]

const REPORT_JOB_PATTERN = /briefing|report|maintenance|daily[-\s]?research|daily[-\s]?social|weekly[-\s]?finance|morgen|abend|youtube|social|finance/i
const GENERIC_JOB_TOKENS = new Set([
  'cron',
  'daily',
  'weekly',
  'report',
  'briefing',
  'taeglich',
  'täglich',
  'woechentlich',
  'wöchentlich',
  'agent',
  'job',
])

function firstContentPart(content: string): string {
  return content
    .split('\n')
    .slice(0, 20)
    .join('\n')
    .trim()
}

function normalizeLine(line: string): string {
  return line
    .replace(/^#+\s*/, '')
    .replace(/^[-*]\s*/, '')
    .replace(/^\d+[.)]\s*/, '')
    .trim()
}

export function isReportCronJob(job: AgentCronJob): boolean {
  return REPORT_JOB_PATTERN.test(`${job.id}\n${job.name}\n${job.description || ''}\n${job.prompt || ''}`)
}

function hasStrictBriefingTitle(content: string): boolean {
  const firstPart = firstContentPart(content)
  return STRICT_BRIEFING_PATTERNS.some(pattern => pattern.test(firstPart))
}

function hasBriefingFrontmatter(content: string): boolean {
  const firstPart = firstContentPart(content).toLowerCase()
  return firstPart.includes('output_kind: briefing') || firstPart.includes('kind: briefing') || firstPart.includes('source: cron')
}

function isStructuredReport(content: string): boolean {
  const trimmed = content.trim()
  if (trimmed.length < 240) return false

  const lines = trimmed.split('\n').map(line => line.trim()).filter(Boolean)
  const bulletOrHeadingCount = lines.filter(line =>
    line.startsWith('#') ||
    line.startsWith('- ') ||
    line.startsWith('* ') ||
    /^\d+[.)]\s/.test(line)
  ).length
  const reportTerms = /(zusammenfassung|empfehlung|empfehlungen|relevanz|headline|trend|heute|gestern|fälligkeit|faelligkeit|umsatz|wartung|maintenance|briefing|report)/i.test(trimmed)

  return reportTerms && (bulletOrHeadingCount >= 2 || lines.length >= 6)
}

function sameCronDay(row: BriefingRow, job: AgentCronJob): boolean {
  if (job.schedule_day == null) return true
  const created = new Date(row.created_at)
  return created.getDay() === job.schedule_day
}

function matchesCronFallback(row: BriefingRow, cronJobs: AgentCronJob[]): boolean {
  if (!isStructuredReport(row.content)) return false
  const titleLine = row.content
    .split('\n')
    .map(line => line.replace(/^#+\s*/, '').trim())
    .find(Boolean)
    ?.toLowerCase() || ''

  return cronJobs.some(job =>
    job.agent_id === row.agent_name &&
    isReportCronJob(job) &&
    sameCronDay(row, job) &&
    hasCronJobTitleSignal(titleLine, job)
  )
}

function hasCronJobTitleSignal(titleLine: string, job: AgentCronJob): boolean {
  const raw = `${job.id} ${job.name} ${job.description || ''}`
  const tokens = raw
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/gi, ' ')
    .split(/\s+/)
    .filter(token => token.length >= 4 && !GENERIC_JOB_TOKENS.has(token))

  const uniqueTokens = Array.from(new Set(tokens))
  const hits = uniqueTokens.filter(token => titleLine.includes(token))
  return hits.length >= 2
}

export function isBriefingRow(row: BriefingRow, cronJobs: AgentCronJob[] = []): boolean {
  if (row.metadata?.kind === 'briefing') return true
  if (row.metadata?.source === 'cron') return true
  if (row.metadata?.job_name && /briefing|report|maintenance/i.test(row.metadata.job_name)) return true
  if (hasBriefingFrontmatter(row.content)) return true
  if (hasStrictBriefingTitle(row.content)) return true
  return matchesCronFallback(row, cronJobs)
}

export function inferBriefingCategory(row: BriefingRow, cronJobs: AgentCronJob[] = []): string {
  const titleLine = row.content
    .split('\n')
    .map(line => line.replace(/^#+\s*/, '').trim())
    .find(Boolean) || ''
  const titleText = `${row.metadata?.title || ''}\n${row.metadata?.job_name || ''}\n${titleLine}`.toLowerCase()
  const text = `${row.metadata?.job_name || ''}\n${firstContentPart(row.content)}`.toLowerCase()
  if (/maintenance|wartung|system[-\s]?health|security[-\s]?audit/.test(titleText)) return 'Maintenance'
  if (/abend|evening/.test(titleText)) return 'Evening'
  if (/morgen|morning/.test(titleText)) return 'Morning'
  if (/finance|umsatz|rechnung/.test(text)) return 'Finance'
  if (/social|youtube|tiktok|instagram/.test(text)) return 'Social'
  if (/research|recherche|ai\/tech|trend/.test(text)) return 'Research'

  const matchingJob = cronJobs.find(job => job.agent_id === row.agent_name && isReportCronJob(job))
  if (matchingJob?.name) return matchingJob.name.replace(/[-_]+/g, ' ')
  return 'Cron'
}

export function inferBriefingTitle(row: BriefingRow, cronJobs: AgentCronJob[] = []): string {
  if (row.metadata?.title) return row.metadata.title
  if (row.metadata?.job_name) return row.metadata.job_name.replace(/[-_]+/g, ' ')

  const firstHeading = row.content.split('\n').find(line => line.trim().startsWith('#'))
  if (firstHeading) return firstHeading.replace(/^#+\s*/, '').trim().slice(0, 120)

  const matchingJob = cronJobs.find(job => job.agent_id === row.agent_name && isReportCronJob(job))
  if (matchingJob?.name) return matchingJob.name.replace(/[-_]+/g, ' ')

  return row.content.replace(/\s+/g, ' ').trim().slice(0, 120) || 'Agent Briefing'
}

export function inferBriefingUrgency(row: BriefingRow): BriefingUrgency {
  if (row.metadata?.urgency) return row.metadata.urgency

  const text = `${row.metadata?.title || ''}\n${row.metadata?.category || ''}\n${firstContentPart(row.content)}`.toLowerCase()
  if (/(kritisch|critical|urgent|sofort|security breach|datenleck|payment failed|zahlung fehlgeschlagen|blocker|blocked|ausfall|outage|downtime|incident)/i.test(text)) {
    return 'critical'
  }
  if (/(wichtig|high priority|hohe priorität|deadline|fällig|faellig|entscheidung nötig|entscheidung noetig|review needed|needs approval|freigabe|warning|failed|fehler|risiko|risk)/i.test(text)) {
    return 'high'
  }
  if (/(maintenance|wartung|security|finance|rechnung|umsatz|kosten)/i.test(text)) {
    return 'normal'
  }
  return 'low'
}

export function inferBriefingSummary(row: BriefingRow): string {
  if (row.metadata?.summary) return row.metadata.summary

  const lines = row.content
    .split('\n')
    .map(normalizeLine)
    .filter(line =>
      line.length >= 24 &&
      !/^yaml$/i.test(line) &&
      !/^---$/.test(line) &&
      !/^output_kind:/i.test(line) &&
      !/^source:/i.test(line) &&
      !/^job_id:/i.test(line) &&
      !/^job_name:/i.test(line)
    )

  return (lines[0] || row.content.replace(/\s+/g, ' ').trim()).slice(0, 180)
}

export function inferActionRequired(row: BriefingRow): boolean {
  if (typeof row.metadata?.action_required === 'boolean') return row.metadata.action_required
  const text = firstContentPart(row.content).toLowerCase()
  return /(aktion|action required|to[-\s]?do|todo|entscheidung|freigabe|approve|approval|prüfen|pruefen|review|antworten|reply|fällig|faellig|deadline|blockiert|blocked)/i.test(text)
}

export function enrichBriefingRow(row: BriefingRow, cronJobs: AgentCronJob[] = []): BriefingRow {
  return {
    ...row,
    metadata: {
      ...(row.metadata || {}),
      kind: row.metadata?.kind || 'briefing',
      source: row.metadata?.source || (row.metadata?.job_id ? 'cron' : 'inferred'),
      title: inferBriefingTitle(row, cronJobs),
      category: inferBriefingCategory(row, cronJobs),
      urgency: inferBriefingUrgency(row),
      summary: inferBriefingSummary(row),
      action_required: inferActionRequired(row),
      inferred: row.metadata?.kind !== 'briefing' && row.metadata?.source !== 'cron',
    },
  }
}
