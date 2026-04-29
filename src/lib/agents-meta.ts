export interface AgentMeta {
  name: string
  label: string
  emoji: string
  avatar: string
  fullName: string
  role: string
  color: string
  bio?: string
}

// Per-Agent Farben gemaess Claude Design Handoff (shell.jsx Z. 36-42)
export const AGENTS: AgentMeta[] = [
  { name: 'orchestrator', label: 'Orchestrator', emoji: '◎', avatar: '', fullName: 'Demo Orchestrator Agent', role: 'Coordination', color: '#F59E0B', bio: 'Routet eingehende Items, priorisiert und verteilt sie an die passenden Agents.' },
  { name: 'researcher', label: 'Researcher', emoji: '◇', avatar: '', fullName: 'Demo Research Agent', role: 'Research', color: '#06B6D4', bio: 'Recherchiert Quellen, fasst Briefings zusammen und prueft Watchlists.' },
  { name: 'creator', label: 'Creator', emoji: '✦', avatar: '', fullName: 'Demo Creator Agent', role: 'Content', color: '#8B5CF6', bio: 'Schreibt Drafts, Skripte und Outlines aus den letzten Briefings.' },
  { name: 'operator', label: 'Operator', emoji: '△', avatar: '', fullName: 'Demo Operations Agent', role: 'Operations', color: '#10B981', bio: 'Fuehrt operative Tasks aus und kuemmert sich um Routinen und Ausspielung.' },
  { name: 'builder', label: 'Builder', emoji: '▣', avatar: '', fullName: 'Demo Builder Agent', role: 'Engineering', color: '#EF4444', bio: 'Baut Tools, Integrations und automatisiert wiederkehrende Engineering-Tasks.' },
]

export const AGENT_MAP = Object.fromEntries(AGENTS.map(a => [a.name, a])) as Record<string, AgentMeta>

export const AGENT_NAMES = new Set(AGENTS.map(a => a.name))

export const VALID_AGENT_NAMES = ['orchestrator', 'researcher', 'creator', 'operator', 'builder'] as const
export type AgentName = typeof VALID_AGENT_NAMES[number]

export function isValidAgentName(name: string): name is AgentName {
  return AGENT_NAMES.has(name)
}
