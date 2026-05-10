import { type AgentMessage, getLifecycleStatus, isStopSignal } from './types.ts'

export type DispatchDecision =
  | { kind: 'process'; reason: string }
  | { kind: 'skip'; reason: string }
  | { kind: 'stop'; reason: string }

export function decide(msg: AgentMessage): DispatchDecision {
  const stop = isStopSignal(msg)
  if (stop) {
    return { kind: 'stop', reason: stop.reason }
  }

  if (msg.role !== 'user') {
    return { kind: 'skip', reason: `non-user role: ${msg.role}` }
  }

  const status = getLifecycleStatus(msg)
  if (status === 'retracted' || status === 'superseded') {
    return { kind: 'skip', reason: `lifecycle: ${status}` }
  }

  return { kind: 'process', reason: status === 'edited' ? 'edited message' : 'active user message' }
}
