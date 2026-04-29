-- Add permission approval fields to agent_activity
ALTER TABLE agent_activity
  ADD COLUMN IF NOT EXISTS permission_pending BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS permission_prompt TEXT;
