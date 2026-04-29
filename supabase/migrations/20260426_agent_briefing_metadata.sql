-- Ensure agent messages can carry structured signal metadata for briefings and task proposals.
ALTER TABLE agent_messages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_agent_messages_metadata_kind
  ON agent_messages ((metadata->>'kind'));

CREATE INDEX IF NOT EXISTS idx_agent_messages_metadata_source
  ON agent_messages ((metadata->>'source'));

CREATE INDEX IF NOT EXISTS idx_agent_messages_briefing_lookup
  ON agent_messages (role, created_at DESC)
  WHERE metadata->>'kind' = 'briefing' OR metadata->>'source' = 'cron';
