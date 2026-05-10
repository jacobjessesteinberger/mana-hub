import { cn } from '@/lib/utils'
import type { AgentMeta } from '@/lib/agents-meta'

interface AgentAvatarProps {
  agent: Pick<AgentMeta, 'avatar' | 'label' | 'color'>
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_MAP: Record<NonNullable<AgentAvatarProps['size']>, string> = {
  xs: 'avatar avatar-sm',
  sm: 'avatar avatar-sm',
  md: 'avatar',
  lg: 'avatar avatar-lg',
}

export default function AgentAvatar({ agent, size = 'md', className }: AgentAvatarProps) {
  const initials = (agent.label || '?').slice(0, 2).toUpperCase()
  return (
    <span
      className={cn(SIZE_MAP[size], className)}
      style={{ background: agent.color || '#7c3aed' }}
      title={agent.label}
    >
      {initials}
    </span>
  )
}
