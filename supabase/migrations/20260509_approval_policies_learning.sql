-- Risk-Approval policy learning: lets the user click "Always allow" on an
-- approval card and have future requests with the same action_type for the
-- same agent auto-approve without a UI prompt.
--
-- The approval_policies table already exists (see 000_mana_hub_core.sql).
-- We extend it for the learning workflow:
--   - decided_by  : who clicked "Always allow"
--   - source      : 'manual' (set via UI/API) | 'inferred' (added by some heuristic)
--   - last_used_at: when the policy was last used to auto-approve a request
--   - use_count   : how many times the policy has auto-approved
--   - agent_name  : optional scope (per-agent policy vs global)
--
-- Plus a fast-lookup index used by POST /api/agents/approvals.

ALTER TABLE approval_policies ADD COLUMN IF NOT EXISTS decided_by TEXT;
ALTER TABLE approval_policies ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'
  CHECK (source IN ('manual', 'inferred', 'system'));
ALTER TABLE approval_policies ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
ALTER TABLE approval_policies ADD COLUMN IF NOT EXISTS use_count INTEGER DEFAULT 0;
ALTER TABLE approval_policies ADD COLUMN IF NOT EXISTS agent_name TEXT;

-- Fast lookup for POST /api/agents/approvals:
--   "Is there an enabled always-policy for this (agent_name, action_type)?"
CREATE INDEX IF NOT EXISTS idx_approval_policies_lookup
  ON approval_policies (agent_name, trigger_value, enabled)
  WHERE trigger_type = 'action_type';

-- Track on the approvals row which policy auto-approved it (audit trail).
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS auto_approved_by_policy_id UUID
  REFERENCES approval_policies(id) ON DELETE SET NULL;

-- decided_by may already exist on approvals (see 000_mana_hub_core.sql); ensure it.
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS decided_by TEXT;
