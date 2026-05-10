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

// Mana Hub Core ships with a single neutral example agent. Add more here as you
// implement them; keep `VALID_AGENT_NAMES` and Bridge `BRIDGE_AGENT_NAMES` in sync.
export const AGENTS: AgentMeta[] = [
  {
    name: 'orchestrator',
    label: 'Orchestrator',
    emoji: '✦',
    avatar: '',
    fullName: 'Demo Orchestrator Agent',
    role: 'Orchestrator Agent',
    color: '#A855F7',
    bio: 'Neutraler Beispiel-Agent fuer Inbox/Outbox, Risk Approvals und lokale Bridge-Tests.',
  },
]

export const AGENT_MAP = Object.fromEntries(AGENTS.map(a => [a.name, a])) as Record<string, AgentMeta>

export const AGENT_NAMES = new Set(AGENTS.map(a => a.name))

export const VALID_AGENT_NAMES = ['orchestrator'] as const
export type AgentName = typeof VALID_AGENT_NAMES[number]

export function isValidAgentName(name: string): name is AgentName {
  return AGENT_NAMES.has(name)
}
