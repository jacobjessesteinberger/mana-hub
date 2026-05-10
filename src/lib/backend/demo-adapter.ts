import type { ManaHubBackendAdapter } from './types'

export const demoBackendAdapter: ManaHubBackendAdapter = {
  mode: 'demo',
  issues: {
    async list() {
      return [
        {
          id: 'demo-task-1',
          title: 'Review the first demo briefing workflow',
          status: 'in_progress',
          priority: 'high',
          agent_name: 'researcher',
          created_at: new Date().toISOString(),
        },
      ]
    },
  },
  approvals: {
    async list() {
      return [
        {
          id: 'demo-approval-1',
          agent_name: 'builder',
          action_type: 'automation.config.update',
          status: 'pending',
          risk_level: 'high',
          action_summary: 'Demo: update a scheduled automation trigger',
          action_payload: { target: 'demo-morning-briefing' },
        },
      ]
    },
  },
  health: {
    async check() {
      return { ok: true, message: 'Demo backend adapter is active.' }
    },
  },
}
