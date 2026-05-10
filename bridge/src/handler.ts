import { type AgentMessage, getAttachments } from './types.ts'
import { AbortError } from './stop.ts'

export type HandlerResult = {
  content: string
  metadata: Record<string, unknown>
}

function checkAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new AbortError(typeof signal.reason === 'string' ? signal.reason : 'aborted')
  }
}

async function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new AbortError(typeof signal.reason === 'string' ? signal.reason : 'aborted'))
      return
    }
    const t = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(t)
      reject(new AbortError(typeof signal.reason === 'string' ? signal.reason : 'aborted'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

export async function handleUserMessage(
  msg: AgentMessage,
  echoPrefix: string,
  signal: AbortSignal
): Promise<HandlerResult> {
  checkAborted(signal)

  const attachments = getAttachments(msg)
  if (attachments.length > 0) {
    console.log(
      `[handler] ${msg.agent_name} received ${attachments.length} attachment(s):`,
      attachments.map(a => `${a.name} (${a.type}, ${a.size} bytes)`).join(', ')
    )
  }

  await sleep(800, signal)
  checkAborted(signal)

  const trimmed = msg.content.trim()
  const lines: string[] = []
  lines.push(`${echoPrefix}You said: "${trimmed.slice(0, 500)}${trimmed.length > 500 ? '...' : ''}"`)

  if (attachments.length > 0) {
    lines.push('')
    lines.push(`Attached files (${attachments.length}):`)
    for (const a of attachments) {
      lines.push(`- ${a.name} (${a.type})`)
    }
  }

  lines.push('')
  lines.push('_This is a placeholder reply from the Mana Hub Bridge echo-stub. Replace `handleUserMessage()` in `bridge/src/handler.ts` with a real LLM call to wire up your AI agent._')

  return {
    content: lines.join('\n'),
    metadata: {
      model: 'echo-stub',
      generated_by: 'bridge',
      input_message_id: msg.id,
      attachments_seen: attachments.length,
    },
  }
}
