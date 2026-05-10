const controllers = new Map<string, AbortController>()

export function registerWork(agentName: string): AbortSignal {
  const existing = controllers.get(agentName)
  if (existing) {
    existing.abort('replaced by newer work')
  }
  const controller = new AbortController()
  controllers.set(agentName, controller)
  return controller.signal
}

export function clearWork(agentName: string): void {
  controllers.delete(agentName)
}

export function abortWork(agentName: string, reason: string): boolean {
  const controller = controllers.get(agentName)
  if (!controller) return false
  controller.abort(reason)
  controllers.delete(agentName)
  return true
}

export function abortAll(reason: string): void {
  for (const [name, controller] of controllers) {
    controller.abort(reason)
    controllers.delete(name)
  }
}

export class AbortError extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'AbortError'
  }
}
