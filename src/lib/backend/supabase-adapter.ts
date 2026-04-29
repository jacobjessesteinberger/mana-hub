import type { SupabaseClient } from '@supabase/supabase-js'
import type { ManaHubApproval, ManaHubBackendAdapter, ManaHubIssue } from './types'

export function createSupabaseBackendAdapter(supabase: SupabaseClient): ManaHubBackendAdapter {
  return {
    mode: 'supabase',
    issues: {
      async list() {
        const { data, error } = await supabase
          .from('issues')
          .select('id,title,status,priority,agent_name,created_at,updated_at')
          .order('created_at', { ascending: false })
          .limit(100)
        if (error) throw error
        return (data || []) as ManaHubIssue[]
      },
    },
    approvals: {
      async list() {
        const { data, error } = await supabase
          .from('approvals')
          .select('id,agent_name,action_type,status,risk_level,action_summary,action_payload')
          .order('created_at', { ascending: false })
          .limit(100)
        if (error) throw error
        return (data || []) as ManaHubApproval[]
      },
    },
    health: {
      async check() {
        const { error } = await supabase.from('issues').select('id').limit(1)
        if (error) return { ok: false, message: error.message }
        return { ok: true, message: 'Supabase backend adapter is connected.' }
      },
    },
  }
}
