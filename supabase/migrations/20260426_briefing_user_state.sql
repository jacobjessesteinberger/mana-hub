-- Personal read/archive state for the Briefing Inbox OS.
CREATE TABLE IF NOT EXISTS briefing_user_state (
  briefing_id UUID NOT NULL REFERENCES agent_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  pinned_at TIMESTAMPTZ,
  dismissed_urgency_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (briefing_id, user_id)
);

ALTER TABLE briefing_user_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "briefing_user_state_select_own" ON briefing_user_state;
CREATE POLICY "briefing_user_state_select_own"
  ON briefing_user_state FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "briefing_user_state_insert_own" ON briefing_user_state;
CREATE POLICY "briefing_user_state_insert_own"
  ON briefing_user_state FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "briefing_user_state_update_own" ON briefing_user_state;
CREATE POLICY "briefing_user_state_update_own"
  ON briefing_user_state FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "briefing_user_state_delete_own" ON briefing_user_state;
CREATE POLICY "briefing_user_state_delete_own"
  ON briefing_user_state FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_briefing_user_state_user_read
  ON briefing_user_state (user_id, read_at, archived_at);

CREATE INDEX IF NOT EXISTS idx_briefing_user_state_user_pinned
  ON briefing_user_state (user_id, pinned_at DESC)
  WHERE pinned_at IS NOT NULL;

CREATE OR REPLACE FUNCTION update_briefing_user_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS briefing_user_state_updated_at ON briefing_user_state;
CREATE TRIGGER briefing_user_state_updated_at
  BEFORE UPDATE ON briefing_user_state
  FOR EACH ROW EXECUTE FUNCTION update_briefing_user_state_updated_at();
