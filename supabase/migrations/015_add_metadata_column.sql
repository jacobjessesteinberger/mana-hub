-- Add metadata JSONB column to agent_messages (was defined in 007 but not present in production)
ALTER TABLE agent_messages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
