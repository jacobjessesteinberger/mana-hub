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

// Mana Hub Core ships with a single example agent ("mana"). Add more here as you
// implement them; keep `VALID_AGENT_NAMES` and Bridge `BRIDGE_AGENT_NAMES` in sync.
export const AGENTS: AgentMeta[] = [
  {
    name: 'mana',
    label: 'MANA',
    emoji: '✦',
    avatar: '',
    fullName: 'MANA — Task Operator',
    role: 'Task Operator',
    color: '#A855F7',
    bio: 'Persoenlicher Task-Operator und Sparringspartner. Verarbeitet Inbox/Outbox via File-Drop oder Inline-Bridge.',
  },
]

export const AGENT_MAP = Object.fromEntries(AGENTS.map(a => [a.name, a])) as Record<string, AgentMeta>

export const AGENT_NAMES = new Set(AGENTS.map(a => a.name))

export const VALID_AGENT_NAMES = ['mana'] as const
export type AgentName = typeof VALID_AGENT_NAMES[number]

export function isValidAgentName(name: string): name is AgentName {
  return AGENT_NAMES.has(name)
}
