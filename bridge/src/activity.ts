import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProcessingState } from './types.ts'

const TABLE = 'agent_activity'

async function upsertActivity(
  supabase: SupabaseClient,
  agentName: string,
  patch: Record<string, unknown>
): Promise<void> {
  const now = new Date().toISOString()
  const row = { agent_name: agentName, updated_at: now, ...patch }

  const { error: updateError, count } = await supabase
    .from(TABLE)
    .update(row, { count: 'exact' })
    .eq('agent_name', agentName)

  if (updateError) {
    console.error(`[activity] update failed for ${agentName}:`, updateError.message)
  }

  if (!updateError && count === 0) {
    const { error: insertError } = await supabase
      .from(TABLE)
      .insert({ ...row, created_at: now })
    if (insertError) {
      console.error(`[activity] insert failed for ${agentName}:`, insertError.message)
    }
  }
}

export async function setProcessing(
  supabase: SupabaseClient,
  agentName: string,
  task: string
): Promise<void> {
  await upsertActivity(supabase, agentName, {
    active: true,
    status: 'processing',
    current_task: task,
    event_summary: `Bridge processing: ${task}`,
  })
}

export async function setIdle(
  supabase: SupabaseClient,
  agentName: string,
  finalState: Extract<ProcessingState, 'idle' | 'stopped' | 'error'> = 'idle',
  note?: string
): Promise<void> {
  await upsertActivity(supabase, agentName, {
    active: false,
    status: finalState,
    current_task: null,
    event_summary: note ?? (finalState === 'idle' ? 'Bridge idle' : `Bridge ${finalState}`),
  })
}
