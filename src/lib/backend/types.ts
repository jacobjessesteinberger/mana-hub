export type BackendMode = 'demo' | 'supabase' | 'custom'

export interface ManaHubIssue {
  id: string
  title: string
  status: string
  priority?: string | null
  agent_name?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface ManaHubApproval {
  id: string
  agent_name: string
  action_type: string
  status: string
  risk_level?: string | null
  action_summary?: string | null
  action_payload?: Record<string, unknown> | null
}

export interface ManaHubBackendAdapter {
  mode: BackendMode
  issues: {
    list: () => Promise<ManaHubIssue[]>
  }
  approvals: {
    list: () => Promise<ManaHubApproval[]>
  }
  health: {
    check: () => Promise<{ ok: boolean; message: string }>
  }
}
